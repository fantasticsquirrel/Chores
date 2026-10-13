import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../../../../api/client";
import type * as FT from "@family-manager/family-api/models";
import { TreeWorkflow } from "../workflows/treeWorkflow";
import { ToolRuntime, type FilePort } from "./runtime";
import { MediaWorkflow } from "./mediaWorkflow";
import { MergePurgeWorkflow } from "./mergePurgeWorkflow";
import { TransferWorkflow } from "./transferWorkflow";
const person = {
  id: 3,
  display_name: "Ada",
  first_name: null,
  last_name: null,
  aliases: [],
  is_locked: false,
  archived_at: null,
  merged_into_person_id: null,
} as unknown as FT.FamilyTreePerson;
const target = { ...person, id: 4 };
const mergeSummary = {
  source: person,
  target,
  conflicting_fields: [],
  unresolved_fields: [],
  relationship_changes: [],
  retained_records: {
    stories: 1,
    residences: 0,
    tags: 0,
    names: 0,
    media_references: 0,
  },
  retargeted_alias_ids: [8],
  similar_partner_episode_ids: [],
  requires_partner_review: false,
  warnings: [],
};
const purgeSummary = {
  person_id: 3,
  alias_only: false,
  retained_backup_policy: "Backups follow retention",
  stories: 1,
  residences: 0,
  media_references: 0,
};
const importSummary = {
  people: 1,
  relationships: 0,
  stories: 0,
  residences: 0,
  media: 0,
  missing_media: 1,
  warnings: ["chronology_review"],
  duplicate_provenance: true,
  duplicate_suggestions: [{ source_key: "p1", candidate_person_ids: [4] }],
  unsupported_fields: [],
};
const asset = {
  id: 11,
  state: "ready",
  mime_type: "image/png",
  byte_size: 3,
  checksum: "sum",
  width: 1,
  height: 1,
  caption: null,
};
const reference = {
  id: 12,
  asset_id: 11,
  person_id: 3,
  story_id: null,
  role: "gallery",
  asset,
};
const options = expect.objectContaining({ signal: expect.any(AbortSignal) });
let revision: number,
  api: ApiClient,
  core: TreeWorkflow,
  r: ToolRuntime,
  m: MediaWorkflow,
  d: MergePurgeWorkflow,
  t: TransferWorkflow,
  files: FilePort;
const job = (
  kind: string,
  summary: Record<string, unknown>,
): FT.FamilyTreePreview => ({
  id: 9,
  kind,
  state: "ready",
  expected_graph_revision: revision,
  expires_at: "2099-01-01T00:00:00Z",
  summary,
  preview_token: "preview-token",
});
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
function result(): FT.FamilyTreeMutationResult {
  return {
    committed_revision: ++revision,
    current_revision: revision,
    replayed: false,
    affected: {
      person_ids: [3, 4],
      relationship_ids: [],
      story_ids: [],
      residence_ids: [],
      identity_link_ids: [],
      media_asset_ids: [11],
      media_reference_ids: [12],
    },
    warnings: [],
  };
}
beforeEach(async () => {
  revision = 2;
  api = {
    authenticationGeneration: 1,
    withAuthentication: vi.fn(async (_generation, call, current) => {
      if (!current()) throw new Error("session changed");
      return call();
    }),
    getMyModules: vi.fn(async () => ({
      modules: [{ key: "family-tree", can_manage: true }],
    })),
    getFamilyTreeCollection: vi.fn(async () => ({
      state: "initialized",
      collection_id: 1,
      title: "Tree",
      graph_revision: revision,
      default_focus_person_id: null,
      active_people_count: 2,
      archived_people_count: 0,
      capabilities: { can_manage: true, can_export: true, can_purge: true },
    })),
    listFamilyTreePeople: vi.fn(async () => ({
      graph_revision: revision,
      items: [person, target],
      total: 2,
      next_cursor: null,
    })),
    getFamilyTreeGraph: vi.fn(async () => ({
      graph_revision: revision,
      focus_person_id: null,
      nodes: [],
      edges: [],
      warnings: [],
      truncated: false,
      expansion_token: null,
      projection_limits: {
        max_nodes: 250,
        max_edges: 500,
        hard_max_nodes: 500,
        hard_max_edges: 1000,
      },
    })),
    getFamilyTreePerson: vi.fn(async (id: number) => ({
      graph_revision: revision,
      person: id === 4 ? target : person,
      canonical_person: null,
      parent_links: [],
      care_links: [],
      partner_episodes: [],
      identity_link: null,
    })),
    listFamilyTreeStories: vi.fn(async () => ({
      graph_revision: revision,
      items: [],
      next_cursor: null,
    })),
    listFamilyTreeResidences: vi.fn(async () => ({
      graph_revision: revision,
      items: [],
      next_cursor: null,
    })),
    uploadFamilyTreeMedia: vi.fn(async () => asset),
    listFamilyTreeMediaReferences: vi.fn(async () => [reference]),
    getFamilyTreeMediaContent: vi.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3]).buffer,
      content_type: "image/png",
      filename: null,
    })),
    attachFamilyTreeMedia: vi.fn(async () => result()),
    removeFamilyTreeMediaReference: vi.fn(async () => result()),
    previewFamilyTreeMerge: vi.fn(async () => job("merge", mergeSummary)),
    commitFamilyTreeMerge: vi.fn(async () => result()),
    previewFamilyTreePurge: vi.fn(async () => job("purge", purgeSummary)),
    commitFamilyTreePurge: vi.fn(async () => result()),
    createFamilyTreeExport: vi.fn(async () =>
      job("export", {
        format: "zip",
        people: 2,
        media: 1,
        media_omitted: false,
      }),
    ),
    getFamilyTreeExportJob: vi.fn(async () =>
      job("export", {
        format: "zip",
        people: 2,
        media: 1,
        media_omitted: false,
      }),
    ),
    downloadFamilyTreeExport: vi.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3]).buffer,
      content_type: "application/zip",
      filename: "export.zip",
    })),
    stageFamilyTreeImport: vi.fn(async () => job("import", importSummary)),
    getFamilyTreeImportJob: vi.fn(async () => job("import", importSummary)),
    commitFamilyTreeImport: vi.fn(async () => result()),
    cancelFamilyTreeImport: vi.fn(async () => ({
      ...job("import", importSummary),
      state: "canceled",
    })),
  } as unknown as ApiClient;
  core = new TreeWorkflow(
    api,
    { userId: 1, householdId: 27, role: "PARENT" },
    () => {},
  );
  await core.refresh();
  await core.select(3);
  const selection = () => ({
    uri: "file:///cache/family-tree-owned/image.png",
    name: "photograph.png",
    type: "image/png",
    size: 3,
    release: vi.fn(),
  });
  files = {
    pickPhotograph: vi.fn(async () => selection()),
    pickPackage: vi.fn(async () => ({
      ...selection(),
      name: "family-tree.zip",
      type: "application/zip",
    })),
    multipart: vi.fn(() => new FormData()),
    shareDownload: vi.fn(async () => {}),
  };
  r = new ToolRuntime(api, core, files);
  m = new MediaWorkflow(r);
  d = new MergePurgeWorkflow(r);
  t = new TransferWorkflow(r);
});
describe("native FT3 real controller / actual method seam", () => {
  it("never silently rebinds a reviewed conflict to a later unreviewed collection revision", async () => {
    const post = vi.fn(async (_id: number, body: FT.FamilyTreeCommand) => {
      if (body.expected_graph_revision !== revision) throw Object.assign(
        new Error("Conflict"), { code: "revision_conflict" },
      );
      return result();
    });
    Object.assign(api, { patchFamilyTreePerson: post });
    revision = 3;
    expect(await core.mutate({ type: "patchPerson", personId: 3,
      changes: { first_name: "Retained" } }, 2)).toBe(false);
    await core.reviewConflict();
    expect(core.state.pending?.latestReviewed).toBe(true);
    revision = 4;
    await core.refresh();
    expect(await core.reapply()).toBe(false);
    expect(post).toHaveBeenCalledTimes(1);
    expect(core.state.pending?.latestReviewed).toBe(false);
    await core.reviewConflict();
    expect(await core.reapply()).toBe(true);
    expect(post.mock.calls[1][1].expected_graph_revision).toBe(4);
    expect(post.mock.calls[1][1].idempotency_key).not.toBe(post.mock.calls[0][1].idempotency_key);
  });
  it.each(["core", "purge", "merge", "media", "import"] as const)(
    "hides but retains a known %s ACK through repeated discovery outages and GET-only recovery",
    async (kind) => {
      const patch = vi.fn(async () => result());
      Object.assign(api, { patchFamilyTreePerson: patch });
      if (kind === "purge") await d.previewPurge(3, "fresh password");
      if (kind === "merge") await d.previewMerge(3, 4, {}, true);
      if (kind === "media") await m.choose();
      if (kind === "import") { await t.chooseImport(); await t.stage(); }
      vi.mocked(api.getMyModules).mockRejectedValueOnce(
        new Error("Discovery unavailable"),
      );
      const mutation = kind === "core"
        ? core.mutate({ type: "patchPerson", personId: 3,
            changes: { first_name: "Retained" } })
        : kind === "purge" ? d.commitPurge(3, "fresh password", true)
        : kind === "merge" ? d.commitMerge(3, 4, true)
        : kind === "media" ? m.attach(3, "primary", null)
        : t.commit(true, true);
      await mutation.catch((error: Error) => {
        expect(error.message).toBe("Family Tree access changed.");
      });
      const receipt = core.state.lastCommit;
      expect(receipt?.committed_revision).toBe(3);
      expect(core.state.readbackPending).toBe(true);
      expect(core.state.access).toBe("error");
      expect(core.state.detail).toBeNull();
      expect(core.state.collection).toBeNull();
      expect(core.state.pending).toBeNull();
      expect(core.state.toolsPending).toBe(false);
      expect(d.pendingPurge).toBe(false);
      expect(d.pendingMerge).toBe(false);
      expect(m.pending).toBe(false);
      expect(t.pending).toBe(false);
      expect(await core.retryMutation()).toBe(false);
      vi.mocked(api.getMyModules).mockRejectedValueOnce(
        new Error("Discovery still unavailable"),
      );
      await core.refresh();
      expect(core.state.lastCommit).toBe(receipt);
      expect(core.state.readbackPending).toBe(true);
      vi.mocked(api.getFamilyTreeCollection).mockRejectedValueOnce(
        new Error("Collection readback unavailable"),
      );
      await core.refresh();
      expect(core.state.access).toBe("manage");
      expect(core.state.lastCommit).toBe(receipt);
      expect(core.state.readbackPending).toBe(true);
      await core.refresh();
      expect(core.state.collection?.graph_revision).toBe(3);
      expect(core.state.lastCommit).toBe(receipt);
      expect(core.state.readbackPending).toBe(false);
      expect(patch).toHaveBeenCalledTimes(kind === "core" ? 1 : 0);
      expect(api.commitFamilyTreePurge).toHaveBeenCalledTimes(kind === "purge" ? 1 : 0);
      expect(api.commitFamilyTreeMerge).toHaveBeenCalledTimes(kind === "merge" ? 1 : 0);
      expect(api.attachFamilyTreeMedia).toHaveBeenCalledTimes(kind === "media" ? 1 : 0);
      expect(api.commitFamilyTreeImport).toHaveBeenCalledTimes(kind === "import" ? 1 : 0);
    },
  );
  it.each(["denied", "missing grant", "authentication", "dispose"] as const)(
    "clears a known pending receipt on affirmative %s invalidation",
    async (kind) => {
      Object.assign(api, { patchFamilyTreePerson: vi.fn(async () => result()) });
      vi.mocked(api.getFamilyTreeCollection).mockRejectedValueOnce(
        new Error("Collection readback unavailable"),
      );
      await core.mutate({ type: "patchPerson", personId: 3,
        changes: { first_name: "Retained" } });
      expect(core.state.lastCommit?.committed_revision).toBe(3);
      expect(core.state.readbackPending).toBe(true);
      if (kind === "authentication") core.invalidateAuthentication();
      else if (kind === "dispose") core.dispose();
      else {
        if (kind === "denied") vi.mocked(api.getMyModules).mockRejectedValueOnce(
          Object.assign(new Error("Access denied"), { status: 403 }),
        );
        else vi.mocked(api.getMyModules).mockResolvedValueOnce({ modules: [] });
        await core.refresh();
      }
      expect(core.state.access).toBe("denied");
      expect(core.state.lastCommit).toBeNull();
      expect(core.state.readbackPending).toBe(false);
      expect(core.state.detail).toBeNull();
    },
  );
  it.each(["reapply", "chronology"] as const)(
    "retains the known receipt across %s ACK/readback failure and only retries GETs",
    async (phase) => {
      const post = vi
        .fn(async (_id: number, _body: FT.FamilyTreeCommand) => result())
        .mockRejectedValueOnce(
          Object.assign(new Error("Review"), {
            code:
              phase === "reapply" ? "revision_conflict" : "chronology_review",
          }),
        );
      Object.assign(api, { patchFamilyTreePerson: post });
      await core.mutate({
        type: "patchPerson",
        personId: 3,
        changes: { first_name: "Retained" },
      });
      const first = post.mock.calls[0][1] as FT.FamilyTreeCommand;
      if (phase === "reapply") {
        revision = 3;
        await core.reviewConflict();
      }
      vi.mocked(api.getFamilyTreeCollection).mockRejectedValueOnce(
        new Error("Readback unavailable"),
      );
      expect(
        await (phase === "reapply" ? core.reapply() : core.confirmChronology()),
      ).toBe(true);
      expect(core.state.lastCommit).toMatchObject({
        committed_revision: revision,
      });
      expect(core.state.readbackPending).toBe(true);
      expect(core.state.pending).toBeNull();
      const second = post.mock.calls[1][1] as FT.FamilyTreeCommand;
      expect(second.idempotency_key).not.toBe(first.idempotency_key);
      expect(await core.retryMutation()).toBe(false);
      await core.refresh();
      expect(post).toHaveBeenCalledTimes(2);
      expect(core.state.readbackPending).toBe(false);
    },
  );

  it("keeps an uncertain advanced receipt hidden through failed network discovery and resumes only after authoritative success", async () => {
    await m.choose();
    vi.mocked(api.attachFamilyTreeMedia).mockRejectedValueOnce(
      new Error("Unknown outcome"),
    );
    await expect(m.attach(3, "primary", null)).rejects.toThrow();
    const body = vi.mocked(api.attachFamilyTreeMedia).mock.calls[0][1];
    vi.mocked(api.getMyModules).mockRejectedValueOnce(
      new Error("Discovery unavailable"),
    );
    await core.refresh();
    expect(core.state.access).toBe("error");
    expect(m.pending).toBe(true);
    expect(m.uploaded?.id).toBe(11);
    await expect(m.attach(3, "primary", null)).rejects.toThrow(
      "access changed",
    );
    expect(api.attachFamilyTreeMedia).toHaveBeenCalledTimes(1);
    await core.refresh();
    await m.attach(3, "primary", null);
    expect(vi.mocked(api.attachFamilyTreeMedia).mock.calls[1][1]).toBe(body);
    expect(api.uploadFamilyTreeMedia).toHaveBeenCalledTimes(1);
  });
  it("clears all sensitive decisions on an affirmative manage downgrade, including an unknown purge receipt", async () => {
    await d.previewPurge(3, "password");
    vi.mocked(api.commitFamilyTreePurge).mockRejectedValueOnce(
      new Error("Unknown outcome"),
    );
    await expect(d.commitPurge(3, "password", true)).rejects.toThrow();
    vi.mocked(api.getMyModules).mockResolvedValue({
      modules: [
        {
          key: "family-tree",
          name: "Tree",
          description: "Tree",
          can_manage: false,
        },
      ],
    });
    await core.refresh();
    expect(core.state.access).toBe("view");
    expect(d.purge).toBeNull();
    expect(d.pendingPurge).toBe(false);
    expect(core.state.toolsPending).toBe(false);
    expect(r.closed).toBe(true);
  });

  it("retains a known core mutation receipt before readback failure and recovers with GETs only", async () => {
    Object.assign(api, { patchFamilyTreePerson: vi.fn(async () => result()) });
    vi.mocked(api.getFamilyTreeCollection).mockRejectedValueOnce(
      new Error("Readback unavailable"),
    );
    expect(
      await core.mutate({
        type: "patchPerson",
        personId: 3,
        changes: { first_name: "Entered" },
      }),
    ).toBe(true);
    expect(core.state.lastCommit).toMatchObject({ committed_revision: 3 });
    expect(core.state.pending).toBeNull();
    expect(await core.retryMutation()).toBe(false);
    await core.refresh();
    expect(api.patchFamilyTreePerson).toHaveBeenCalledTimes(1);
    expect(core.state.collection?.graph_revision).toBe(3);
  });
  it("records a known purge receipt before failed GETs without replaying the POST", async () => {
    await d.previewPurge(3, "password");
    vi.mocked(api.getFamilyTreeCollection).mockRejectedValueOnce(
      new Error("Readback unavailable"),
    );
    await d.commitPurge(3, "password", true);
    expect(core.state.lastCommit).toMatchObject({ committed_revision: 3 });
    expect(d.pendingPurge).toBe(false);
    await expect(d.commitPurge(3, "fresh", true)).rejects.toThrow();
    await core.refresh();
    expect(api.commitFamilyTreePurge).toHaveBeenCalledTimes(1);
  });
  it("retries an unknown purge with frozen facts/revision/key despite stale preview, and fresh authentication per attempt", async () => {
    await d.previewPurge(3, "old password");
    vi.mocked(api.commitFamilyTreePurge).mockRejectedValueOnce(
      new Error("Unknown outcome"),
    );
    await expect(d.commitPurge(3, "old password", true)).rejects.toThrow();
    const original = vi.mocked(api.commitFamilyTreePurge).mock.calls[0][1];
    revision = 3;
    await core.refresh();
    await d.commitPurge(3, "new password", true);
    const retried = vi.mocked(api.commitFamilyTreePurge).mock.calls[1][1];
    expect(retried).toEqual({ ...original, password: "new password" });
    expect(retried.expected_graph_revision).toBe(2);
    expect(JSON.stringify(d)).not.toContain("old password");
    expect(JSON.stringify(d)).not.toContain("new password");
  });
  it("binds a photograph draft to its target snapshot, not a later collection floor", async () => {
    await m.choose();
    revision = 3;
    await core.refresh();
    await m.attach(3, "primary", null);
    expect(api.attachFamilyTreeMedia).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ expected_graph_revision: 2 }),
      options,
    );
  });

  it("does not republish private references when invalidation lands between request and controller publication", async () => {
    let scheduled = false;
    r.subscribe(() => {
      if (
        !r.working &&
        !scheduled &&
        vi.mocked(api.listFamilyTreeMediaReferences).mock.calls.length
      ) {
        scheduled = true;
        queueMicrotask(() => core.invalidateAuthentication());
      }
    });
    await expect(m.load(3)).rejects.toThrow("access changed");
    expect(m.references).toEqual([]);
  });
  it("interrupts an explicit export share, releases the owned temporary and reports abort instead of success", async () => {
    const pending = deferred<void>(),
      release = vi.fn();
    vi.mocked(files.shareDownload).mockImplementationOnce(
      async (_bytes, _current, track) => {
        const untrack = track!(release);
        await pending.promise;
        untrack();
      },
    );
    await t.createExport("zip");
    const task = t.download();
    await vi.waitFor(() => expect(files.shareDownload).toHaveBeenCalled());
    r.interrupt();
    expect(release).toHaveBeenCalled();
    pending.resolve();
    await expect(task).rejects.toMatchObject({ name: "AbortError" });
  });

  it("reserves coarse command ownership after an uncertain advanced outcome until explicit original retry/discard", async () => {
    Object.assign(api, { createFamilyTreePerson: vi.fn(async () => result()) });
    await m.choose();
    vi.mocked(api.attachFamilyTreeMedia).mockRejectedValueOnce(
      new Error("timeout"),
    );
    await expect(m.attach(3, "primary", null)).rejects.toThrow("timeout");
    expect(
      await core.mutate({
        type: "createPerson",
        person: { display_name: "Do not race" },
      }),
    ).toBe(false);
    expect(core.state.pending).toBeNull();
    expect(api.createFamilyTreePerson).not.toHaveBeenCalled();
    await expect(t.createExport("zip")).rejects.toThrow();
    expect(api.createFamilyTreeExport).not.toHaveBeenCalled();
    await m.attach(3, "primary", null);
    expect(m.pending).toBe(false);
  });

  it.each(["primary", "gallery", "story"] as const)(
    "stages and revision-attaches %s media, then refetches affected core and references",
    async (role) => {
      await m.choose();
      m.caption = "Caption";
      await m.attach(3, role, role === "story" ? 5 : null);
      expect(api.uploadFamilyTreeMedia).toHaveBeenCalledWith(
        expect.any(FormData),
        options,
      );
      expect(api.attachFamilyTreeMedia).toHaveBeenCalledWith(
        11,
        expect.objectContaining({
          person_id: 3,
          role,
          story_id: role === "story" ? 5 : null,
          expected_graph_revision: 2,
          idempotency_key: expect.any(String),
        }),
        options,
      );
      expect(api.listFamilyTreeMediaReferences).toHaveBeenCalledWith(
        3,
        options,
      );
      expect(core.state.collection?.graph_revision).toBe(3);
      expect(api.getFamilyTreeGraph).toHaveBeenCalledTimes(2);
    },
  );
  it("preserves staged asset and exact command/key on attach timeout; never uploads it again", async () => {
    vi.mocked(api.attachFamilyTreeMedia).mockRejectedValueOnce(
      new Error("timeout"),
    );
    await m.choose();
    await expect(m.attach(3, "primary", null)).rejects.toThrow("timeout");
    const body = vi.mocked(api.attachFamilyTreeMedia).mock.calls[0][1];
    expect(m.uploaded?.id).toBe(11);
    expect(m.pending).toBe(true);
    await expect(m.attach(3, "gallery", null)).rejects.toThrow(
      "target changed",
    );
    await m.attach(3, "primary", null);
    expect(api.uploadFamilyTreeMedia).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.attachFamilyTreeMedia).mock.calls[1][1]).toBe(body);
  });
  it("views actual byte content in memory and removes only the chosen revisioned reference", async () => {
    await m.load(3);
    await m.view(11);
    expect(m.image).toBe("data:image/png;base64,AQID");
    expect(api.getFamilyTreeMediaContent).toHaveBeenCalledWith(11, options);
    expect(files.shareDownload).not.toHaveBeenCalled();
    await m.remove(3, reference);
    expect(api.removeFamilyTreeMediaReference).toHaveBeenCalledWith(
      11,
      12,
      expect.objectContaining({
        expected_graph_revision: 2,
        idempotency_key: expect.any(String),
      }),
      options,
    );
  });
  it("prevents known locked/alias/archived inputs and allows read-only media reads only", async () => {
    core.state = {
      ...core.state,
      detail: { ...core.state.detail!, person: { ...person, is_locked: true } },
    };
    await expect(m.attach(3, "gallery", null)).rejects.toThrow();
    expect(api.uploadFamilyTreeMedia).not.toHaveBeenCalled();
    core.state = { ...core.state, access: "view" };
    r.reset();
    r = new ToolRuntime(api, core, files);
    m = new MediaWorkflow(r);
    await m.load(3);
    await expect(m.choose()).rejects.toThrow();
    expect(files.pickPhotograph).not.toHaveBeenCalled();
  });
  it("previews/cancels merge and retains immutable retry identity for a committed-target readback", async () => {
    await d.previewMerge(3, 4, { display_name: "source" }, true);
    expect(api.previewFamilyTreeMerge).toHaveBeenCalledWith(
      {
        source_person_id: 3,
        target_person_id: 4,
        scalar_choices: { display_name: "source" },
        retain_similar_partner_episodes: true,
        expected_graph_revision: 2,
      },
      options,
    );
    d.cancelMerge();
    expect(api.commitFamilyTreeMerge).not.toHaveBeenCalled();
    await d.previewMerge(3, 4, {}, false);
    vi.mocked(api.commitFamilyTreeMerge).mockRejectedValueOnce(
      new Error("timeout"),
    );
    await expect(d.commitMerge(3, 4, true)).rejects.toThrow();
    const body = vi.mocked(api.commitFamilyTreeMerge).mock.calls[0][0];
    await expect(d.previewMerge(3, 4, {}, false)).rejects.toThrow("uncertain");
    await d.commitMerge(3, 4, true);
    expect(vi.mocked(api.commitFamilyTreeMerge).mock.calls[1][0]).toBe(body);
    expect(core.state.selectedId).toBe(4);
    expect(core.state.detail?.person.id).toBe(4);
  });
  it.each([
    { kind: "purge" },
    { expected_graph_revision: 1 },
    { expires_at: "2000-01-01" },
    { state: "committed" },
  ])("rejects invalid merge preview %j", async (change) => {
    vi.mocked(api.previewFamilyTreeMerge).mockResolvedValueOnce({
      ...job("merge", mergeSummary),
      ...change,
    });
    await expect(d.previewMerge(3, 4, {}, false)).rejects.toThrow(
      "invalid or stale",
    );
    expect(d.merge).toBeNull();
  });
  it("rejects unresolved scalar and unreviewed episode previews, and target-specific consent", async () => {
    await d.previewMerge(3, 4, {}, false);
    d.merge!.summary = { ...mergeSummary, unresolved_fields: ["display_name"] };
    await expect(d.commitMerge(3, 4, true)).rejects.toThrow();
    d.merge!.summary = { ...mergeSummary, requires_partner_review: true };
    await expect(d.commitMerge(3, 4, true)).rejects.toThrow();
    d.merge!.summary = mergeSummary;
    await expect(d.commitMerge(3, 3, true)).rejects.toThrow();
    await expect(d.commitMerge(3, 4, false)).rejects.toThrow();
    expect(api.commitFamilyTreeMerge).not.toHaveBeenCalled();
  });
  it("capability-gates purge independently of role and keeps whitespace/password only in request memory", async () => {
    core.state = {
      ...core.state,
      collection: {
        ...core.state.collection!,
        capabilities: { can_manage: true, can_export: true, can_purge: false },
      },
    };
    await expect(d.previewPurge(3, " pass ")).rejects.toThrow();
    expect(api.previewFamilyTreePurge).not.toHaveBeenCalled();
    core.state.collection!.capabilities.can_purge = true;
    await d.previewPurge(3, " pass ");
    expect(api.previewFamilyTreePurge).toHaveBeenCalledWith(
      3,
      { password: " pass ", expected_graph_revision: 2 },
      options,
    );
    expect(core.state.pending).toBeNull();
    vi.mocked(api.commitFamilyTreePurge).mockRejectedValueOnce(
      new Error("timeout"),
    );
    await expect(d.commitPurge(3, " pass ", true)).rejects.toThrow();
    const body = vi.mocked(api.commitFamilyTreePurge).mock.calls[0][1];
    await d.commitPurge(3, "fresh password", true);
    expect(vi.mocked(api.commitFamilyTreePurge).mock.calls[1][1]).toEqual({
      ...body,
      password: "fresh password",
    });
    expect(core.state.selectedId).toBeNull();
    expect(d.purge).toBeNull();
  });
  it("preserves structured same-household alias blockers without force/cascade retry", async () => {
    vi.mocked(api.previewFamilyTreePurge).mockRejectedValueOnce(
      Object.assign(new Error("Purge listed aliases first"), {
        code: "merge_aliases_present",
        status: 409,
        data: { detail: { blocking_alias_ids: [8] } },
      }),
    );
    await expect(d.previewPurge(3, "pass")).rejects.toMatchObject({
      code: "merge_aliases_present",
    });
    expect(d.purge).toBeNull();
    expect(r.blockingAliasIds).toEqual([8]);
    expect(api.commitFamilyTreePurge).not.toHaveBeenCalled();
  });
  it("create/poll/download export all recheck manage plus export capability, including GET", async () => {
    await t.createExport("zip");
    await t.pollExport();
    await t.download();
    expect(api.createFamilyTreeExport).toHaveBeenCalledWith(
      { format: "zip" },
      options,
    );
    expect(api.getFamilyTreeExportJob).toHaveBeenCalledWith(9, options);
    expect(api.downloadFamilyTreeExport).toHaveBeenCalledWith(9, options);
    expect(files.shareDownload).toHaveBeenCalledWith(
      expect.objectContaining({ bytes: expect.any(ArrayBuffer) }),
      expect.any(Function),
      r.trackTransfer,
    );
    core.state.access = "view";
    await expect(t.download()).rejects.toThrow();
    expect(api.downloadFamilyTreeExport).toHaveBeenCalledTimes(1);
  });
  it("picks/uploads/polls human preview and confirms append with explicit provenance/warnings and immutable timeout retry", async () => {
    await t.chooseImport();
    await t.stage();
    expect(files.multipart).toHaveBeenCalledWith(
      expect.objectContaining({ name: "family-tree.zip" }),
      { expected_graph_revision: "2" },
    );
    expect(api.stageFamilyTreeImport).toHaveBeenCalledWith(
      expect.any(FormData),
      options,
    );
    await t.pollImport();
    expect(api.getFamilyTreeImportJob).toHaveBeenCalledWith(9, options);
    await expect(t.commit(false, true)).rejects.toThrow();
    await expect(t.commit(true, false)).rejects.toThrow();
    vi.mocked(api.commitFamilyTreeImport).mockRejectedValueOnce(
      new Error("timeout"),
    );
    await expect(t.commit(true, true)).rejects.toThrow();
    const body = vi.mocked(api.commitFamilyTreeImport).mock.calls[0][1];
    expect(body).toMatchObject({
      expected_graph_revision: 2,
      confirmed: true,
      acknowledge_duplicate_provenance: true,
      reviewed_warnings: ["chronology_review"],
      idempotency_key: expect.any(String),
    });
    await t.commit(true, true);
    expect(vi.mocked(api.commitFamilyTreeImport).mock.calls[1][1]).toBe(body);
    expect(t.importing).toBeNull();
    expect(core.state.collection?.graph_revision).toBe(3);
  });
  it("cancels the exact stage with no body and retains it on an unconfirmed cancellation", async () => {
    await t.chooseImport();
    await t.stage();
    vi.mocked(api.cancelFamilyTreeImport).mockResolvedValueOnce({
      ...job("import", importSummary),
      state: "ready",
    });
    await expect(t.cancel()).rejects.toThrow("not confirmed");
    expect(t.importing?.id).toBe(9);
    await t.cancel();
    expect(api.cancelFamilyTreeImport).toHaveBeenLastCalledWith(9, options);
    expect(t.importing).toBeNull();
    expect(api.commitFamilyTreeImport).not.toHaveBeenCalled();
  });
  it("never clamps stale import revision or merge preview after refreshed core", async () => {
    await t.chooseImport();
    await t.stage();
    revision++;
    await core.refresh();
    await expect(t.commit(true, true)).rejects.toThrow();
    expect(api.commitFamilyTreeImport).not.toHaveBeenCalled();
    expect(t.importing?.expected_graph_revision).toBe(2);
  });
  it("abort is not rollback: retains exact attachment body/key and prevents simultaneous core write", async () => {
    const pending = deferred<FT.FamilyTreeMutationResult>();
    vi.mocked(api.attachFamilyTreeMedia).mockImplementationOnce(
      (_id, _body, o) => {
        o!.signal!.addEventListener("abort", () =>
          pending.reject(new DOMException("Aborted", "AbortError")),
        );
        return pending.promise;
      },
    );
    await m.choose();
    const task = m.attach(3, "primary", null);
    await vi.waitFor(() =>
      expect(api.attachFamilyTreeMedia).toHaveBeenCalledTimes(1),
    );
    expect(
      await core.mutate({
        type: "createPerson",
        person: { display_name: "New" },
      }),
    ).toBe(false);
    r.interrupt();
    await expect(task).rejects.toMatchObject({ name: "AbortError" });
    expect(m.uploaded?.id).toBe(11);
    expect(m.pending).toBe(true);
    const body = vi.mocked(api.attachFamilyTreeMedia).mock.calls[0][1];
    await m.attach(3, "primary", null);
    expect(vi.mocked(api.attachFamilyTreeMedia).mock.calls[1][1]).toBe(body);
  });
  it("session invalidation aborts exact owned requests, clears images/jobs/password flow/temporary files and suppresses late bytes", async () => {
    await m.choose();
    const release = m.selected!.release;
    await d.previewPurge(3, "pass");
    await t.createExport("zip");
    const pending = deferred<FT.FamilyTreeMediaReference[]>();
    vi.mocked(api.listFamilyTreeMediaReferences).mockReturnValueOnce(
      pending.promise,
    );
    const task = m.load(3);
    const signal = vi.mocked(api.listFamilyTreeMediaReferences).mock
      .calls[0][1]!.signal!;
    core.invalidateAuthentication();
    expect(signal.aborted).toBe(true);
    expect(release).toHaveBeenCalled();
    expect(m.selected).toBeNull();
    expect(d.purge).toBeNull();
    expect(t.exporting).toBeNull();
    pending.resolve([reference]);
    await expect(task).rejects.toThrow();
    expect(m.references).toEqual([]);
    expect(r.error).toBeNull();
  });
  it("cleans a picker result arriving after household/session invalidation", async () => {
    const pending = deferred<Awaited<ReturnType<FilePort["pickPhotograph"]>>>();
    vi.mocked(files.pickPhotograph).mockReturnValueOnce(pending.promise);
    const task = m.choose();
    const release = vi.fn();
    core.invalidateAuthentication();
    pending.resolve({
      uri: "file:///owned",
      name: "photograph.png",
      type: "image/png",
      size: 3,
      release,
    });
    await expect(task).rejects.toThrow();
    expect(release).toHaveBeenCalled();
    expect(m.selected).toBeNull();
  });
});
