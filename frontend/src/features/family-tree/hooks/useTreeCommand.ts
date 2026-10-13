import { createContext, useContext, useRef, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RequestOptions } from "@family-manager/family-api/client-core";
import {
  ApiClientError,
  apiClient,
  type FamilyTreeCommand,
  type FamilyTreeMutationResult,
} from "../../../api";
import { formatApiError } from "../../../lib/errors";
import { cancellable } from "../lib/workflows/workflows";

export type TreeRuntime = {
  owner: string;
  manage: boolean;
  authorizedManage?: boolean;
  online: boolean;
  checking?: boolean;
  revision: () => number;
  floor: { current: number };
  busy: boolean;
  isBusy: () => boolean;
  setBusy: (busy: boolean) => void;
  revoke: () => void;
};
export const TreeRuntimeContext = createContext<TreeRuntime | null>(null);
export function useTreeRuntime() {
  const runtime = useContext(TreeRuntimeContext);
  if (!runtime) throw new Error("Missing protected tree runtime");
  return runtime;
}
export type TreeOperation = (
  command: FamilyTreeCommand,
  requestOptions?: RequestOptions,
) => Promise<FamilyTreeMutationResult>;

function commandErrorText(error: unknown): string {
  const message = formatApiError(error);
  if (
    !(error instanceof ApiClientError) ||
    !error.data ||
    typeof error.data !== "object"
  )
    return message;
  const detail = (error.data as { detail?: unknown }).detail;
  if (
    !detail ||
    typeof detail !== "object" ||
    !("warnings" in detail) ||
    !Array.isArray(detail.warnings)
  )
    return message;
  const warnings = detail.warnings.filter(
    (item): item is string => typeof item === "string",
  );
  return warnings.length ? `${message} ${warnings.join("; ")}` : message;
}
export function useTreeCommand() {
  const runtime = useTreeRuntime(),
    client = useQueryClient();
  const [state, setState] = useState<{
    busy: boolean;
    error: string | null;
    kind: "failure" | "conflict" | "chronology" | null;
    reviewed: boolean;
  }>({ busy: false, error: null, kind: null, reviewed: false });
  const attempt = useRef<{
    operation: TreeOperation;
    command: FamilyTreeCommand;
  } | null>(null);
  const running = useRef(false),
    alive = useRef(true);
  const ownsBusy = useRef(false);
  const releaseBusy = runtime.setBusy;
  const controllers = useRef(new Set<AbortController>());
  // Runtime revocation unmounts the provider; HTTP receipts may finish, but no
  // retired tree or form receives their content. isMounted is queried below.
  const owner = runtime.owner;
  useEffect(() => {
    const ownedControllers = controllers.current;
    alive.current = true;
    return () => {
      alive.current = false;
      for (const controller of ownedControllers) controller.abort();
      ownedControllers.clear();
      if (ownsBusy.current) {
        ownsBusy.current = false;
        releaseBusy(false);
      }
    };
  }, [releaseBusy]);
  async function execute(
    operation: TreeOperation,
    command: FamilyTreeCommand,
  ): Promise<FamilyTreeMutationResult | null> {
    if (
      running.current ||
      !runtime.manage ||
      !runtime.online ||
      runtime.isBusy()
    )
      return null;
    running.current = true;
    const controller = new AbortController();
    controllers.current.add(controller);
    const requestOptions = { signal: controller.signal };
    runtime.setBusy(true);
    ownsBusy.current = true;
    setState({ busy: true, error: null, kind: null, reviewed: false });
    attempt.current = { operation, command };
    try {
      await client.cancelQueries({ queryKey: ["family-tree", owner] });
      if (!alive.current || controller.signal.aborted) return null;
      const result = await cancellable(
        operation(command, requestOptions),
        controller.signal,
      );
      if (!alive.current) return null;
      runtime.floor.current = Math.max(
        runtime.floor.current,
        result.current_revision,
        result.committed_revision,
      );
      // Never apply the mutation envelope as a person snapshot, including replays.
      // A fresh authoritative collection and affected query readback are required.
      await client.invalidateQueries({
        queryKey: ["family-tree", owner],
        refetchType: "none",
      });
      const collection = await cancellable(
        apiClient.getFamilyTreeCollection(requestOptions),
        controller.signal,
      );
      if (collection.graph_revision < runtime.floor.current)
        throw new Error(
          "Saved, but the refresh is stale. Retry loading the latest tree; do not create another record.",
        );
      if (!alive.current) return null;
      client.setQueryData(["family-tree", owner, "collection"], collection);
      attempt.current = null;
      setState({ busy: false, error: null, kind: null, reviewed: false });
      return result;
    } catch (error) {
      if (!alive.current) return null;
      if (
        error instanceof ApiClientError &&
        (error.status === 401 || error.status === 403)
      ) {
        runtime.revoke();
        return null;
      }
      if (
        error instanceof ApiClientError &&
        error.status < 500 &&
        error.code !== "revision_conflict" &&
        error.code !== "chronology_review"
      )
        attempt.current = null;
      const kind =
        error instanceof ApiClientError && error.code === "revision_conflict"
          ? "conflict"
          : error instanceof ApiClientError &&
              error.code === "chronology_review"
            ? "chronology"
            : "failure";
      setState({
        busy: false,
        error: commandErrorText(error),
        kind,
        reviewed: false,
      });
      return null;
    } finally {
      controllers.current.delete(controller);
      running.current = false;
      if (alive.current && ownsBusy.current) {
        ownsBusy.current = false;
        runtime.setBusy(false);
      }
    }
  }
  async function submit(operation: TreeOperation) {
    const previous = attempt.current;
    // Unknown network outcomes retry the identical frozen command, including key
    // and revision. Never double-create or silently retry a stale command.
    if (previous && state.kind === "failure")
      return execute(previous.operation, previous.command);
    if (previous && (state.kind === "conflict" || state.kind === "chronology"))
      return null;
    return execute(operation, {
      expected_graph_revision: runtime.revision(),
      idempotency_key: crypto.randomUUID(),
    });
  }
  async function reviewLatest() {
    if (
      state.kind !== "conflict" ||
      !alive.current ||
      !runtime.manage ||
      !runtime.online ||
      runtime.checking ||
      running.current
    )
      return false;
    running.current = true;
    const controller = new AbortController();
    controllers.current.add(controller);
    const requestOptions = { signal: controller.signal };
    try {
      const latest = await cancellable(
        apiClient.getFamilyTreeCollection(requestOptions),
        controller.signal,
      );
      if (!alive.current) return false;
      if (latest.graph_revision < runtime.floor.current)
        throw new Error(
          "Latest-record review was stale. Load the current records before reapplying.",
        );
      runtime.floor.current = Math.max(
        runtime.floor.current,
        latest.graph_revision,
      );
      client.setQueryData(["family-tree", owner, "collection"], latest);
      await client.invalidateQueries(
        { queryKey: ["family-tree", owner], refetchType: "all" },
        { throwOnError: true },
      );
      if (!alive.current) return false;
      setState((current) => ({ ...current, reviewed: true }));
      return true;
    } catch (error) {
      if (!alive.current) return false;
      if (
        error instanceof ApiClientError &&
        [401, 403].includes(error.status)
      ) {
        runtime.revoke();
        return false;
      }
      setState((current) => ({ ...current, error: formatApiError(error) }));
      return false;
    } finally {
      controllers.current.delete(controller);
      running.current = false;
    }
  }
  async function reapply() {
    if (!attempt.current || !state.reviewed) return null;
    return execute(attempt.current.operation, {
      expected_graph_revision: runtime.revision(),
      idempotency_key: crypto.randomUUID(),
      ...(state.kind === "chronology"
        ? { reviewed_warnings: ["chronology_review" as const] }
        : {}),
    });
  }
  return {
    state,
    submit,
    reviewLatest,
    reapply,
    reviewChronology: (reviewed: boolean) =>
      setState((current) => ({ ...current, reviewed })),
    hasAttempt: attempt.current !== null,
    // Only an explicit abandoned/reviewed intent may release its frozen retry.
    resetIntent: () => {
      if (running.current) return;
      attempt.current = null;
      setState({ busy: false, error: null, kind: null, reviewed: false });
    },
  };
}
