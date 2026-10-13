import type * as FT from "@family-manager/family-api/models";
import type { TreeAction } from "./commands";
export type TreeScope = { userId: number; householdId: number; role: string };
export type PendingCommand = {
  action: TreeAction;
  revision: number;
  key: string;
  code: string | null;
  reviewed: boolean;
  latestReviewed: boolean;
  reviewedRevision: number | null;
};
export type TreeState = {
  access: "loading" | "denied" | "error" | "view" | "manage";
  loading: boolean;
  busy: boolean;
  toolsPending: boolean;
  error: string | null;
  mutationError: string | null;
  collection: FT.FamilyTreeCollectionState | null;
  lastCommit: FT.FamilyTreeMutationResult | null;
  readbackPending: boolean;
  people: FT.FamilyTreePeoplePage | null;
  graph: FT.FamilyTreeGraphProjection | null;
  detail: FT.FamilyTreePersonDetail | null;
  stories: FT.FamilyTreeStoriesPage | null;
  residences: FT.FamilyTreeResidencesPage | null;
  candidatePeople: FT.FamilyTreePeoplePage | null;
  selectedId: number | null;
  focusId: number | null;
  compare: FT.FamilyTreeCompareResult | null;
  candidates: FT.FamilyTreeIdentityCandidate[];
  pending: PendingCommand | null;
  draftEpoch: number;
  successCount: number;
};
export const empty = (): TreeState => ({
  access: "loading",
  loading: false,
  busy: false,
  toolsPending: false,
  error: null,
  mutationError: null,
  collection: null,
  lastCommit: null,
  readbackPending: false,
  people: null,
  graph: null,
  detail: null,
  stories: null,
  residences: null,
  candidatePeople: null,
  selectedId: null,
  focusId: null,
  compare: null,
  candidates: [],
  pending: null,
  draftEpoch: 0,
  successCount: 0,
});
export function toolPendingState(
  state: TreeState,
  toolsPending: boolean,
  invalidate: boolean,
): Partial<TreeState> {
  return {
    toolsPending,
    ...(invalidate ? { draftEpoch: state.draftEpoch + 1 } : {}),
  };
}
export function chronologyCommand(pending: PendingCommand): PendingCommand {
  return { ...pending, reviewed: true, key: operationKey(), code: null };
}
export function reappliedCommand(
  pending: PendingCommand,
  revision: number,
): PendingCommand {
  return {
    ...pending,
    revision,
    key: operationKey(),
    latestReviewed: false,
    reviewedRevision: null,
    code: null,
  };
}
export function readSettled(state: TreeState): Partial<TreeState> {
  return {
    loading: false,
    readbackPending: state.error ? state.readbackPending : false,
  };
}
export function snapshotState(
  state: TreeState,
  collection: FT.FamilyTreeCollectionState,
  people: FT.FamilyTreePeoplePage,
  graph: FT.FamilyTreeGraphProjection,
): Partial<TreeState> {
  const p = state.pending;
  return {
    collection,
    people,
    graph,
    focusId: graph.focus_person_id,
    compare: null,
    ...(p?.latestReviewed && p.reviewedRevision !== collection.graph_revision
      ? { pending: { ...p, latestReviewed: false, reviewedRevision: null } }
      : {}),
  };
}
export function reviewedCommand(
  p: PendingCommand,
  revision: number,
): PendingCommand {
  return { ...p, latestReviewed: true, reviewedRevision: revision };
}
export function reviewedReapplication(state: TreeState): PendingCommand | null {
  const p = state.pending;
  if (
    !p?.latestReviewed ||
    p.reviewedRevision === null ||
    state.error ||
    state.loading ||
    state.busy ||
    p.reviewedRevision !== state.collection?.graph_revision
  )
    return null;
  return reappliedCommand(p, p.reviewedRevision);
}
export function moduleAccessState(
  state: TreeState,
  manager: boolean,
): Partial<TreeState> {
  return {
    access: manager ? "manage" : "view",
    ...(!manager &&
    (state.access === "manage" || state.pending || state.toolsPending)
      ? { pending: null, toolsPending: false, draftEpoch: state.draftEpoch + 1 }
      : {}),
  };
}
export function commandEnvelope(
  pending: PendingCommand,
): FT.FamilyTreeCommand & { idempotency_key: string } {
  return {
    expected_graph_revision: pending.revision,
    idempotency_key: pending.key,
    ...(pending.reviewed
      ? {
          reviewed_warnings: [
            "chronology_review",
          ] as FT.FamilyTreeReviewedWarning[],
        }
      : {}),
  };
}
export function discoveryFailure(error: string): Partial<TreeState> {
  return {
    access: "error",
    collection: null,
    // Network discovery failure hides content, but does not revoke an acknowledged receipt.
    people: null,
    candidatePeople: null,
    graph: null,
    detail: null,
    stories: null,
    residences: null,
    compare: null,
    candidates: [],
    error,
  };
}
export function message(e: unknown): string {
  return e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "Unable to load family history. Check your connection and retry.";
}
export function code(e: unknown): string | null {
  return typeof e === "object" && e && "code" in e ? String(e.code) : null;
}
export function denied(e: unknown) {
  return (
    typeof e === "object" &&
    e &&
    "status" in e &&
    [401, 403].includes(Number(e.status))
  );
}
export function union<T extends { id: number | string }>(a: T[], b: T[]): T[] {
  return [...new Map([...a, ...b].map((row) => [row.id, row])).values()];
}
let sequence = 0;
// Opaque operation identity, not an authorization or credential token.
export function operationKey() {
  sequence++;
  return `native-tree-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
}
