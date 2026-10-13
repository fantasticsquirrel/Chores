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
};
export type TreeState = {
  access: "loading" | "denied" | "error" | "view" | "manage";
  loading: boolean;
  busy: boolean;
  error: string | null;
  mutationError: string | null;
  collection: FT.FamilyTreeCollectionState | null;
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
  error: null,
  mutationError: null,
  collection: null,
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
