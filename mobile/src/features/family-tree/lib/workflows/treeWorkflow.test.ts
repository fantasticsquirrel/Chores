import { describe, expect, it, vi } from "vitest";
import { TreeWorkflow, type TreeApi } from "./treeWorkflow";
import { TreeRequests, type TreeRequestOptions } from "./requests";
const module = {
  key: "family-tree",
  name: "Family Tree",
  description: "",
  can_manage: true,
};
const collection = {
  graph_revision: 1,
  default_focus_person_id: null,
  active_people_count: 0,
  capabilities: { can_manage: true },
};
const people = { graph_revision: 1, items: [], next_cursor: null, total: 0 };
const graph = {
  graph_revision: 1,
  focus_person_id: null,
  nodes: [],
  edges: [],
  expansion_token: null,
  projection_limits: {
    max_nodes: 250,
    max_edges: 500,
    hard_max_nodes: 500,
    hard_max_edges: 1000,
  },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { resolve, promise };
}
function setup(modules: unknown[] = [module]) {
  const api = {
    authenticationGeneration: 0,
    withAuthentication: vi.fn(
      (_generation: number, operation: () => Promise<unknown>) => operation(),
    ),
    getMyModules: vi.fn().mockResolvedValue({ modules }),
    getFamilyTreeCollection: vi.fn().mockResolvedValue(collection),
    listFamilyTreePeople: vi.fn().mockResolvedValue(people),
    getFamilyTreeGraph: vi.fn().mockResolvedValue(graph),
    getFamilyTreePerson: vi.fn().mockResolvedValue({
      graph_revision: 1,
      person: { id: 3, is_locked: false, merged_into_person_id: null },
      canonical_person: null,
    }),
    listFamilyTreeStories: vi.fn().mockResolvedValue({ ...people, items: [] }),
    listFamilyTreeResidences: vi
      .fn()
      .mockResolvedValue({ ...people, items: [] }),
    createFamilyTreePerson: vi.fn().mockResolvedValue({
      current_revision: 2,
      affected: { person_ids: [3] },
    }),
    patchFamilyTreePerson: vi.fn().mockResolvedValue({
      current_revision: 2,
      affected: { person_ids: [3] },
    }),
    compareFamilyTreePeople: vi.fn().mockResolvedValue({
      graph_revision: 1,
      state: "disconnected",
      path: [],
    }),
  };
  const publish = vi.fn();
  const tree = new TreeWorkflow(
    api as unknown as TreeApi,
    { userId: 1, householdId: 27, role: "PARENT" },
    publish,
  );
  return { tree, api, publish };
}
describe("native authoritative tree workflows", () => {
  it('selects and refreshes the new relative ID rather than depending on affected-ID order',async()=>{const {tree,api}=setup();await tree.refresh();await tree.select(3);Object.assign(api,{createFamilyTreeRelative:vi.fn().mockResolvedValue({current_revision:1,affected:{person_ids:[3,4]}})});api.getFamilyTreePerson.mockImplementation(async id=>({graph_revision:1,person:{id,is_locked:false,merged_into_person_id:null},canonical_person:null}));await tree.mutate({type:'createRelative',personId:3,person:{display_name:'New relative'},relationship:{direction:'partner',kind:'unknown'}});expect(tree.state.selectedId).toBe(4);expect(api.getFamilyTreePerson).toHaveBeenLastCalledWith(4);expect(tree.state.detail?.person.id).toBe(4);});
  it("forwards real request signals and aborts obsolete graph lenses, retaining generation guards", async () => {
    const { api } = setup();
    const requests = new TreeRequests();
    const tree = new TreeWorkflow(
      api as unknown as TreeApi,
      { userId: 1, householdId: 27, role: "PARENT" },
      vi.fn(),
      requests,
    );
    await tree.refresh();
    let oldSignal: AbortSignal | undefined;
    api.getFamilyTreeGraph.mockImplementationOnce(
      (_params, options?: TreeRequestOptions) =>
        new Promise((_resolve, reject) => {
          oldSignal = options?.signal;
          oldSignal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("Aborted"), { name: "AbortError" })),
          );
        }),
    );
    const old = tree.setLens({ up_depth: 3 });
    await tree.setLens({ up_depth: 4 });
    await old;
    expect(oldSignal?.aborted).toBe(true);
    expect(tree.state.error).toBeNull();
    expect(api.getFamilyTreeGraph).toHaveBeenLastCalledWith(
      { up_depth: 4, focus_person_id: null },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it("aborts obsolete detail requests before issuing any obsolete record reads", async () => {
    const { api } = setup();
    const requests = new TreeRequests();
    const tree = new TreeWorkflow(
      api as unknown as TreeApi,
      { userId: 1, householdId: 27, role: "PARENT" },
      vi.fn(),
      requests,
    );
    await tree.refresh();
    let signal: AbortSignal | undefined;
    api.getFamilyTreePerson.mockImplementationOnce(
      (_id, options?: TreeRequestOptions) =>
        new Promise((_resolve, reject) => {
          signal = options?.signal;
          signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("Aborted"), { name: "AbortError" })),
          );
        }),
    );
    const old = tree.select(3);
    api.getFamilyTreePerson.mockResolvedValueOnce({
      graph_revision: 1,
      person: { id: 4, is_locked: false, merged_into_person_id: null },
      canonical_person: null,
    });
    await tree.select(4);
    await old;
    expect(signal?.aborted).toBe(true);
    expect(tree.state.detail?.person.id).toBe(4);
    expect(
      api.listFamilyTreeStories.mock.calls.every((call) => call[0] !== 3),
    ).toBe(true);
  });
  it("an aborted mutation retains its opaque idempotency key for explicit retry; abort is not rollback", async () => {
    const { api } = setup();
    const requests = new TreeRequests();
    const tree = new TreeWorkflow(
      api as unknown as TreeApi,
      { userId: 1, householdId: 27, role: "PARENT" },
      vi.fn(),
      requests,
    );
    await tree.refresh();
    let signal: AbortSignal | undefined;
    api.createFamilyTreePerson.mockImplementationOnce(
      (_payload, options?: TreeRequestOptions) =>
        new Promise((_resolve, reject) => {
          signal = options?.signal;
          signal?.addEventListener("abort", () =>
            reject(
              Object.assign(new Error("Aborted; server may have committed"), {
                name: "AbortError",
              }),
            ),
          );
        }),
    );
    const write = tree.mutate({
      type: "createPerson",
      person: { display_name: "Retained" },
    });
    const key = tree.state.pending?.key;
    requests.cancel("mutation");
    await write;
    expect(signal?.aborted).toBe(true);
    expect(tree.state.pending?.key).toBe(key);
    await tree.retryMutation();
    expect(api.createFamilyTreePerson.mock.calls[1][0].idempotency_key).toBe(
      key,
    );
  });
  it("auth invalidation aborts in-flight genealogy requests and clears content immediately", async () => {
    const { api } = setup();
    const requests = new TreeRequests();
    const tree = new TreeWorkflow(
      api as unknown as TreeApi,
      { userId: 1, householdId: 27, role: "PARENT" },
      vi.fn(),
      requests,
    );
    await tree.refresh();
    let signal: AbortSignal | undefined;
    api.getFamilyTreePerson.mockImplementationOnce(
      (_id, options?: TreeRequestOptions) =>
        new Promise((_resolve, reject) => {
          signal = options?.signal;
          signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("Aborted"), { name: "AbortError" })),
          );
        }),
    );
    const old = tree.select(3);
    api.authenticationGeneration++;
    tree.invalidateAuthentication();
    await old;
    expect(signal?.aborted).toBe(true);
    expect(tree.state.collection).toBeNull();
    expect(tree.state.detail).toBeNull();
  });
  it("prunes archived collapse IDs from the actual server lens before refreshing", async () => {
    const { tree, api } = setup();
    await tree.refresh();
    await tree.setLens({ collapsed_up_ids: [3], collapsed_down_ids: [3] });
    Object.assign(api, {
      archiveFamilyTreePerson: vi
        .fn()
        .mockResolvedValue({
          current_revision: 1,
          affected: { person_ids: [3] },
        }),
    });
    api.getFamilyTreeGraph.mockImplementation(async (params) => {
      if (
        params.collapsed_up_ids?.includes(3) ||
        params.collapsed_down_ids?.includes(3)
      )
        throw new Error("Invalid collapsed branch.");
      return graph;
    });
    await tree.mutate({ type: "archive", personId: 3 });
    expect(tree.state.error).toBeNull();
    expect(api.getFamilyTreeGraph).toHaveBeenLastCalledWith({
      focus_person_id: null,
      collapsed_up_ids: [],
      collapsed_down_ids: [],
    });
  });
  it("clears archived graph focus before readback so the actual server focus rule cannot block restore", async () => {
    const { tree, api } = setup();
    api.getFamilyTreeCollection.mockResolvedValue({
      ...collection,
      default_focus_person_id: 3,
    });
    api.getFamilyTreeGraph.mockResolvedValue({ ...graph, focus_person_id: 3 });
    await tree.refresh();
    const archive = vi.fn().mockResolvedValue({
      current_revision: 1,
      affected: { person_ids: [3] },
    });
    Object.assign(api, { archiveFamilyTreePerson: archive });
    api.getFamilyTreeCollection.mockResolvedValue({
      ...collection,
      default_focus_person_id: null,
    });
    api.getFamilyTreeGraph.mockImplementation(async (params) => {
      if (params.focus_person_id === 3)
        throw new Error("Focus is archived; choose an active person.");
      return graph;
    });
    await tree.mutate({ type: "archive", personId: 3 });
    expect(archive).toHaveBeenCalledTimes(1);
    expect(tree.state.focusId).toBeNull();
    expect(tree.state.error).toBeNull();
    expect(api.getFamilyTreeGraph).toHaveBeenLastCalledWith({
      focus_person_id: null,
    });
  });
  it("rejects a late candidate continuation after the selector query changes", async () => {
    const { tree, api } = setup();
    await tree.refresh();
    await tree.select(3);
    api.listFamilyTreePeople.mockResolvedValueOnce({
      ...people,
      items: [{ id: 4 }],
      next_cursor: 4,
    });
    await tree.searchCandidates("old");
    const old = deferred<unknown>();
    api.listFamilyTreePeople.mockReturnValueOnce(old.promise);
    const more = tree.moreCandidates();
    api.listFamilyTreePeople.mockResolvedValueOnce({
      ...people,
      items: [{ id: 7 }],
      next_cursor: null,
    });
    await tree.searchCandidates("new");
    old.resolve({ ...people, items: [{ id: 5 }], next_cursor: null });
    await more;
    expect(tree.state.candidatePeople?.items.map((p) => p.id)).toEqual([7]);
  });
  it("keeps bounded relative/compare candidate search separate from the main directory lens", async () => {
    const { tree, api } = setup();
    api.listFamilyTreePeople.mockResolvedValueOnce({
      ...people,
      items: [{ id: 3 }],
    });
    await tree.refresh();
    await tree.select(3);
    api.listFamilyTreePeople.mockResolvedValueOnce({
      ...people,
      items: [{ id: 4 }],
      next_cursor: 4,
    });
    await tree.searchCandidates("Grace");
    expect(tree.state.people?.items.map((p) => p.id)).toEqual([3]);
    expect(tree.state.candidatePeople?.items.map((p) => p.id)).toEqual([4]);
    expect(api.listFamilyTreePeople).toHaveBeenLastCalledWith({
      query: "Grace",
      archived: false,
      limit: 30,
    });
  });
  it("clears previously loaded protected content when new module discovery fails", async () => {
    const { tree, api } = setup();
    await tree.refresh();
    api.getMyModules.mockRejectedValueOnce(new Error("discovery offline"));
    await tree.refresh();
    expect(tree.state.access).toBe("error");
    expect(tree.state.collection).toBeNull();
    expect(tree.state.graph).toBeNull();
    expect(tree.state.people).toBeNull();
  });
  it("requires successful latest-revision refresh before permitting explicit reapply", async () => {
    const { tree, api } = setup();
    await tree.refresh();
    api.patchFamilyTreePerson.mockRejectedValueOnce({
      code: "revision_conflict",
      message: "Changed",
    });
    await tree.mutate({
      type: "patchPerson",
      personId: 3,
      changes: { notes_md: "draft" },
    });
    api.getFamilyTreeCollection.mockRejectedValueOnce(new Error("offline"));
    await tree.reviewConflict();
    await tree.reapply();
    expect(api.patchFamilyTreePerson).toHaveBeenCalledTimes(1);
    expect(tree.state.pending?.latestReviewed).toBe(false);
  });
  it("invalidates older detail selection before any late story/residence reads", async () => {
    const { tree, api } = setup();
    await tree.refresh();
    const d = deferred<unknown>();
    api.getFamilyTreePerson.mockReturnValueOnce(d.promise);
    const old = tree.select(3);
    api.getFamilyTreePerson.mockResolvedValueOnce({
      graph_revision: 1,
      person: { id: 4, is_locked: false, merged_into_person_id: null },
      canonical_person: null,
    });
    await tree.select(4);
    d.resolve({
      graph_revision: 1,
      person: { id: 3, is_locked: false, merged_into_person_id: null },
      canonical_person: null,
    });
    await old;
    expect(tree.state.detail?.person.id).toBe(4);
    expect(api.listFamilyTreeStories).not.toHaveBeenCalledWith(3, {
      limit: 30,
    });
  });
  it("blocks protected and merge-alias person mutations rather than silently unlocking/canonicalizing", async () => {
    const { tree, api } = setup();
    await tree.refresh();
    api.getFamilyTreePerson.mockResolvedValueOnce({
      graph_revision: 1,
      person: { id: 3, is_locked: true, merged_into_person_id: null },
      canonical_person: null,
    });
    await tree.select(3);
    await tree.mutate({
      type: "patchPerson",
      personId: 3,
      changes: { notes_md: "blocked" },
    });
    expect(api.patchFamilyTreePerson).not.toHaveBeenCalled();
    api.getFamilyTreePerson.mockResolvedValueOnce({
      graph_revision: 1,
      person: { id: 3, is_locked: false, merged_into_person_id: 4 },
      canonical_person: null,
    });
    await tree.select(3);
    await tree.mutate({
      type: "patchPerson",
      personId: 3,
      changes: { notes_md: "alias" },
    });
    expect(api.patchFamilyTreePerson).not.toHaveBeenCalled();
  });
  it("requires a successful adult module response before any genealogy reads", async () => {
    const { tree, api } = setup();
    const d = deferred<{ modules: (typeof module)[] }>();
    api.getMyModules.mockReturnValue(d.promise);
    const load = tree.refresh();
    expect(api.getFamilyTreeCollection).not.toHaveBeenCalled();
    d.resolve({ modules: [module] });
    await load;
    expect(api.getFamilyTreeCollection).toHaveBeenCalledTimes(1);
    expect(tree.state.access).toBe("manage");
  });
  it.each([
    { modules: [] },
    { modules: [{ ...module, can_manage: false }] },
    { modules: [{ ...module, can_manage: undefined }] },
  ])("strictly preserves denied/view-only grants %j", async ({ modules }) => {
    const { tree, api, publish } = setup(modules);
    await tree.refresh();
    expect(publish).toHaveBeenCalledWith(modules);
    if (!modules.length) {
      expect(api.getFamilyTreeCollection).not.toHaveBeenCalled();
      expect(tree.state.access).toBe("denied");
    } else {
      expect(tree.state.access).toBe("view");
      await tree.mutate({
        type: "createPerson",
        person: { display_name: "A" },
      });
      expect(api.createFamilyTreePerson).not.toHaveBeenCalled();
    }
  });
  it("never treats failed discovery as an empty successful tree; retry is operable", async () => {
    const { tree, api } = setup();
    api.getMyModules.mockRejectedValueOnce(new Error("offline"));
    await tree.refresh();
    expect(tree.state.access).toBe("error");
    expect(tree.state.error).toContain("offline");
    expect(api.getFamilyTreeCollection).not.toHaveBeenCalled();
    await tree.refresh();
    expect(tree.state.collection).toEqual(collection);
  });
  it("blocks children even when module discovery would grant them", async () => {
    const { api } = setup();
    const tree = new TreeWorkflow(
      api as unknown as TreeApi,
      { userId: 1, householdId: 27, role: "CHILD" },
      vi.fn(),
    );
    await tree.refresh();
    expect(api.getFamilyTreeCollection).not.toHaveBeenCalled();
    expect(tree.state.access).toBe("denied");
  });
  it("drops late reads and clears all content on disposal/auth replacement", async () => {
    const { tree, api } = setup();
    const d = deferred<unknown>();
    api.getFamilyTreeCollection.mockReturnValue(d.promise);
    const load = tree.refresh();
    await Promise.resolve();
    tree.dispose();
    d.resolve(collection);
    await load;
    expect(tree.state.collection).toBeNull();
    expect(tree.state.people).toBeNull();
  });
  it("selects detail plus separately ordered bounded stories and residences", async () => {
    const { tree, api } = setup();
    await tree.refresh();
    await tree.select(3);
    expect(api.getFamilyTreePerson).toHaveBeenCalledWith(3);
    expect(api.listFamilyTreeStories).toHaveBeenCalledWith(3, { limit: 30 });
    expect(api.listFamilyTreeResidences).toHaveBeenCalledWith(3, { limit: 30 });
    expect(tree.state.detail?.person.id).toBe(3);
  });
  it("uses revision and opaque stable retry key, coalesces double taps, refreshes mutation IDs", async () => {
    const { tree, api } = setup();
    await tree.refresh();
    const d = deferred<unknown>();
    api.createFamilyTreePerson.mockReturnValueOnce(d.promise);
    const a = tree.mutate({
      type: "createPerson",
      person: { display_name: "A" },
    });
    const b = tree.mutate({
      type: "createPerson",
      person: { display_name: "A" },
    });
    expect(api.createFamilyTreePerson).toHaveBeenCalledTimes(1);
    d.resolve({ current_revision: 2, affected: { person_ids: [3] } });
    await Promise.all([a, b]);
    expect(api.createFamilyTreePerson.mock.calls[0][0]).toMatchObject({
      expected_graph_revision: 1,
      idempotency_key: expect.any(String),
      person: { display_name: "A" },
    });
    expect(api.getFamilyTreePerson).toHaveBeenCalledWith(3);
  });
  it("preserves failed commands and keys without offline writes or silent retries", async () => {
    const { tree, api } = setup();
    await tree.refresh();
    api.createFamilyTreePerson.mockRejectedValueOnce(new Error("network down"));
    await tree.mutate({ type: "createPerson", person: { display_name: "A" } });
    expect(tree.state.pending?.action).toMatchObject({
      person: { display_name: "A" },
    });
    const first = api.createFamilyTreePerson.mock.calls[0][0];
    await tree.retryMutation();
    expect(api.createFamilyTreePerson.mock.calls[1][0].idempotency_key).toBe(
      first.idempotency_key,
    );
  });
  it("requires explicit conflict review then reapply against freshly fetched revision", async () => {
    const { tree, api } = setup();
    await tree.refresh();
    api.patchFamilyTreePerson.mockRejectedValueOnce({
      code: "revision_conflict",
      message: "Changed",
    });
    await tree.mutate({
      type: "patchPerson",
      personId: 3,
      changes: { notes_md: "draft" },
    });
    await tree.retryMutation();
    expect(api.patchFamilyTreePerson).toHaveBeenCalledTimes(1);
    api.getFamilyTreeCollection.mockResolvedValue({
      ...collection,
      graph_revision: 7,
    });
    api.listFamilyTreePeople.mockResolvedValue({
      ...people,
      graph_revision: 7,
    });
    api.getFamilyTreeGraph.mockResolvedValue({ ...graph, graph_revision: 7 });
    await tree.reviewConflict();
    expect(api.patchFamilyTreePerson).toHaveBeenCalledTimes(1);
    await tree.reapply();
    expect(api.patchFamilyTreePerson.mock.calls[1][1]).toMatchObject({
      expected_graph_revision: 7,
      changes: { notes_md: "draft" },
    });
  });
  it("only sends chronology reviewed warnings following explicit confirmation", async () => {
    const { tree, api } = setup();
    await tree.refresh();
    api.createFamilyTreePerson.mockRejectedValueOnce({
      code: "chronology_review",
      message: "Review dates",
    });
    await tree.mutate({ type: "createPerson", person: { display_name: "A" } });
    expect(
      api.createFamilyTreePerson.mock.calls[0][0].reviewed_warnings,
    ).toBeUndefined();
    await tree.retryMutation();
    expect(api.createFamilyTreePerson).toHaveBeenCalledTimes(1);
    await tree.confirmChronology();
    expect(
      api.createFamilyTreePerson.mock.calls[1][0].reviewed_warnings,
    ).toEqual(["chronology_review"]);
  });
  it("invalidates protected content and publishes revocation after permission denial", async () => {
    const { tree, api, publish } = setup();
    await tree.refresh();
    api.getFamilyTreePerson.mockRejectedValueOnce({
      status: 403,
      message: "Denied",
    });
    api.getMyModules.mockResolvedValue({ modules: [] });
    await tree.select(3);
    expect(tree.state.collection).toBeNull();
    expect(tree.state.access).toBe("denied");
    expect(publish).toHaveBeenLastCalledWith([]);
  });
  it("never unions pages from different revisions", async () => {
    const { tree, api } = setup();
    api.listFamilyTreePeople.mockResolvedValueOnce({
      ...people,
      items: [{ id: 1 }],
      next_cursor: 1,
    });
    await tree.refresh();
    api.listFamilyTreePeople.mockResolvedValueOnce({
      ...people,
      graph_revision: 2,
      items: [{ id: 2 }],
    });
    await tree.morePeople();
    expect(tree.state.people?.items.map((p) => p.id)).toEqual([1]);
    expect(tree.state.error).toMatch(/revision|changed/i);
  });
  it("does not let an older refresh clobber a newer mutation refresh", async () => {
    const { tree, api } = setup();
    await tree.refresh();
    const d = deferred<unknown>();
    api.getFamilyTreeCollection.mockReturnValueOnce(d.promise);
    const old = tree.refresh();
    await Promise.resolve();
    api.getFamilyTreeCollection.mockResolvedValue({
      ...collection,
      graph_revision: 2,
    });
    api.listFamilyTreePeople.mockResolvedValue({
      ...people,
      graph_revision: 2,
    });
    api.getFamilyTreeGraph.mockResolvedValue({ ...graph, graph_revision: 2 });
    await tree.mutate({ type: "createPerson", person: { display_name: "A" } });
    d.resolve(collection);
    await old;
    expect(tree.state.collection?.graph_revision).toBe(2);
  });
});
