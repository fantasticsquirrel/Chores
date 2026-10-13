import type { FamilyTreeCommand } from "./family-tree-core";

/** Revision-bound merge, purge and staged package transfer contracts. */
export interface FamilyTreeMergePreviewRequest extends FamilyTreeCommand {
  source_person_id: number;
  target_person_id: number;
  scalar_choices?: Record<string, "source" | "target">;
  retain_similar_partner_episodes?: boolean;
}
export interface FamilyTreePreviewCommitRequest extends FamilyTreeCommand {
  idempotency_key: string;
  preview_token: string;
}
export interface FamilyTreePurgePreviewRequest extends FamilyTreeCommand {
  password: string;
}
export interface FamilyTreePurgeCommitRequest extends FamilyTreePreviewCommitRequest {
  password: string;
}
export type FamilyTreeExportFormat = "json" | "zip";
export interface FamilyTreeExportRequest {
  format?: FamilyTreeExportFormat;
}
export interface FamilyTreeImportCommitRequest extends FamilyTreeCommand {
  idempotency_key: string;
  confirmed: true;
  acknowledge_duplicate_provenance?: boolean;
}
/** Wire schema intentionally leaves kind/state/summary generic. Never cast a
 * summary to grant authority; use the checked display-summary helpers. */
export interface FamilyTreeJob {
  id: number;
  kind: string;
  state: string;
  expected_graph_revision: number;
  expires_at: string;
  summary: Record<string, unknown>;
}
export interface FamilyTreePreview extends FamilyTreeJob {
  preview_token: string;
}
