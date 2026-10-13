import type { FamilyTreeMutationResult } from "@family-manager/family-api/models";
import type { TreeState, PendingCommand } from "./state";
export function advancedCommittedState(
  state: TreeState,
  selectedId: number | null,
  lastCommit: FamilyTreeMutationResult,
): Partial<TreeState> {
  return {
    selectedId,
    lastCommit,
    readbackPending: true,
    detail: null,
    stories: null,
    residences: null,
    successCount: state.successCount + 1,
  };
}
export function committedState(
  state: TreeState,
  pending: PendingCommand,
  result: FamilyTreeMutationResult,
): Partial<TreeState> {
  const a = pending.action;
  const selected =
    a.type === "createPerson"
      ? result.affected.person_ids[0]
      : a.type === "createRelative"
        ? (result.affected.person_ids.find((id) => id !== a.personId) ??
          state.selectedId)
        : state.selectedId;
  return {
    pending: null,
    lastCommit: result,
    readbackPending: true,
    successCount: state.successCount + 1,
    selectedId: selected ?? null,
    ...(selected !== state.selectedId
      ? { detail: null, stories: null, residences: null }
      : {}),
  };
}
