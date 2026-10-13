import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { FamilyTreePage } from "./FamilyTreePage";
import {
  apiClient,
  ApiClientError,
  type FamilyTreePreview,
  type FamilyTreeJob,
} from "../api";
import { AuthContext, type AuthContextValue } from "../auth/context";
import {
  adult,
  collection,
  detail,
  graph,
  mutation,
  person,
} from "../features/family-tree/forms/testFixtures";
let revision: number;
let capabilities: {
  can_manage: boolean;
  can_export: boolean;
  can_purge: boolean;
};
const source = person(1, "Alex"),
  target = person(2, "Alex duplicate");
function job(
  kind: string,
  summary: Record<string, unknown>,
  overrides: Partial<FamilyTreeJob> = {},
): FamilyTreePreview {
  return {
    id: 70,
    kind,
    state: "ready",
    expected_graph_revision: revision,
    expires_at: new Date(Date.now() + 900000).toISOString(),
    summary,
    preview_token: "literal-preview-token",
    ...overrides,
  };
}
function mount(manage = true) {
  const auth: AuthContextValue = {
    status: "authenticated",
    user: adult,
    moduleKeys: ["family-tree"],
    manageableModuleKeys: manage ? ["family-tree"] : [],
    setAuthenticatedSession: vi.fn(),
    clearSession: vi.fn(),
    logout: vi.fn(),
    refreshModuleAccess: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/family-tree/people/1"]}>
        <Routes>
          <Route path="/family-tree" element={<FamilyTreePage />} />
          <Route
            path="/family-tree/people/:personId"
            element={<FamilyTreePage />}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
async function open(name: string) {
  fireEvent.click(await screen.findByRole("button", { name }));
  return within(screen.getByRole("dialog"));
}
beforeEach(() => {
  revision = 1;
  capabilities = { can_manage: true, can_export: true, can_purge: true };
  vi.spyOn(apiClient, "getMyModules").mockResolvedValue({
    modules: [{ key: "family-tree", can_manage: true }],
  } as Awaited<ReturnType<typeof apiClient.getMyModules>>);
  vi.spyOn(apiClient, "getFamilyTreeCollection").mockImplementation(
    async () => ({ ...collection(revision, 2), capabilities }),
  );
  vi.spyOn(apiClient, "listFamilyTreePeople").mockResolvedValue({
    graph_revision: 1,
    items: [source, target],
    total: 2,
    next_cursor: null,
  });
  vi.spyOn(apiClient, "getFamilyTreePerson").mockImplementation(async (id) =>
    detail(id === 1 ? source : target, revision),
  );
  vi.spyOn(apiClient, "getFamilyTreeGraph").mockImplementation(async () =>
    graph([source, target], revision),
  );
  vi.spyOn(apiClient, "listFamilyTreeStories").mockResolvedValue({
    graph_revision: 1,
    items: [],
    next_cursor: null,
  });
  vi.spyOn(apiClient, "listFamilyTreeResidences").mockResolvedValue({
    graph_revision: 1,
    items: [],
    next_cursor: null,
  });
  vi.spyOn(apiClient, "listFamilyTreeMediaReferences").mockResolvedValue([]);
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:private-session"),
      revokeObjectURL: vi.fn(),
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("Current-source review regressions", () => {
  it("a known saved purge with interrupted collection read must remain recoverable", async () => {
    vi.spyOn(apiClient, "previewFamilyTreePurge").mockResolvedValue(
      job("purge", {
        person_id: 1,
        alias_only: false,
        retained_backup_policy: "Retained backups",
        stories: 0,
        residences: 0,
        media_references: 0,
      }),
    );
    const commit = vi
      .spyOn(apiClient, "commitFamilyTreePurge")
      .mockImplementation(async () => {
        revision++;
        return mutation(revision);
      });
    mount();
    const dialog = await open("Permanently purge person");
    fireEvent.change(dialog.getByLabelText("Owner password"), {
      target: { value: "valid-owner" },
    });
    fireEvent.click(
      dialog.getByRole("button", { name: "Preview permanent purge" }),
    );
    await dialog.findByText("Retained backups");
    fireEvent.change(dialog.getByLabelText("Owner password"), {
      target: { value: "valid-owner" },
    });
    fireEvent.click(
      dialog.getByLabelText(
        "I understand this removes only this person irreversibly.",
      ),
    );
    vi.mocked(apiClient.getFamilyTreeCollection).mockRejectedValueOnce(
      new Error("Saved purge collection GET interrupted"),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit permanent purge" }),
    );
    await dialog.findByText("Saved purge collection GET interrupted");
    expect(
      dialog.getByRole("button", { name: "Commit permanent purge" }),
    ).toBeDisabled();
    vi.mocked(apiClient.getFamilyTreePerson).mockRejectedValue(
      new ApiClientError(404, "Purged", {}),
    );
    const beforeReads = vi.mocked(apiClient.getFamilyTreeCollection).mock.calls
      .length;
    fireEvent.click(
      await dialog.findByRole("button", { name: "Retry saved purge readback" }),
    );
    await waitFor(() =>
      expect(
        vi.mocked(apiClient.getFamilyTreeCollection).mock.calls.length,
      ).toBeGreaterThan(beforeReads),
    );
    await screen.findByText(
      /Purge confirmed by an authorized not-found readback/,
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });
  it("purge receipt retry must use the newly entered fresh owner password", async () => {
    vi.spyOn(apiClient, "previewFamilyTreePurge").mockResolvedValue(
      job("purge", {
        person_id: 1,
        alias_only: false,
        retained_backup_policy: "Retained backups",
        stories: 0,
        residences: 0,
        media_references: 0,
      }),
    );
    const commit = vi
      .spyOn(apiClient, "commitFamilyTreePurge")
      .mockRejectedValueOnce(new TypeError("Unknown purge response"))
      .mockResolvedValue(mutation(1));
    mount();
    const dialog = await open("Permanently purge person");
    fireEvent.change(dialog.getByLabelText("Owner password"), {
      target: { value: "old-valid-password" },
    });
    fireEvent.click(
      dialog.getByRole("button", { name: "Preview permanent purge" }),
    );
    await dialog.findByText("Retained backups");
    fireEvent.change(dialog.getByLabelText("Owner password"), {
      target: { value: "old-valid-password" },
    });
    fireEvent.click(
      dialog.getByLabelText(
        "I understand this removes only this person irreversibly.",
      ),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit permanent purge" }),
    );
    await dialog.findByText("Unknown purge response");
    expect(dialog.getByLabelText("Owner password")).toHaveValue("");
    fireEvent.change(dialog.getByLabelText("Owner password"), {
      target: { value: "rotated-valid-password" },
    });
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit permanent purge" }),
    );
    await waitFor(() => expect(commit).toHaveBeenCalledTimes(2));
    expect(commit.mock.calls[1][1].password).toBe("rotated-valid-password");
  });
});

const purgeSummary = {
  person_id: 1,
  alias_only: false,
  retained_backup_policy: "Retained backups",
  stories: 0,
  residences: 0,
  media_references: 0,
};
async function preparePurge(dialog: ReturnType<typeof within>) {
  fireEvent.change(dialog.getByLabelText("Owner password"), {
    target: { value: "preview credential" },
  });
  fireEvent.click(
    dialog.getByRole("button", { name: "Preview permanent purge" }),
  );
  await dialog.findByText("Retained backups");
  fireEvent.change(dialog.getByLabelText("Owner password"), {
    target: { value: " first attempt " },
  });
  fireEvent.click(
    dialog.getByLabelText(
      "I understand this removes only this person irreversibly.",
    ),
  );
}
describe("Purge authentication and frozen receipt boundaries", () => {
  it("an unknown receipt survives a stale floor and sends a fresh whitespace-preserving credential with identical facts", async () => {
    vi.spyOn(apiClient, "previewFamilyTreePurge").mockResolvedValue(
      job("purge", purgeSummary),
    );
    const send = vi
      .spyOn(apiClient, "commitFamilyTreePurge")
      .mockRejectedValueOnce(new TypeError("Unknown outcome"))
      .mockResolvedValue(mutation(2));
    mount();
    const dialog = await open("Permanently purge person");
    await preparePurge(dialog);
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit permanent purge" }),
    );
    await dialog.findByText("Unknown outcome");
    revision = 2;
    act(() => window.dispatchEvent(new Event("focus")));
    await dialog.findByText(/tree revision changed/);
    vi.mocked(apiClient.getFamilyTreePerson).mockRejectedValue(
      new ApiClientError(404, "Purged", {}),
    );
    fireEvent.change(dialog.getByLabelText("Owner password"), {
      target: { value: " fresh rotated credential " },
    });
    await waitFor(() =>
      expect(
        dialog.getByRole("button", { name: "Commit permanent purge" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit permanent purge" }),
    );
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    const { password: firstPassword, ...firstFacts } = send.mock.calls[0][1];
    const { password: freshPassword, ...retryFacts } = send.mock.calls[1][1];
    expect(firstPassword).toBe(" first attempt ");
    expect(freshPassword).toBe(" fresh rotated credential ");
    expect(retryFacts).toEqual(firstFacts);
    expect(retryFacts.expected_graph_revision).toBe(1);
  });
  it("a pending purge clears the visible credential immediately and aborts on retirement", async () => {
    vi.spyOn(apiClient, "previewFamilyTreePurge").mockResolvedValue(
      job("purge", purgeSummary),
    );
    let signal: AbortSignal | undefined;
    const send = vi
      .spyOn(apiClient, "commitFamilyTreePurge")
      .mockImplementation((_id, _facts, options) => {
        signal = options?.signal;
        return new Promise(() => undefined);
      });
    const mounted = mount();
    const dialog = await open("Permanently purge person");
    await preparePurge(dialog);
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit permanent purge" }),
    );
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(dialog.getByLabelText("Owner password")).toHaveValue("");
    mounted.unmount();
    expect(signal?.aborted).toBe(true);
  });
  it("a new stale preview never sends a purge, even with a password and old confirmation", async () => {
    vi.spyOn(apiClient, "previewFamilyTreePurge").mockResolvedValue(
      job("purge", purgeSummary),
    );
    const send = vi.spyOn(apiClient, "commitFamilyTreePurge");
    mount();
    const dialog = await open("Permanently purge person");
    await preparePurge(dialog);
    revision = 2;
    act(() => window.dispatchEvent(new Event("focus")));
    await dialog.findByText(/tree revision changed/);
    expect(
      dialog.getByRole("button", { name: "Commit permanent purge" }),
    ).toBeDisabled();
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit permanent purge" }),
    );
    expect(send).not.toHaveBeenCalled();
  });
});
