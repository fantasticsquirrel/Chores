import type * as FT from "@family-manager/family-api/models";
import { executeCommand, type TreeAction, type TreeApi } from "./commands";
import { TreeRequests, type RequestGroup } from "./requests";
import { committedState, advancedCommittedState } from "./committedState";
import { executeTool, type ToolPermission } from "../advanced/toolExecution";
import { TreeGraphQueries } from "./graphQueries";
import { TreeRecordQueries } from "./recordQueries";
import type { TreeReadPort, TreeRequestMethod } from "./queryPort";
import {
  empty,
  message,
  code,
  denied,
  operationKey,
  commandEnvelope,
  moduleAccessState,
  readSettled,
  discoveryFailure,
  toolPendingState,
  snapshotState,
  reviewedCommand,
  reviewedReapplication,
  chronologyCommand,
  type TreeState,
  type TreeScope,
  type PendingCommand,
} from "./state";
export type { TreeApi, TreeAction } from "./commands";
export type { TreeState, TreeScope, PendingCommand } from "./state";
export class TreeWorkflow {
  state: TreeState = empty();
  private listeners = new Set<() => void>();
  private get queryPort(): TreeReadPort {
    return {
      state: () => this.state,
      readable: () => this.readable(),
      valid: (epoch) => this.valid(epoch),
      epoch: () => this.epoch,
      selection: () => this.selection,
      update: (changes) => this.update(changes),
      readError: (error) => this.readError(error),
      supersedeGraph: () => {
        this.epoch++;
        this.requests?.cancelReads();
      },
      directoryFilters: () => this.filters,
      graphParams: () => this.graphQueries.params,
      request: this.request.bind(this),
    };
  }
  private graphQueries = new TreeGraphQueries(this.queryPort);
  private recordQueries = new TreeRecordQueries(this.queryPort);

  private epoch = 0;
  private selection = 0;
  private alive = true;
  private authGeneration: number;
  private mutationPromise: Promise<boolean> | null = null;
  private filters: FT.FamilyTreePeopleParams = { limit: 30 };
  constructor(
    private api: TreeApi,
    private scope: TreeScope,
    private publish: (modules: FT.FamilyModule[]) => void,
    private requests?: TreeRequests,
  ) {
    this.authGeneration = api.authenticationGeneration;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.state;
  get graphParams(): Readonly<FT.FamilyTreeGraphParams> {
    return this.graphQueries.params;
  }
  private request<M extends TreeRequestMethod>(
    group: RequestGroup,
    method: M,
    ...args: Parameters<TreeApi[M]>
  ): ReturnType<TreeApi[M]> {
    const options = this.requests?.begin(group);
    const result = Reflect.apply(
      this.api[method],
      this.api,
      options ? [...args, options] : args,
    ) as ReturnType<TreeApi[M]>;
    return result.finally(() => {
      if (options) this.requests?.finish(group, options);
    }) as ReturnType<TreeApi[M]>;
  }
  private update(changes: Partial<TreeState>) {
    this.state = { ...this.state, ...changes };
    this.listeners.forEach((l) => l());
  }
  private valid(epoch = this.epoch) {
    return (
      this.alive &&
      epoch === this.epoch &&
      this.authGeneration === this.api.authenticationGeneration
    );
  }
  private readable() {
    return (
      this.valid() &&
      (this.state.access === "view" || this.state.access === "manage")
    );
  }
  private clear(access: TreeState["access"], error: string | null = null) {
    this.requests?.cancelAll();
    this.epoch++;
    this.selection++;
    this.graphQueries.invalidate();
    const previous = this.state;
    this.state = {
      ...empty(),
      access,
      error,
      draftEpoch: previous.draftEpoch + 1,
      successCount: previous.successCount,
    };
    this.listeners.forEach((l) => l());
  }
  dispose() {
    this.alive = false;
    this.clear("denied");
    this.listeners.clear();
  }
  invalidateAuthentication() {
    this.clear(
      "denied",
      "Your session changed. Reopen Family Tree after signing in.",
    );
    this.alive = false;
  }
  async refresh(): Promise<void> {
    if (!this.alive) return;
    this.requests?.cancelReads();
    const epoch = ++this.epoch;
    this.selection++;
    this.graphQueries.invalidate();
    const valid = () => this.valid(epoch);
    this.update({ loading: true, error: null });
    if (!["PARENT", "PARENT_ADMIN"].includes(this.scope.role)) {
      this.clear("denied");
      return;
    }
    let discovered = false;
    try {
      const authority = this.requests?.begin("authority");
      const response = await this.api.getMyModules(authority);
      if (authority) this.requests?.finish("authority", authority);
      if (!valid()) return;
      discovered = true;
      this.publish(response.modules);
      const grant = response.modules.find((m) => m.key === "family-tree");
      if (!grant) {
        this.clear("denied", "Family Tree is not enabled for your account.");
        return;
      }
      this.update(moduleAccessState(this.state, grant.can_manage === true));
      const collection = await this.request(
        "snapshot",
        "getFamilyTreeCollection",
      );
      if (!valid()) return;
      const focus = this.state.focusId ?? collection.default_focus_person_id;
      const [people, graph] = await Promise.all([
        this.request("people", "listFamilyTreePeople", this.filters),
        this.request("graph", "getFamilyTreeGraph", {
          ...this.graphQueries.params,
          focus_person_id: focus,
        }),
      ]);
      if (!valid()) return;
      if (
        people.graph_revision !== collection.graph_revision ||
        graph.graph_revision !== collection.graph_revision
      )
        throw new Error(
          "Family history changed while loading. Refresh to use one revision.",
        );
      this.update(snapshotState(this.state, collection, people, graph));
      if (
        collection.capabilities.can_manage !== true &&
        this.state.access === "manage"
      )
        this.update({
          access: "view",
          pending: null,
          draftEpoch: this.state.draftEpoch + 1,
        });
      const selected = this.state.selectedId;
      if (selected !== null) await this.select(selected);
    } catch (e) {
      if (valid()) await this.readError(e, !discovered);
    } finally {
      if (valid()) this.update(readSettled(this.state));
    }
  }
  private async readError(e: unknown, discovery = false) {
    if (denied(e)) {
      this.clear("denied", "Family Tree access changed.");
      const epoch = this.epoch;
      try {
        const authority = this.requests?.begin("authority");
        const r = await this.api.getMyModules(authority);
        if (authority) this.requests?.finish("authority", authority);
        if (this.valid(epoch)) this.publish(r.modules);
      } catch {
        /* A failed authority refresh never restores content. */
      }
    } else if (discovery) this.update(discoveryFailure(message(e)));
    else this.update({ error: message(e) });
  }
  async search(filters: FT.FamilyTreePeopleParams) {
    if (!this.readable()) return;
    this.filters = { ...filters, limit: 30 };
    this.update({ people: null });
    await this.refresh();
  }
  async select(personId: number) {
    if (!this.readable()) return;
    this.requests?.cancel(
      "detail",
      "stories",
      "residences",
      "candidates",
      "compare",
      "identities",
    );
    const request = ++this.selection,
      epoch = this.epoch;
    const valid = () => this.valid(epoch) && request === this.selection;
    this.update({
      selectedId: personId,
      detail: null,
      stories: null,
      residences: null,
      candidates: [],
      candidatePeople: null,
      error: null,
      loading: true,
    });
    try {
      const detail = await this.request(
        "detail",
        "getFamilyTreePerson",
        personId,
      );
      if (!valid()) return;
      const [stories, residences] = await Promise.all([
        this.request("stories", "listFamilyTreeStories", personId, {
          limit: 30,
        }),
        this.request("residences", "listFamilyTreeResidences", personId, {
          limit: 30,
        }),
      ]);
      if (!valid()) return;
      if (
        [
          detail.graph_revision,
          stories.graph_revision,
          residences.graph_revision,
        ].some((r) => r !== this.state.collection?.graph_revision)
      )
        throw new Error(
          "Family history revision changed. Refresh before editing.",
        );
      this.update({ detail, stories, residences });
    } catch (e) {
      if (valid()) await this.readError(e);
    } finally {
      if (valid()) this.update(readSettled(this.state));
    }
  }
  closeDetail() {
    this.requests?.cancel(
      "detail",
      "stories",
      "residences",
      "candidates",
      "compare",
      "identities",
    );
    this.selection++;
    this.update({
      selectedId: null,
      detail: null,
      stories: null,
      residences: null,
      candidates: [],
      candidatePeople: null,
    });
  }
  focus(personId: number) {
    return this.graphQueries.focus(personId);
  }
  setLens(params: FT.FamilyTreeGraphParams) {
    return this.graphQueries.setLens(params);
  }
  loadGraph(append = false) {
    return this.graphQueries.loadGraph(append);
  }
  searchCandidates(query: string) {
    return this.recordQueries.searchCandidates(query);
  }
  moreCandidates() {
    return this.recordQueries.moreCandidates();
  }
  morePeople() {
    return this.recordQueries.morePeople();
  }
  moreStories() {
    return this.recordQueries.moreStories();
  }
  moreResidences() {
    return this.recordQueries.moreResidences();
  }
  compareWith(personId: number) {
    return this.recordQueries.compareWith(personId);
  }
  identities() {
    return this.recordQueries.identities();
  }
  mutate(action: TreeAction, originRevision?: number): Promise<boolean> {
    if (this.mutationPromise) return this.mutationPromise;
    if (
      !this.readable() ||
      this.state.busy ||
      this.state.toolsPending ||
      !!this.state.pending ||
      !!this.state.error ||
      this.state.access !== "manage" ||
      this.state.collection?.capabilities.can_manage !== true
    )
      return Promise.resolve(false);
    const person = this.state.detail?.person;
    if (
      person &&
      (person.merged_into_person_id !== null ||
        (person.is_locked && action.type !== "unlock"))
    ) {
      this.update({
        mutationError:
          "This person is protected. Navigate to the canonical person or explicitly unlock before editing.",
      });
      return Promise.resolve(false);
    }
    const pending: PendingCommand = {
      action: JSON.parse(JSON.stringify(action)) as TreeAction,
      revision: originRevision ?? this.state.collection.graph_revision,
      key: operationKey(),
      code: null,
      reviewed: false,
      latestReviewed: false,
      reviewedRevision: null,
    };
    this.update({ pending, mutationError: null });
    return this.submit(pending);
  }
  private submit(pending: PendingCommand): Promise<boolean> {
    if (this.mutationPromise) return this.mutationPromise;
    if (!this.readable() || this.state.access !== "manage")
      return Promise.resolve(false);
    // Invalidate in-flight reads before sending a command; stale GET cannot overwrite commit.
    this.requests?.cancelReads();
    const options = this.requests?.begin("mutation");
    const epoch = ++this.epoch;
    this.selection++;
    this.graphQueries.invalidate();
    this.update({ busy: true, loading: false, mutationError: null });
    const task = (async () => {
      try {
        const result = await this.api.withAuthentication(
          this.authGeneration,
          () =>
            executeCommand(
              this.api,
              pending.action,
              commandEnvelope(pending),
              options,
            ),
          () => this.valid(epoch),
        );
        if (!this.valid(epoch)) return false;
        if (pending.action.type === "archive")
          this.graphQueries.archived(pending.action.personId);
        this.update(committedState(this.state, pending, result));
        await this.refresh();
        return true;
      } catch (e) {
        if (this.valid(epoch)) {
          if (denied(e)) await this.readError(e);
          else
            this.update({
              pending: { ...pending, code: code(e) },
              mutationError: message(e),
            });
        }
        return false;
      } finally {
        if (options) this.requests?.finish("mutation", options);
        this.mutationPromise = null;
        if (this.valid()) this.update({ busy: false });
      }
    })();
    this.mutationPromise = task;
    return task;
  }
  retryMutation() {
    const p = this.state.pending;
    return p &&
      !["revision_conflict", "chronology_review"].includes(p.code ?? "")
      ? this.submit(p)
      : Promise.resolve(false);
  }
  async reviewConflict() {
    if (this.state.pending?.code !== "revision_conflict") return;
    const p = this.state.pending;
    await this.refresh();
    if (
      this.state.pending === p &&
      this.readable() &&
      this.state.collection &&
      !this.state.error
    )
      this.update({
        pending: reviewedCommand(p, this.state.collection.graph_revision),
      });
  }
  reapply() {
    const reviewed = reviewedReapplication(this.state);
    return reviewed ? this.submit(reviewed) : Promise.resolve(false);
  }
  confirmChronology() {
    const p = this.state.pending;
    return p?.code === "chronology_review"
      ? this.submit(chronologyCommand(p))
      : Promise.resolve(false);
  }
  markToolPending(toolsPending: boolean, invalidate = false) {
    this.update(toolPendingState(this.state, toolsPending, invalidate));
  }
  runTool<T>(
    call: () => Promise<T>,
    permission: ToolPermission,
    target?: number | null,
    retryReceipt = false,
  ) {
    return executeTool(
      {
        state: this.state,
        valid: () => this.valid(),
        begin: () => {
          this.requests?.cancelReads();
          const epoch = ++this.epoch;
          this.selection++;
          this.graphQueries.invalidate();
          this.update({ busy: true, loading: false });
          return () => this.valid(epoch);
        },
        authenticate: (operation, current) =>
          this.api.withAuthentication(this.authGeneration, operation, current),
        complete: async (result, selectedId) => {
          if (
            selectedId !== this.state.selectedId &&
            this.state.selectedId !== null
          )
            this.graphQueries.archived(this.state.selectedId);
          this.update(advancedCommittedState(this.state, selectedId, result));
          await this.refresh();
        },
        failure: async (e) => {
          if (denied(e)) await this.readError(e);
        },
        release: () => {
          if (this.valid()) this.update({ busy: false });
        },
      },
      call,
      permission,
      target,
      retryReceipt,
    );
  }
  discardPending() {
    if (this.state.busy) return;
    this.update({ pending: null, mutationError: null });
  }
}
