import { fireEvent, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import { apiClient } from "../../../api";
import { AuthContext, type AuthContextValue } from "../../../auth/context";
import { adult } from "../forms/testFixtures";
import { useFamilyTreeAccess } from "./useFamilyTreeAccess";

const auth: AuthContextValue = {
  status: "authenticated",
  user: adult,
  moduleKeys: ["family-tree"],
  manageableModuleKeys: ["family-tree"],
  setAuthenticatedSession: vi.fn(),
  clearSession: vi.fn(),
  logout: vi.fn(),
  refreshModuleAccess: vi.fn(),
};
function wrapper({ children }: PropsWithChildren) {
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
const response = {
  modules: [
    {
      key: "family-tree",
      name: "Family Tree",
      description: "Private records",
      can_manage: true,
    },
  ],
} as Awaited<ReturnType<typeof apiClient.getMyModules>>;
afterEach(() => vi.restoreAllMocks());

describe("owned Family Tree discovery transport", () => {
  it("forwards its owned signal and aborts it on unmount", async () => {
    const discover = vi
      .spyOn(apiClient, "getMyModules")
      .mockResolvedValue(response);
    const view = renderHook(() => useFamilyTreeAccess(), { wrapper });
    await waitFor(() => expect(discover).toHaveBeenCalledOnce());
    const signal = discover.mock.calls[0]?.[0]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("aborts the old discovery request before a focus revalidation", async () => {
    const discover = vi
      .spyOn(apiClient, "getMyModules")
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValue(response);
    const view = renderHook(() => useFamilyTreeAccess(), { wrapper });
    await waitFor(() => expect(discover).toHaveBeenCalledOnce());
    const first = discover.mock.calls[0]?.[0]?.signal;
    expect(first).toBeInstanceOf(AbortSignal);
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(discover).toHaveBeenCalledTimes(2));
    expect(first?.aborted).toBe(true);
    const current = discover.mock.calls[1]?.[0]?.signal;
    expect(current).toBeInstanceOf(AbortSignal);
    expect(current?.aborted).toBe(false);
    await waitFor(() =>
      expect(view.result.current.access.state).toBe("allowed"),
    );
    view.unmount();
    expect(current?.aborted).toBe(true);
  });
});
