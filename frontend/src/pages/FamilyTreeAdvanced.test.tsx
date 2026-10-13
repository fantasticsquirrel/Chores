import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
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
function mergeSummary(unresolved = true) {
  return {
    source,
    target,
    conflicting_fields: ["display_name"],
    unresolved_fields: unresolved ? ["display_name"] : [],
    relationship_changes: [],
    retained_records: {
      stories: 1,
      residences: 1,
      tags: 0,
      names: 0,
      media_references: 0,
    },
    retargeted_alias_ids: [],
    similar_partner_episode_ids: [],
    requires_partner_review: false,
    warnings: [],
  };
}
function importSummary(duplicate = false) {
  return {
    people: 2,
    relationships: 1,
    stories: 1,
    residences: 1,
    media: 0,
    missing_media: 1,
    warnings: ["Image bytes are omitted"],
    duplicate_provenance: duplicate,
    duplicate_suggestions: [
      { source_key: "original", candidate_person_ids: [1] },
    ],
    unsupported_fields: [],
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
describe("FT3 protected actual API-method workflows", () => {
  it("uploads actual File bytes, attaches a primary photo and reads authorized bytes, then revokes on unmount", async () => {
    const asset = {
      id: 30,
      mime_type: "image/png",
      byte_size: 4,
      checksum: "digest",
      width: 1,
      height: 1,
      caption: "Recorded photo",
      state: "ready",
    };
    const upload = vi
      .spyOn(apiClient, "uploadFamilyTreeMedia")
      .mockResolvedValue(asset);
    const attach = vi
      .spyOn(apiClient, "attachFamilyTreeMedia")
      .mockImplementation(async () => {
        revision++;
        vi.mocked(apiClient.listFamilyTreeMediaReferences).mockResolvedValue([
          {
            id: 31,
            asset_id: 30,
            person_id: 1,
            story_id: null,
            role: "primary",
            asset,
          },
        ]);
        return mutation(revision);
      });
    const bytes = vi
      .spyOn(apiClient, "getFamilyTreeMediaContent")
      .mockResolvedValue({
        bytes: new Uint8Array([1, 2, 3, 4]).buffer,
        content_type: "image/png",
        filename: "image",
      });
    const view = mount();
    const dialog = await open("Upload photograph");
    const file = new File([new Uint8Array([1, 2, 3, 4])], "original.png", {
      type: "image/png",
    });
    fireEvent.change(dialog.getByLabelText("Photograph file"), {
      target: { files: [file] },
    });
    fireEvent.change(dialog.getByLabelText("Photo caption"), {
      target: { value: "Recorded photo" },
    });
    fireEvent.click(
      dialog.getByRole("button", { name: "Upload sanitized copy" }),
    );
    await dialog.findByText(/Sanitized asset 30 is ready/);
    expect(upload.mock.calls[0][0].get("file")).toBe(file);
    expect(upload.mock.calls[0][0].get("caption")).toBe("Recorded photo");
    expect(upload.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(attach).not.toHaveBeenCalled();
    fireEvent.change(dialog.getByLabelText("Photo use"), {
      target: { value: "primary" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Attach photograph" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(attach.mock.calls[0][1]).toMatchObject({
      person_id: 1,
      role: "primary",
      expected_graph_revision: 1,
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "View photograph 30" }),
    );
    await screen.findByAltText("Recorded photo");
    expect(bytes).toHaveBeenCalledWith(
      30,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-session");
  });
  it("merge requires explicit scalar choices, re-preview and confirmation; commit reads alias and target", async () => {
    const preview = vi
      .spyOn(apiClient, "previewFamilyTreeMerge")
      .mockImplementation(async (payload) =>
        job("merge", mergeSummary(!payload.scalar_choices?.display_name)),
      );
    const commit = vi
      .spyOn(apiClient, "commitFamilyTreeMerge")
      .mockImplementation(async () => {
        revision++;
        vi.mocked(apiClient.getFamilyTreePerson).mockImplementation(
          async (id) =>
            id === 1
              ? {
                  ...detail(
                    {
                      ...source,
                      merged_into_person_id: 2,
                      archived_at: "today",
                    },
                    revision,
                  ),
                  canonical_person: target,
                }
              : detail(target, revision),
        );
        return mutation(revision, [1, 2]);
      });
    mount();
    const dialog = await open("Review duplicate and merge");
    fireEvent.change(dialog.getByLabelText("Canonical target person"), {
      target: { value: "2" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Preview merge" }));
    await dialog.findByText(/Choose every conflicting scalar/);
    expect(commit).not.toHaveBeenCalled();
    expect(
      dialog.getByRole("button", { name: "Commit reviewed merge" }),
    ).toBeDisabled();
    fireEvent.change(dialog.getByLabelText("Retain display_name"), {
      target: { value: "target" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Preview merge" }));
    await waitFor(() => expect(preview).toHaveBeenCalledTimes(2));
    fireEvent.click(
      dialog.getByLabelText("I reviewed the complete merge consequences."),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit reviewed merge" }),
    );
    await screen.findByText(/This is an alias record/);
    expect(preview.mock.calls[1][0]).toMatchObject({
      source_person_id: 1,
      target_person_id: 2,
      scalar_choices: { display_name: "target" },
    });
    expect(commit.mock.calls[0][0]).toMatchObject({
      preview_token: "literal-preview-token",
      expected_graph_revision: 1,
      idempotency_key: expect.any(String),
    });
    expect(apiClient.getFamilyTreePerson).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it("does not commit wrong-kind, expired or stale merge jobs even with display summary", async () => {
    const preview = vi
      .spyOn(apiClient, "previewFamilyTreeMerge")
      .mockResolvedValue(
        job("merge", mergeSummary(false), {
          expires_at: "2000-01-01T00:00:00Z",
        }),
      );
    const commit = vi.spyOn(apiClient, "commitFamilyTreeMerge");
    mount();
    const dialog = await open("Review duplicate and merge");
    fireEvent.change(dialog.getByLabelText("Canonical target person"), {
      target: { value: "2" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Preview merge" }));
    await dialog.findByText(/expired/i);
    expect(commit).not.toHaveBeenCalled();
    expect(
      dialog.getByRole("button", { name: "Commit reviewed merge" }),
    ).toBeDisabled();
    expect(preview).toHaveBeenCalledTimes(1);
  });
  it("purge requires authoritative owner capability, preserves password whitespace and clears it between preview and commit", async () => {
    const preview = vi
      .spyOn(apiClient, "previewFamilyTreePurge")
      .mockResolvedValue(
        job("purge", {
          person_id: 1,
          alias_only: false,
          retained_backup_policy: "Backups expire later",
          stories: 1,
          residences: 1,
          media_references: 1,
        }),
      );
    const commit = vi
      .spyOn(apiClient, "commitFamilyTreePurge")
      .mockImplementation(async () => {
        revision++;
        vi.mocked(apiClient.getFamilyTreePerson).mockRejectedValue(
          new ApiClientError(404, "Not found.", undefined),
        );
        return mutation(revision);
      });
    mount();
    const dialog = await open("Permanently purge person");
    fireEvent.change(dialog.getByLabelText("Owner password"), {
      target: { value: " password with whitespace " },
    });
    fireEvent.click(
      dialog.getByRole("button", { name: "Preview permanent purge" }),
    );
    await dialog.findByText("Backups expire later");
    expect(preview.mock.calls[0][1].password).toBe(
      " password with whitespace ",
    );
    expect(dialog.getByLabelText("Owner password")).toHaveValue("");
    fireEvent.change(dialog.getByLabelText("Owner password"), {
      target: { value: " password with whitespace " },
    });
    fireEvent.click(
      dialog.getByLabelText(
        "I understand this removes only this person irreversibly.",
      ),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit permanent purge" }),
    );
    await screen.findByText(
      /Purge confirmed by an authorized not-found readback/,
    );
    expect(commit.mock.calls[0][1].password).toBe(" password with whitespace ");
  });
  it("bulk export uses both manage and can_export, validates job readback and downloads private JSON bytes", async () => {
    const create = vi
      .spyOn(apiClient, "createFamilyTreeExport")
      .mockResolvedValue(
        job("export", {
          format: "json",
          people: 2,
          media: 0,
          media_omitted: true,
        }),
      );
    const read = vi
      .spyOn(apiClient, "getFamilyTreeExportJob")
      .mockResolvedValue(
        job("export", {
          format: "json",
          people: 2,
          media: 0,
          media_omitted: true,
        }),
      );
    const download = vi
      .spyOn(apiClient, "downloadFamilyTreeExport")
      .mockResolvedValue({
        bytes: new TextEncoder().encode('{"schema_version":1}').buffer,
        content_type: "application/json",
        filename: "../../unsafe.html",
      });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mount();
    const dialog = await open("Import or export family tree");
    fireEvent.change(dialog.getByLabelText("Export format"), {
      target: { value: "json" },
    });
    fireEvent.click(
      dialog.getByRole("button", { name: "Create logical export" }),
    );
    await dialog.findByText(/Metadata-only JSON/);
    fireEvent.click(
      dialog.getByRole("button", { name: "Download authorized export" }),
    );
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(
      { format: "json" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(read).toHaveBeenCalledWith(
      70,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await waitFor(() =>
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-session"),
    );
  });
  it("stages actual append File, requires duplicate-provenance review, commits and reads the committed job", async () => {
    const stage = vi
      .spyOn(apiClient, "stageFamilyTreeImport")
      .mockResolvedValue(job("import", importSummary(true)));
    const read = vi
      .spyOn(apiClient, "getFamilyTreeImportJob")
      .mockImplementation(async () =>
        job("import", importSummary(true), {
          state: revision === 1 ? "ready" : "committed",
          expected_graph_revision: 1,
        }),
      );
    const commit = vi
      .spyOn(apiClient, "commitFamilyTreeImport")
      .mockImplementation(async () => {
        revision++;
        return mutation(revision, [3, 4]);
      });
    mount();
    const dialog = await open("Import or export family tree");
    const file = new File(['{"schema_version":1}'], "backup.json", {
      type: "application/json",
    });
    fireEvent.change(dialog.getByLabelText("Append import file"), {
      target: { files: [file] },
    });
    fireEvent.click(
      dialog.getByRole("button", { name: "Stage append import" }),
    );
    await dialog.findByText(/Missing media: 1/);
    expect(stage.mock.calls[0][0].get("file")).toBe(file);
    expect(stage.mock.calls[0][0].get("expected_graph_revision")).toBe("1");
    fireEvent.click(
      dialog.getByLabelText(
        "I reviewed counts, missing media, warnings and append-only consequences.",
      ),
    );
    expect(
      dialog.getByRole("button", { name: "Commit append import" }),
    ).toBeDisabled();
    fireEvent.click(
      dialog.getByLabelText(
        "I reviewed prior package provenance and accept possible duplicates.",
      ),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit append import" }),
    );
    await dialog.findByText(/Import committed and read back/);
    expect(commit.mock.calls[0][1]).toMatchObject({
      confirmed: true,
      acknowledge_duplicate_provenance: true,
      expected_graph_revision: 1,
    });
    expect(read).toHaveBeenCalledTimes(3);
  });
  it("cancel is real import cancellation with exact cancelled-job readback", async () => {
    vi.spyOn(apiClient, "stageFamilyTreeImport").mockResolvedValue(
      job("import", importSummary()),
    );
    vi.spyOn(apiClient, "getFamilyTreeImportJob").mockResolvedValue(
      job("import", importSummary()),
    );
    const cancel = vi
      .spyOn(apiClient, "cancelFamilyTreeImport")
      .mockImplementation(async () => {
        vi.mocked(apiClient.getFamilyTreeImportJob).mockRejectedValue(
          new ApiClientError(409, "Job no longer available", {
            detail: {
              code: "transfer_expired",
              message: "Job no longer available",
            },
          }),
        );
        return job("import", importSummary(), { state: "canceled" });
      });
    mount();
    const dialog = await open("Import or export family tree");
    fireEvent.change(dialog.getByLabelText("Append import file"), {
      target: {
        files: [new File(["{}"], "input.json", { type: "application/json" })],
      },
    });
    fireEvent.click(
      dialog.getByRole("button", { name: "Stage append import" }),
    );
    await dialog.findByText(/Missing media: 1/);
    fireEvent.click(
      dialog.getByRole("button", { name: "Cancel staged import" }),
    );
    await dialog.findByText(/Staged import cancelled/);
    expect(
      (dialog.getByLabelText("Append import file") as HTMLInputElement).files,
    ).toHaveLength(0);
    expect(cancel).toHaveBeenCalledWith(
      70,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it("a failed staged-job readback cannot authorize import commit; an explicit successful preview refresh is required", async () => {
    vi.spyOn(apiClient, "stageFamilyTreeImport").mockResolvedValue(
      job("import", importSummary()),
    );
    const read = vi
      .spyOn(apiClient, "getFamilyTreeImportJob")
      .mockRejectedValueOnce(new Error("Readback interrupted"))
      .mockResolvedValue(job("import", importSummary()));
    const commit = vi.spyOn(apiClient, "commitFamilyTreeImport");
    mount();
    const dialog = await open("Import or export family tree");
    fireEvent.change(dialog.getByLabelText("Append import file"), {
      target: {
        files: [new File(["{}"], "input.json", { type: "application/json" })],
      },
    });
    fireEvent.click(
      dialog.getByRole("button", { name: "Stage append import" }),
    );
    await dialog.findByText("Readback interrupted");
    expect(
      dialog.getByRole("button", { name: "Commit append import" }),
    ).toBeDisabled();
    fireEvent.click(
      dialog.getByRole("button", { name: "Refresh staged import preview" }),
    );
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    fireEvent.click(
      dialog.getByLabelText(
        "I reviewed counts, missing media, warnings and append-only consequences.",
      ),
    );
    await waitFor(() =>
      expect(
        dialog.getByRole("button", { name: "Commit append import" }),
      ).toBeEnabled(),
    );
    expect(commit).not.toHaveBeenCalled();
  });
  it("an unknown import commit outcome retries the identical frozen receipt even when the server job is committed", async () => {
    vi.spyOn(apiClient, "stageFamilyTreeImport").mockResolvedValue(
      job("import", importSummary()),
    );
    vi.spyOn(apiClient, "getFamilyTreeImportJob").mockImplementation(async () =>
      job("import", importSummary(), {
        state: revision === 1 ? "ready" : "committed",
        expected_graph_revision: 1,
      }),
    );
    const commit = vi
      .spyOn(apiClient, "commitFamilyTreeImport")
      .mockImplementationOnce(async () => {
        revision++;
        throw new Error("Response interrupted after commit");
      })
      .mockImplementation(async () => ({
        ...mutation(revision, [3, 4]),
        replayed: true,
      }));
    mount();
    const dialog = await open("Import or export family tree");
    fireEvent.change(dialog.getByLabelText("Append import file"), {
      target: {
        files: [new File(["{}"], "input.json", { type: "application/json" })],
      },
    });
    fireEvent.click(
      dialog.getByRole("button", { name: "Stage append import" }),
    );
    await dialog.findByText(/Missing media: 1/);
    fireEvent.click(
      dialog.getByLabelText(
        "I reviewed counts, missing media, warnings and append-only consequences.",
      ),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit append import" }),
    );
    await dialog.findByText("Response interrupted after commit");
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit append import" }),
    );
    await dialog.findByText(/Import committed and read back/);
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[1][1]).toEqual(commit.mock.calls[0][1]);
  });
  it("reviewed merge chronology sends only the literal warning token and completes alias readback", async () => {
    vi.spyOn(apiClient, "previewFamilyTreeMerge").mockResolvedValue(
      job("merge", {
        ...mergeSummary(false),
        conflicting_fields: [],
        warnings: ["Uncertain chronology"],
      }),
    );
    const commit = vi
      .spyOn(apiClient, "commitFamilyTreeMerge")
      .mockRejectedValueOnce(
        new ApiClientError(409, "Review uncertainty", {
          detail: {
            code: "chronology_review",
            message: "Review uncertainty",
            warnings: ["Uncertain chronology"],
          },
        }),
      )
      .mockImplementation(async () => {
        revision++;
        vi.mocked(apiClient.getFamilyTreePerson).mockImplementation(
          async (id) =>
            id === 1
              ? {
                  ...detail({ ...source, merged_into_person_id: 2 }, revision),
                  canonical_person: target,
                }
              : detail(target, revision),
        );
        return mutation(revision, [1, 2]);
      });
    mount();
    const dialog = await open("Review duplicate and merge");
    fireEvent.change(dialog.getByLabelText("Canonical target person"), {
      target: { value: "2" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Preview merge" }));
    await dialog.findByRole("heading", { name: "Complete merge preview" });
    fireEvent.click(
      dialog.getByLabelText("I reviewed the complete merge consequences."),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit reviewed merge" }),
    );
    await dialog.findByText(/Review uncertainty/);
    expect(commit.mock.calls[0][0]).not.toHaveProperty("reviewed_warnings");
    fireEvent.click(
      dialog.getByLabelText("I reviewed the uncertain chronology warnings."),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Confirm reviewed chronology" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(commit.mock.calls[1][0].reviewed_warnings).toEqual([
      "chronology_review",
    ]);
  });
  it("a saved merge with interrupted alias readback exposes a read-only retry, not another mutation", async () => {
    vi.spyOn(apiClient, "previewFamilyTreeMerge").mockResolvedValue(
      job("merge", { ...mergeSummary(false), conflicting_fields: [] }),
    );
    const commit = vi
      .spyOn(apiClient, "commitFamilyTreeMerge")
      .mockImplementation(async () => {
        revision++;
        vi.mocked(apiClient.getFamilyTreePerson).mockRejectedValue(
          new Error("Alias readback interrupted"),
        );
        return mutation(revision, [1, 2]);
      });
    mount();
    const dialog = await open("Review duplicate and merge");
    fireEvent.change(dialog.getByLabelText("Canonical target person"), {
      target: { value: "2" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Preview merge" }));
    await dialog.findByRole("heading", { name: "Complete merge preview" });
    fireEvent.click(
      dialog.getByLabelText("I reviewed the complete merge consequences."),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Commit reviewed merge" }),
    );
    await dialog.findByText("Alias readback interrupted");
    expect(
      dialog.getByRole("button", { name: "Commit reviewed merge" }),
    ).toBeDisabled();
    vi.mocked(apiClient.getFamilyTreePerson).mockImplementation(async (id) =>
      id === 1
        ? {
            ...detail({ ...source, merged_into_person_id: 2 }, revision),
            canonical_person: target,
          }
        : detail(target, revision),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Retry saved merge readback" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });
  it("a stale preview keeps merge choices and offers explicit current-record reload before new preview", async () => {
    const preview = vi
      .spyOn(apiClient, "previewFamilyTreeMerge")
      .mockRejectedValueOnce(
        new ApiClientError(409, "Preview revision is stale", {
          detail: {
            code: "revision_conflict",
            message: "Preview revision is stale",
          },
        }),
      )
      .mockImplementation(async () =>
        job("merge", { ...mergeSummary(false), conflicting_fields: [] }),
      );
    mount();
    const dialog = await open("Review duplicate and merge");
    fireEvent.change(dialog.getByLabelText("Canonical target person"), {
      target: { value: "2" },
    });
    revision = 2;
    vi.mocked(apiClient.listFamilyTreePeople).mockResolvedValue({
      graph_revision: 2,
      items: [source, target],
      total: 2,
      next_cursor: null,
    });
    vi.mocked(apiClient.listFamilyTreeStories).mockResolvedValue({
      graph_revision: 2,
      items: [],
      next_cursor: null,
    });
    vi.mocked(apiClient.listFamilyTreeResidences).mockResolvedValue({
      graph_revision: 2,
      items: [],
      next_cursor: null,
    });
    fireEvent.click(dialog.getByRole("button", { name: "Preview merge" }));
    await dialog.findByText("Preview revision is stale");
    fireEvent.click(
      dialog.getByRole("button", {
        name: "Reload current records for a new preview",
      }),
    );
    await waitFor(() =>
      expect(
        dialog.getByRole("button", { name: "Preview merge" }),
      ).toBeEnabled(),
    );
    expect(dialog.getByLabelText("Canonical target person")).toHaveValue("2");
    fireEvent.click(dialog.getByRole("button", { name: "Preview merge" }));
    await dialog.findByRole("heading", { name: "Complete merge preview" });
    expect(preview.mock.calls[1][0].expected_graph_revision).toBe(2);
  });
  it("an expired import is released locally only after an exact denied job readback", async () => {
    vi.spyOn(apiClient, "stageFamilyTreeImport").mockResolvedValue(
      job("import", importSummary()),
    );
    const expired = new ApiClientError(409, "Expired staging", {
      detail: { code: "transfer_expired", message: "Expired staging" },
    });
    const read = vi
      .spyOn(apiClient, "getFamilyTreeImportJob")
      .mockResolvedValueOnce(job("import", importSummary()))
      .mockRejectedValue(expired);
    vi.spyOn(apiClient, "cancelFamilyTreeImport").mockRejectedValue(expired);
    mount();
    const dialog = await open("Import or export family tree");
    fireEvent.change(dialog.getByLabelText("Append import file"), {
      target: {
        files: [new File(["{}"], "input.json", { type: "application/json" })],
      },
    });
    fireEvent.click(
      dialog.getByRole("button", { name: "Stage append import" }),
    );
    await dialog.findByRole("heading", { name: "Complete append preview" });
    fireEvent.click(
      dialog.getByRole("button", { name: "Cancel staged import" }),
    );
    await dialog.findByText(
      /Staged import expired or unavailable; exact job readback confirmed/,
    );
    expect(read).toHaveBeenCalledTimes(2);
    expect(
      (dialog.getByLabelText("Append import file") as HTMLInputElement).files,
    ).toHaveLength(0);
  });
  it("purge alias blockers are explicit and never submit a canonical purge", async () => {
    vi.spyOn(apiClient, "previewFamilyTreePurge").mockRejectedValue(
      new ApiClientError(409, "Aliases remain", {
        detail: {
          code: "merge_aliases_present",
          message: "Aliases remain",
          blocking_alias_ids: [8, 9],
        },
      }),
    );
    const commit = vi.spyOn(apiClient, "commitFamilyTreePurge");
    mount();
    const dialog = await open("Permanently purge person");
    fireEvent.change(dialog.getByLabelText("Owner password"), {
      target: { value: " owner password " },
    });
    fireEvent.click(
      dialog.getByRole("button", { name: "Preview permanent purge" }),
    );
    await dialog.findByText(/Blocking alias person IDs: 8, 9/);
    expect(dialog.getByLabelText("Owner password")).toHaveValue("");
    expect(commit).not.toHaveBeenCalled();
  });
  it("view-only and negative owner/export capabilities never expose bulk/purge mutation controls", async () => {
    capabilities = { can_manage: true, can_export: false, can_purge: false };
    mount();
    await screen.findByRole("heading", { name: "Alex" });
    expect(
      screen.queryByRole("button", { name: "Permanently purge person" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Import or export family tree" }),
    ).toBeInTheDocument();
    const dialog = await open("Import or export family tree");
    expect(
      dialog.queryByRole("button", { name: "Create logical export" }),
    ).not.toBeInTheDocument();
  });
});
