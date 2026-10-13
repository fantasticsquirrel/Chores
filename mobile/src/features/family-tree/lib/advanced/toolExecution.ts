import type * as FT from "@family-manager/family-api/models";
import type { TreeState } from "../workflows/state";
export type ToolPermission = "view" | "manage" | "export" | "purge";
export type ToolPort = {
  state: TreeState;
  valid: () => boolean;
  begin: () => () => boolean;
  authenticate: <T>(call: () => Promise<T>, valid: () => boolean) => Promise<T>;
  complete: (
    result: FT.FamilyTreeMutationResult,
    target: number | null,
  ) => Promise<void>;
  failure: (error: unknown) => Promise<void>;
  release: () => void;
};
export async function executeTool<T>(
  port: ToolPort,
  call: () => Promise<T>,
  permission: ToolPermission,
  target?: number | null,
  retryReceipt = false,
): Promise<T> {
  const s = port.state,
    caps = s.collection?.capabilities;
  if (
    !port.valid() ||
    !caps ||
    s.loading ||
    s.busy ||
    s.pending ||
    (s.error && !retryReceipt) ||
    !["view", "manage"].includes(s.access) ||
    (permission !== "view" &&
      (s.access !== "manage" || caps.can_manage !== true)) ||
    (permission === "export" && caps.can_export !== true) ||
    (permission === "purge" && caps.can_purge !== true)
  )
    throw new Error("Refresh Family Tree access before continuing.");
  const current = port.begin();
  try {
    const result = await port.authenticate(call, current);
    if (!current()) throw new Error("Family Tree session changed.");
    if (target !== undefined)
      await port.complete(result as FT.FamilyTreeMutationResult, target);
    return result;
  } catch (error) {
    if (current()) await port.failure(error);
    throw error;
  } finally {
    port.release();
  }
}
