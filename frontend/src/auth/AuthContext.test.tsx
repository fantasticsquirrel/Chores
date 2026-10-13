import { StrictMode, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient, type AuthSessionResponse, type AuthUser } from "../api";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./useAuth";

// Family Tree is deliberately not registered on web yet. Exercise the auth
// boundary with a future (and even erroneously child-visible) registry entry.
vi.mock("../modules/registry", () => ({
  familyModules: [
    { key: "chores", roles: ["PARENT_ADMIN", "PARENT", "CHILD"] },
    { key: "recipes", roles: ["PARENT_ADMIN", "PARENT"] },
    { key: "admin", roles: ["PARENT_ADMIN"] },
    { key: "family-tree", roles: ["PARENT_ADMIN", "PARENT", "CHILD"] },
  ],
}));

type ModulesResponse = Awaited<ReturnType<typeof apiClient.getMyModules>>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function session(
  id = 1,
  role: AuthUser["role"] = "PARENT",
): AuthSessionResponse {
  return {
    user: {
      id,
      household_id: id,
      is_household_owner: false,
      email: `user-${id}@example.com`,
      role,
      child_id: role === "CHILD" ? id : null,
    },
    csrf_token: null,
  };
}

function modules(canManage?: boolean): ModulesResponse {
  return {
    modules: [
      { key: "chores", name: "Chores", description: "" },
      { key: "recipes", name: "Recipes", description: "", can_manage: false },
      {
        key: "family-tree",
        name: "Family Tree",
        description: "",
        ...(canManage === undefined ? {} : { can_manage: canManage }),
      },
    ],
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

async function anonymousProvider() {
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(hook.result.current.status).toBe("anonymous"));
  return hook;
}

async function authenticatedProvider(role: AuthUser["role"] = "PARENT") {
  vi.mocked(apiClient.getCurrentSession).mockResolvedValue(session(1, role));
  vi.mocked(apiClient.getMyModules).mockResolvedValue(modules(true));
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(hook.result.current.status).toBe("authenticated"));
  return hook;
}

function expectNoFamilyTree(access: ReturnType<typeof useAuth>) {
  expect(access.moduleKeys).not.toContain("family-tree");
  expect(access.manageableModuleKeys).not.toContain("family-tree");
}

describe("FT-0 web authentication module discovery", () => {
  beforeEach(() => {
    vi.mocked(apiClient.getCurrentSession).mockRejectedValue(
      new Error("No session"),
    );
    vi.mocked(apiClient.getMyModules).mockResolvedValue({ modules: [] });
    vi.spyOn(apiClient, "logout").mockResolvedValue(undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it.each(["PARENT", "PARENT_ADMIN", "CHILD"] as const)(
    "never grants Family Tree via failed bootstrap discovery for %s; preserves role fallback",
    async (role) => {
      vi.mocked(apiClient.getCurrentSession).mockResolvedValue(
        session(1, role),
      );
      vi.mocked(apiClient.getMyModules).mockRejectedValue(
        new Error("Discovery unavailable"),
      );
      const { result } = renderHook(useAuth, { wrapper });
      await waitFor(() => expect(result.current.status).toBe("authenticated"));
      expectNoFamilyTree(result.current);
      const expected =
        role === "CHILD"
          ? ["chores"]
          : role === "PARENT_ADMIN"
            ? ["chores", "recipes", "admin"]
            : ["chores", "recipes"];
      expect(result.current.moduleKeys).toEqual(expected);
      expect(result.current.manageableModuleKeys).toEqual(expected);
    },
  );

  it("does not grant Family Tree while login discovery is pending or after it fails", async () => {
    const { result } = await anonymousProvider();
    const discovery = deferred<ModulesResponse>();
    vi.mocked(apiClient.getMyModules).mockReturnValue(discovery.promise);
    act(() => result.current.setAuthenticatedSession(session()));
    expect(result.current.status).toBe("authenticated");
    expectNoFamilyTree(result.current);
    expect(result.current.moduleKeys).toEqual(["chores", "recipes"]);
    expect(result.current.manageableModuleKeys).toEqual(["chores", "recipes"]);
    await act(async () => discovery.reject(new Error("Unavailable")));
    expectNoFamilyTree(result.current);
    expect(result.current.moduleKeys).toEqual(["chores", "recipes"]);
  });

  it.each([undefined, false, true])(
    "requires exactly true Family Tree manage on bootstrap (%s), preserving adjacent manage semantics",
    async (canManage) => {
      vi.mocked(apiClient.getCurrentSession).mockResolvedValue(session());
      vi.mocked(apiClient.getMyModules).mockResolvedValue(modules(canManage));
      const { result } = renderHook(useAuth, { wrapper });
      await waitFor(() => expect(result.current.status).toBe("authenticated"));
      expect(result.current.moduleKeys).toEqual([
        "chores",
        "recipes",
        "family-tree",
      ]);
      expect(result.current.manageableModuleKeys).toEqual(
        canManage === true ? ["chores", "family-tree"] : ["chores"],
      );
    },
  );

  it("successful login discovery grants view only when Family Tree manage is missing", async () => {
    const { result } = await anonymousProvider();
    vi.mocked(apiClient.getMyModules).mockResolvedValue(modules());
    act(() => result.current.setAuthenticatedSession(session()));
    await waitFor(() =>
      expect(result.current.moduleKeys).toContain("family-tree"),
    );
    expect(result.current.manageableModuleKeys).toEqual(["chores"]);
  });

  it("successful discovery with no Family Tree overrides registry fallback", async () => {
    vi.mocked(apiClient.getCurrentSession).mockResolvedValue(session());
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.moduleKeys).toEqual([]);
    expect(result.current.manageableModuleKeys).toEqual([]);
  });

  it("filters erroneously discovered Family Tree for children during bootstrap", async () => {
    const { result } = await authenticatedProvider("CHILD");
    expectNoFamilyTree(result.current);
    expect(result.current.moduleKeys).toEqual(["chores", "recipes"]);
    expect(result.current.manageableModuleKeys).toEqual(["chores"]);
  });

  it("filters erroneously discovered Family Tree for children during login and refresh", async () => {
    const { result } = await anonymousProvider();
    vi.mocked(apiClient.getMyModules).mockResolvedValue(modules(true));
    act(() => result.current.setAuthenticatedSession(session(2, "CHILD")));
    await waitFor(() => expect(result.current.moduleKeys).toContain("recipes"));
    expectNoFamilyTree(result.current);
    await act(async () => result.current.refreshModuleAccess());
    expectNoFamilyTree(result.current);
    expect(result.current.manageableModuleKeys).toEqual(["chores"]);
  });

  it.each([undefined, false, true])(
    "uses exact Family Tree manage on refresh (%s)",
    async (canManage) => {
      const { result } = await authenticatedProvider();
      vi.mocked(apiClient.getMyModules).mockResolvedValue(modules(canManage));
      await act(async () => result.current.refreshModuleAccess());
      expect(result.current.moduleKeys).toContain("family-tree");
      expect(result.current.manageableModuleKeys).toEqual(
        canManage === true ? ["chores", "family-tree"] : ["chores"],
      );
    },
  );

  it("removes stale Family Tree on failed refresh, preserves adjacent access, rejects for retry and recovers", async () => {
    const { result } = await authenticatedProvider();
    const error = new Error("Retry module discovery");
    vi.mocked(apiClient.getMyModules).mockRejectedValue(error);
    await act(async () => {
      await expect(result.current.refreshModuleAccess()).rejects.toBe(error);
    });
    expectNoFamilyTree(result.current);
    expect(result.current.moduleKeys).toEqual(["chores", "recipes"]);
    expect(result.current.manageableModuleKeys).toEqual(["chores"]);
    expect(result.current.status).toBe("authenticated");
    vi.mocked(apiClient.getMyModules).mockResolvedValue(modules(true));
    await act(async () => result.current.refreshModuleAccess());
    expect(result.current.moduleKeys).toContain("family-tree");
    expect(result.current.manageableModuleKeys).toContain("family-tree");
  });

  it("authoritative refresh denial removes both Family Tree keys", async () => {
    const { result } = await authenticatedProvider();
    vi.mocked(apiClient.getMyModules).mockResolvedValue({ modules: [] });
    await act(async () => result.current.refreshModuleAccess());
    expect(result.current.moduleKeys).toEqual([]);
    expect(result.current.manageableModuleKeys).toEqual([]);
  });

  it.each(["resolve", "reject"] as const)(
    "ignores late initial session %s after a replacement login",
    async (outcome) => {
      const initial = deferred<AuthSessionResponse>();
      vi.mocked(apiClient.getCurrentSession).mockReturnValue(initial.promise);
      const { result } = renderHook(useAuth, { wrapper });
      act(() => result.current.setAuthenticatedSession(session(2, "CHILD")));
      await act(async () => {
        if (outcome === "resolve") initial.resolve(session(1));
        else initial.reject(new Error("Old session failed"));
      });
      expect(result.current.user?.id).toBe(2);
      expect(result.current.status).toBe("authenticated");
      expectNoFamilyTree(result.current);
      expect(apiClient.getMyModules).toHaveBeenCalledTimes(1);
    },
  );

  it("ignores late initial session after clearSession", async () => {
    const initial = deferred<AuthSessionResponse>();
    vi.mocked(apiClient.getCurrentSession).mockReturnValue(initial.promise);
    const { result } = renderHook(useAuth, { wrapper });
    act(() => result.current.clearSession());
    vi.mocked(apiClient.getMyModules).mockResolvedValue(modules(true));
    await act(async () => initial.resolve(session()));
    expect(result.current.status).toBe("anonymous");
    expect(result.current.user).toBeNull();
    expectNoFamilyTree(result.current);
    expect(apiClient.getMyModules).not.toHaveBeenCalled();
  });

  it("ignores late bootstrap discovery after replacement login", async () => {
    const initial = deferred<ModulesResponse>();
    vi.mocked(apiClient.getCurrentSession).mockResolvedValue(session());
    vi.mocked(apiClient.getMyModules)
      .mockReturnValueOnce(initial.promise)
      .mockResolvedValue({ modules: [] });
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() =>
      expect(apiClient.getMyModules).toHaveBeenCalledTimes(1),
    );
    act(() => result.current.setAuthenticatedSession(session(2, "CHILD")));
    await act(async () => initial.resolve(modules(true)));
    expect(result.current.user?.id).toBe(2);
    expect(result.current.status).toBe("authenticated");
    expectNoFamilyTree(result.current);
  });

  it.each(["clearSession", "logout"] as const)(
    "late login discovery cannot restore keys after %s",
    async (action) => {
      const { result } = await anonymousProvider();
      const pending = deferred<ModulesResponse>();
      vi.mocked(apiClient.getMyModules).mockReturnValue(pending.promise);
      act(() => result.current.setAuthenticatedSession(session()));
      await act(async () => result.current[action]());
      await act(async () => pending.resolve(modules(true)));
      expect(result.current.status).toBe("anonymous");
      expect(result.current.user).toBeNull();
      expect(result.current.moduleKeys).toEqual([]);
      expect(result.current.manageableModuleKeys).toEqual([]);
    },
  );

  it.each(["resolve", "reject"] as const)(
    "ignores old account discovery %s, including role fallback",
    async (outcome) => {
      const { result } = await anonymousProvider();
      const old = deferred<ModulesResponse>();
      vi.mocked(apiClient.getMyModules)
        .mockReturnValueOnce(old.promise)
        .mockResolvedValue({ modules: [] });
      act(() =>
        result.current.setAuthenticatedSession(session(1, "PARENT_ADMIN")),
      );
      act(() => result.current.setAuthenticatedSession(session(2, "CHILD")));
      await waitFor(() => expect(result.current.moduleKeys).toEqual([]));
      await act(async () => {
        if (outcome === "resolve") old.resolve(modules(true));
        else old.reject(new Error("Old discovery failed"));
      });
      expect(result.current.user?.id).toBe(2);
      expect(result.current.moduleKeys).toEqual([]);
      expect(result.current.manageableModuleKeys).toEqual([]);
    },
  );

  it("uses generation rather than user ID when the same account logs in again", async () => {
    const { result } = await anonymousProvider();
    const old = deferred<ModulesResponse>();
    vi.mocked(apiClient.getMyModules)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({ modules: [] });
    const sameSession = session();
    act(() => result.current.setAuthenticatedSession(sameSession));
    act(() => result.current.setAuthenticatedSession(sameSession));
    await waitFor(() => expect(result.current.moduleKeys).toEqual([]));
    await act(async () => old.resolve(modules(true)));
    expect(result.current.moduleKeys).toEqual([]);
    expect(result.current.manageableModuleKeys).toEqual([]);
  });

  it("late logout completion cannot clear a replacement account", async () => {
    const { result } = await authenticatedProvider();
    const pendingLogout = deferred<void>();
    vi.mocked(apiClient.logout).mockReturnValue(pendingLogout.promise);
    let logout!: Promise<void>;
    act(() => {
      logout = result.current.logout();
    });
    vi.mocked(apiClient.getMyModules).mockResolvedValue({ modules: [] });
    act(() => result.current.setAuthenticatedSession(session(2, "CHILD")));
    await act(async () => {
      pendingLogout.resolve(undefined);
      await logout;
    });
    expect(result.current.user?.id).toBe(2);
    expect(result.current.status).toBe("authenticated");
    expectNoFamilyTree(result.current);
  });

  it.each(["resolve", "reject"] as const)(
    "ignores stale refresh %s after account replacement",
    async (outcome) => {
      const { result } = await authenticatedProvider();
      const oldRefresh = deferred<ModulesResponse>();
      vi.mocked(apiClient.getMyModules)
        .mockReturnValueOnce(oldRefresh.promise)
        .mockResolvedValue(modules(true));
      let refresh!: Promise<void>;
      act(() => {
        refresh = result.current.refreshModuleAccess();
      });
      // Observe rejection immediately to avoid an unhandled promise in the test.
      const settled = refresh.catch((error: unknown) => error);
      act(() => result.current.setAuthenticatedSession(session(2)));
      await waitFor(() =>
        expect(result.current.moduleKeys).toContain("family-tree"),
      );
      await act(async () => {
        if (outcome === "resolve") oldRefresh.resolve({ modules: [] });
        else oldRefresh.reject(new Error("Old refresh failed"));
        await settled;
      });
      expect(result.current.user?.id).toBe(2);
      expect(result.current.moduleKeys).toContain("family-tree");
      expect(result.current.manageableModuleKeys).toContain("family-tree");
    },
  );

  it("late refresh cannot restore access after logout", async () => {
    const { result } = await authenticatedProvider();
    const oldRefresh = deferred<ModulesResponse>();
    vi.mocked(apiClient.getMyModules).mockReturnValue(oldRefresh.promise);
    let refresh!: Promise<void>;
    act(() => {
      refresh = result.current.refreshModuleAccess();
    });
    await act(async () => result.current.logout());
    await act(async () => {
      oldRefresh.resolve(modules(true));
      await refresh;
    });
    expect(result.current.status).toBe("anonymous");
    expect(result.current.moduleKeys).toEqual([]);
    expect(result.current.manageableModuleKeys).toEqual([]);
  });

  it.each(["deny", "fail"] as const)(
    "a newer refresh %s cannot be undone by an older successful refresh",
    async (outcome) => {
      const { result } = await authenticatedProvider();
      const oldRefresh = deferred<ModulesResponse>();
      vi.mocked(apiClient.getMyModules).mockReturnValueOnce(oldRefresh.promise);
      let refresh!: Promise<void>;
      act(() => {
        refresh = result.current.refreshModuleAccess();
      });
      const error = new Error("Newest discovery failed");
      if (outcome === "deny")
        vi.mocked(apiClient.getMyModules).mockResolvedValue({ modules: [] });
      else vi.mocked(apiClient.getMyModules).mockRejectedValue(error);
      await act(async () => {
        if (outcome === "deny") await result.current.refreshModuleAccess();
        else
          await expect(result.current.refreshModuleAccess()).rejects.toBe(
            error,
          );
      });
      expectNoFamilyTree(result.current);
      await act(async () => {
        oldRefresh.resolve(modules(true));
        await refresh;
      });
      expectNoFamilyTree(result.current);
    },
  );

  it("a newer refresh denial cannot be undone by pending login discovery", async () => {
    const { result } = await anonymousProvider();
    const loginDiscovery = deferred<ModulesResponse>();
    vi.mocked(apiClient.getMyModules)
      .mockReturnValueOnce(loginDiscovery.promise)
      .mockResolvedValue({ modules: [] });
    act(() => result.current.setAuthenticatedSession(session()));
    await act(async () => result.current.refreshModuleAccess());
    await act(async () => loginDiscovery.resolve(modules(true)));
    expect(result.current.moduleKeys).toEqual([]);
    expect(result.current.manageableModuleKeys).toEqual([]);
  });

  it("bootstrap remains loading with no Family Tree keys until discovery succeeds", async () => {
    const discovery = deferred<ModulesResponse>();
    vi.mocked(apiClient.getCurrentSession).mockResolvedValue(session());
    vi.mocked(apiClient.getMyModules).mockReturnValue(discovery.promise);
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(apiClient.getMyModules).toHaveBeenCalledOnce());
    expect(result.current.status).toBe("loading");
    expectNoFamilyTree(result.current);
    await act(async () => discovery.resolve(modules(true)));
    expect(result.current.status).toBe("authenticated");
    expect(result.current.moduleKeys).toContain("family-tree");
  });

  it("logout immediately invalidates bootstrap even while the server logout is pending", async () => {
    const initial = deferred<AuthSessionResponse>();
    const pendingLogout = deferred<void>();
    vi.mocked(apiClient.getCurrentSession).mockReturnValue(initial.promise);
    vi.mocked(apiClient.logout).mockReturnValue(pendingLogout.promise);
    const { result } = renderHook(useAuth, { wrapper });
    let logout!: Promise<void>;
    act(() => {
      logout = result.current.logout();
    });
    await act(async () => initial.resolve(session()));
    expect(apiClient.getMyModules).not.toHaveBeenCalled();
    await act(async () => {
      pendingLogout.resolve(undefined);
      await logout;
    });
    expect(result.current.status).toBe("anonymous");
    expectNoFamilyTree(result.current);
  });

  it("failed logout remains observable and keeps the existing session, as before", async () => {
    const { result } = await authenticatedProvider();
    const error = new Error("Logout unavailable");
    vi.mocked(apiClient.logout).mockRejectedValue(error);
    await act(async () => {
      await expect(result.current.logout()).rejects.toBe(error);
    });
    expect(result.current.status).toBe("authenticated");
    expect(result.current.user?.id).toBe(1);
    expect(result.current.moduleKeys).toContain("family-tree");
    await act(async () => result.current.refreshModuleAccess());
    expect(result.current.manageableModuleKeys).toContain("family-tree");
  });

  it("does not start discovery when an unmounted bootstrap session resolves", async () => {
    const initial = deferred<AuthSessionResponse>();
    vi.mocked(apiClient.getCurrentSession).mockReturnValue(initial.promise);
    const { unmount } = renderHook(useAuth, { wrapper });
    unmount();
    await act(async () => initial.resolve(session()));
    expect(apiClient.getMyModules).not.toHaveBeenCalled();
  });

  it("StrictMode effect replay cannot let its obsolete bootstrap overwrite the current one", async () => {
    const initial = deferred<AuthSessionResponse>();
    vi.mocked(apiClient.getCurrentSession)
      .mockReturnValueOnce(initial.promise)
      .mockResolvedValue(session(2, "CHILD"));
    vi.mocked(apiClient.getMyModules).mockResolvedValue(modules(true));
    const { result } = renderHook(useAuth, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <StrictMode>
          <AuthProvider>{children}</AuthProvider>
        </StrictMode>
      ),
    });
    await waitFor(() => expect(result.current.user?.id).toBe(2));
    await act(async () => initial.resolve(session(1)));
    expect(result.current.user?.id).toBe(2);
    expectNoFamilyTree(result.current);
    expect(apiClient.getMyModules).toHaveBeenCalledOnce();
  });

  it("a refresh callback captured by an old account cannot discover for its replacement", async () => {
    const { result } = await authenticatedProvider();
    const oldRefresh = result.current.refreshModuleAccess;
    vi.mocked(apiClient.getMyModules).mockResolvedValue({ modules: [] });
    act(() => result.current.setAuthenticatedSession(session(2, "CHILD")));
    await waitFor(() => expect(result.current.moduleKeys).toEqual([]));
    vi.mocked(apiClient.getMyModules).mockResolvedValue(modules(true));
    const count = vi.mocked(apiClient.getMyModules).mock.calls.length;
    await act(async () => oldRefresh());
    expect(apiClient.getMyModules).toHaveBeenCalledTimes(count);
    expectNoFamilyTree(result.current);
  });
});
