import type { ApiClient } from "../../../../api/client";
import type { RequestOptions } from "@family-manager/family-api/client-core";
import type { TreeWorkflow } from "../workflows/treeWorkflow";
import type { ToolPermission } from "./toolExecution";
import { message, code } from "../workflows/state";
import type { NativeSelection, TrackTemporary } from "./nativeFiles";
export type FilePort = {
  pickPhotograph: () => Promise<NativeSelection | null>;
  pickPackage: () => Promise<NativeSelection | null>;
  multipart: (
    file: NativeSelection,
    fields?: Record<string, string>,
  ) => FormData;
  shareDownload: typeof import("./nativeFiles").shareDownload;
};
export class ToolRuntime {
  error: string | null = null;
  blockingAliasIds: number[] = [];
  private version = 0;
  private listeners = new Set<() => void>();
  private requests = new Set<AbortController>();
  private transferCleanups = new Set<() => void>();
  private intentOwner: string | null = null;
  private cleanups = new Set<() => void>();
  private resets = new Set<() => void>();
  private unsubscribe: () => void = () => {};
  private generation: number;
  private draftEpoch: number;
  closed = false;
  constructor(
    readonly api: ApiClient,
    readonly core: TreeWorkflow,
    readonly files: FilePort,
  ) {
    this.generation = api.authenticationGeneration;
    this.draftEpoch = core.state.draftEpoch;
    let access = core.state.access,
      caps = core.state.collection?.capabilities;
    this.unsubscribe = core.subscribe(() => {
      const next = core.state,
        currentCaps = next.collection?.capabilities;
      if (
        this.generation !== api.authenticationGeneration ||
        this.draftEpoch !== next.draftEpoch ||
        next.access === "denied"
      ) {
        this.reset();
        return;
      }
      // A failed network discovery hides drafts and interrupts work, but is not an affirmative denial.
      if (next.access === "error") {
        this.interrupt();
        return;
      }
      if (
        (access === "manage" && next.access !== "manage") ||
        (currentCaps &&
          ((caps?.can_export === true && currentCaps.can_export !== true) ||
            (caps?.can_purge === true && currentCaps.can_purge !== true)))
      ) {
        this.reset();
        core.markToolPending(false, true);
        return;
      }
      access = next.access;
      if (currentCaps) caps = currentCaps;
    });
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.version;
  changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
  current = () =>
    !this.closed &&
    this.generation === this.api.authenticationGeneration &&
    this.draftEpoch === this.core.state.draftEpoch &&
    ["view", "manage"].includes(this.core.state.access);
  track: TrackTemporary = (release) => {
    this.cleanups.add(release);
    return () => {
      this.cleanups.delete(release);
    };
  };
  onReset(clear: () => void) {
    this.resets.add(clear);
  }
  reset() {
    this.unsubscribe();
    this.closed = true;
    this.interrupt();
    this.requests.clear();
    this.resets.forEach((clear) => clear());
    this.cleanups.forEach((release) => release());
    this.cleanups.clear();
    this.blockingAliasIds = [];
    this.error = null;
    this.changed();
  }
  trackTransfer: TrackTemporary = (release) => {
    this.transferCleanups.add(release);
    return () => {
      this.transferCleanups.delete(release);
    };
  };
  interrupt() {
    this.requests.forEach((c) => c.abort());
    this.transferCleanups.forEach((release) => release());
    this.transferCleanups.clear();
  }
  get working() {
    return this.requests.size > 0;
  }
  claimIntent(owner: string) {
    if (this.intentOwner && this.intentOwner !== owner)
      throw new Error("Retry or discard the original pending command first.");
    this.intentOwner = owner;
    this.core.markToolPending(true);
  }
  releaseIntent(owner: string) {
    if (this.intentOwner === owner) {
      this.intentOwner = null;
      this.core.markToolPending(false);
    }
  }
  async request<T>(
    call: (options: RequestOptions) => Promise<T>,
    permission: ToolPermission = "manage",
    target?: number | null,
    owner?: string,
    retryReceipt = false,
    onAcknowledged?: () => void,
  ): Promise<T> {
    if (!this.current()) throw new Error("Family Tree access changed.");
    if (this.intentOwner && owner !== this.intentOwner && permission !== "view")
      throw new Error(
        "Retry or explicitly discard the original pending command first.",
      );
    const controller = new AbortController();
    this.requests.add(controller);
    this.error = null;
    this.blockingAliasIds = [];
    this.changed();
    try {
      const result = await this.core.runTool(
        async () => {
          const acknowledged = await call({ signal: controller.signal });
          // Retire immutable POST intent at ACK, before the core's dependent GETs.
          if (target !== undefined) onAcknowledged?.();
          return acknowledged;
        },
        permission,
        target,
        retryReceipt && owner === this.intentOwner,
      );
      if (!this.current()) throw new Error("Family Tree access changed.");
      if (
        this.intentOwner &&
        owner !== this.intentOwner &&
        permission !== "view"
      )
        throw new Error(
          "Retry or explicitly discard the original pending command first.",
        );
      return result;
    } catch (error) {
      if (this.current()) this.fail(error);
      throw error;
    } finally {
      this.requests.delete(controller);
      this.changed();
    }
  }
  assertCurrent() {
    if (!this.current()) throw new Error("Family Tree access changed.");
  }
  revision() {
    const revision = this.core.state.collection?.graph_revision;
    if (revision === undefined) throw new Error("Refresh Family Tree first.");
    return revision;
  }
  editable(personId: number, allowAlias = false) {
    const p = this.core.state.detail?.person;
    if (
      !p ||
      p.id !== personId ||
      p.is_locked ||
      (!allowAlias && (p.merged_into_person_id !== null || !!p.archived_at))
    )
      throw new Error("Open an unlocked canonical person before continuing.");
  }
  fail(error: unknown) {
    if (!this.current()) return;
    this.error = message(error);
    this.blockingAliasIds = [];
    if (
      code(error) === "merge_aliases_present" &&
      typeof error === "object" &&
      error &&
      "data" in error
    ) {
      const data = error.data;
      if (
        typeof data === "object" &&
        data &&
        "detail" in data &&
        typeof data.detail === "object" &&
        data.detail &&
        "blocking_alias_ids" in data.detail
      ) {
        const ids = data.detail.blocking_alias_ids;
        if (
          Array.isArray(ids) &&
          ids.every((id) => Number.isSafeInteger(id) && id > 0)
        )
          this.blockingAliasIds = ids.slice(0, 300);
      }
    }
    this.changed();
  }
}
