/** FT0/FT1/FT2/FT3 server contracts. The server owns validation and permissions.
 * Request defaults stay optional; PATCH never inserts defaults. Responses include
 * Pydantic-populated defaults. Dates are ISO partial values, not JS Date objects.
 */
export type FamilyTreeLivingStatus = "living" | "deceased" | "unknown";
export type FamilyTreeDatePrecision = "year" | "month" | "day";
export type FamilyTreeParentKind =
  | "biological"
  | "adoptive"
  | "step"
  | "unknown";
export type FamilyTreeCareKind = "guardian" | "caregiver";
export type FamilyTreePartnerKind =
  | "married"
  | "civil_union"
  | "partners"
  | "unknown";
export type FamilyTreePartnerStatus =
  | "current"
  | "separated"
  | "ended"
  | "unknown";
export type FamilyTreeReviewedWarning = "chronology_review";

export interface FamilyTreePartialDateInput {
  value: string;
  precision?: FamilyTreeDatePrecision | null;
  uncertain?: boolean;
}
export interface FamilyTreePartialDate {
  value: string;
  precision: FamilyTreeDatePrecision | null;
  uncertain: boolean;
}
export interface FamilyTreeAliasInput {
  name: string;
  label?: string | null;
}
export interface FamilyTreeAlias {
  name: string;
  label: string | null;
  id: number;
  created_by_user_id: number | null;
  created_at: string;
}
export interface FamilyTreePersonInput {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  maiden_name?: string | null;
  suffix?: string | null;
  display_name?: string | null;
  aliases?: FamilyTreeAliasInput[];
  gender?: string | null;
  living_status?: FamilyTreeLivingStatus;
  birth_date?: FamilyTreePartialDateInput | null;
  death_date?: FamilyTreePartialDateInput | null;
  birth_place?: string | null;
  death_place?: string | null;
  birth_source?: string | null;
  death_source?: string | null;
  notes_md?: string | null;
  source_label?: string | null;
  source_url?: string | null;
  tags?: string[];
}
// Explicit null clears nullable facts; omission leaves existing facts unchanged.
export type FamilyTreePersonChanges = FamilyTreePersonInput;
export interface FamilyTreePerson extends Omit<
  Required<FamilyTreePersonInput>,
  "aliases" | "birth_date" | "death_date"
> {
  aliases: FamilyTreeAlias[];
  birth_date: FamilyTreePartialDate | null;
  death_date: FamilyTreePartialDate | null;
  id: number;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
  is_locked: boolean;
  lock_reason: string | null;
  locked_by_user_id: number | null;
  locked_at: string | null;
  archived_at: string | null;
  merged_into_person_id: number | null;
  primary_image_asset_id: number | null;
}

export interface FamilyTreeCommand {
  expected_graph_revision: number;
  reviewed_warnings?: FamilyTreeReviewedWarning[];
  idempotency_key?: string | null;
}
export interface FamilyTreeReasonCommand extends FamilyTreeCommand {
  reason: string;
}
export interface FamilyTreeCreatePersonRequest extends FamilyTreeCommand {
  idempotency_key: string;
  person: FamilyTreePersonInput;
}
export interface FamilyTreePatchPersonRequest extends FamilyTreeCommand {
  changes: FamilyTreePersonChanges;
}
export interface FamilyTreeCitationInput {
  notes_md?: string | null;
  source_label?: string | null;
  source_url?: string | null;
}
export interface FamilyTreeDatedCitationInput extends FamilyTreeCitationInput {
  start_date?: FamilyTreePartialDateInput | null;
  end_date?: FamilyTreePartialDateInput | null;
}
export type FamilyTreeCitation = Required<FamilyTreeCitationInput>;
export interface FamilyTreeDatedCitation extends FamilyTreeCitation {
  start_date: FamilyTreePartialDate | null;
  end_date: FamilyTreePartialDate | null;
}
export interface FamilyTreeParentData extends FamilyTreeCitationInput {
  parent_person_id: number;
  child_person_id: number;
  kind: FamilyTreeParentKind;
}
export interface FamilyTreeCareData extends FamilyTreeDatedCitationInput {
  caregiver_person_id: number;
  recipient_person_id: number;
  kind: FamilyTreeCareKind;
}
export interface FamilyTreePartnerData extends FamilyTreeDatedCitationInput {
  person_a_id: number;
  person_b_id: number;
  kind: FamilyTreePartnerKind;
  status?: FamilyTreePartnerStatus;
}
export interface FamilyTreeParentChanges extends FamilyTreeCitationInput {
  parent_person_id?: number | null;
  child_person_id?: number | null;
  kind?: FamilyTreeParentKind | null;
}
export interface FamilyTreeCareChanges extends FamilyTreeDatedCitationInput {
  caregiver_person_id?: number | null;
  recipient_person_id?: number | null;
  kind?: FamilyTreeCareKind | null;
}
export interface FamilyTreePartnerChanges extends FamilyTreeDatedCitationInput {
  person_a_id?: number | null;
  person_b_id?: number | null;
  kind?: FamilyTreePartnerKind | null;
  status?: FamilyTreePartnerStatus | null;
}
export interface FamilyTreeCreateParentLinkRequest
  extends FamilyTreeCommand, FamilyTreeParentData {}
export interface FamilyTreeCreateCareLinkRequest
  extends FamilyTreeCommand, FamilyTreeCareData {}
export interface FamilyTreeCreatePartnerEpisodeRequest
  extends FamilyTreeCommand, FamilyTreePartnerData {}
export interface FamilyTreePatchParentLinkRequest extends FamilyTreeCommand {
  changes: FamilyTreeParentChanges;
}
export interface FamilyTreePatchCareLinkRequest extends FamilyTreeCommand {
  changes: FamilyTreeCareChanges;
}
export interface FamilyTreePatchPartnerEpisodeRequest extends FamilyTreeCommand {
  changes: FamilyTreePartnerChanges;
}
export interface FamilyTreeRelativeRelationship extends FamilyTreeDatedCitationInput {
  direction: "parent" | "child" | "caregiver" | "recipient" | "partner";
  kind: FamilyTreeParentKind | FamilyTreeCareKind | FamilyTreePartnerKind;
  status?: FamilyTreePartnerStatus;
}
export interface FamilyTreeCreateRelativeRequest extends FamilyTreeCommand {
  idempotency_key: string;
  anchor_person_id: number;
  relationship: FamilyTreeRelativeRelationship;
  person: FamilyTreePersonInput;
}
export interface FamilyTreeParentLink extends FamilyTreeCitation {
  parent_person_id: number;
  child_person_id: number;
  kind: FamilyTreeParentKind;
  id: number;
  created_by_user_id: number | null;
}
export interface FamilyTreeCareLink extends FamilyTreeDatedCitation {
  caregiver_person_id: number;
  recipient_person_id: number;
  kind: FamilyTreeCareKind;
  id: number;
  created_by_user_id: number | null;
}
export interface FamilyTreePartnerEpisode extends FamilyTreeDatedCitation {
  person_a_id: number;
  person_b_id: number;
  kind: FamilyTreePartnerKind;
  status: FamilyTreePartnerStatus;
  id: number;
  created_by_user_id: number | null;
}
export interface FamilyTreeStoryInput {
  title: string;
  body_md: string;
  date?: FamilyTreePartialDateInput | null;
  source_label?: string | null;
  source_url?: string | null;
}
export interface FamilyTreeStoryChanges {
  title?: string | null;
  body_md?: string | null;
  date?: FamilyTreePartialDateInput | null;
  source_label?: string | null;
  source_url?: string | null;
}
export interface FamilyTreeStory {
  title: string;
  body_md: string;
  date: FamilyTreePartialDate | null;
  source_label: string | null;
  source_url: string | null;
  id: number;
  person_id: number;
  position: number;
  created_by_user_id: number | null;
}
export interface FamilyTreeCreateStoryRequest extends FamilyTreeCommand {
  idempotency_key: string;
  story: FamilyTreeStoryInput;
}
export interface FamilyTreePatchStoryRequest extends FamilyTreeCommand {
  changes: FamilyTreeStoryChanges;
}
export interface FamilyTreeReorderStoriesRequest extends FamilyTreeCommand {
  story_ids: number[];
}
export interface FamilyTreeResidenceInput extends FamilyTreeDatedCitationInput {
  place: string;
  is_primary?: boolean;
}
export interface FamilyTreeResidenceChanges extends FamilyTreeDatedCitationInput {
  place?: string | null;
  is_primary?: boolean | null;
}
export interface FamilyTreeResidence extends FamilyTreeDatedCitation {
  place: string;
  is_primary: boolean;
  id: number;
  person_id: number;
  created_by_user_id: number | null;
}
export interface FamilyTreeCreateResidenceRequest extends FamilyTreeCommand {
  residence: FamilyTreeResidenceInput;
}
export interface FamilyTreePatchResidenceRequest extends FamilyTreeCommand {
  changes: FamilyTreeResidenceChanges;
}
// Exactly one same-household target is also enforced by the server validator.
export interface FamilyTreeLinkIdentityRequest extends FamilyTreeCommand {
  user_id?: number | null;
  child_id?: number | null;
  confirmed: true;
}
export interface FamilyTreeIdentityLink {
  id: number;
  person_id: number;
  user_id: number | null;
  child_id: number | null;
  active: boolean;
  label: string;
}
export interface FamilyTreeIdentityCandidate {
  kind: "user" | "child";
  id: number;
  label: string;
  active: boolean;
}
export interface FamilyTreeIdentityCandidates {
  items: FamilyTreeIdentityCandidate[];
}
export interface FamilyTreeAffected {
  person_ids: number[];
  relationship_ids: number[];
  story_ids: number[];
  residence_ids: number[];
  identity_link_ids: number[];
  media_asset_ids: number[];
  media_reference_ids: number[];
}
export interface FamilyTreeMutationResult {
  committed_revision: number;
  current_revision: number;
  replayed: boolean;
  affected: FamilyTreeAffected;
  warnings: string[];
}
export interface FamilyTreeCapabilities {
  can_manage: boolean;
  can_export: boolean;
  can_purge: boolean;
}
export interface FamilyTreeCollectionState {
  state: "uninitialized" | "initialized";
  collection_id: number | null;
  title: string;
  graph_revision: number;
  default_focus_person_id: number | null;
  active_people_count: number;
  archived_people_count: number;
  capabilities: FamilyTreeCapabilities;
}
export interface FamilyTreePersonDetail {
  graph_revision: number;
  person: FamilyTreePerson;
  canonical_person: FamilyTreePerson | null;
  parent_links: FamilyTreeParentLink[];
  care_links: FamilyTreeCareLink[];
  partner_episodes: FamilyTreePartnerEpisode[];
  identity_link: FamilyTreeIdentityLink | null;
}
export interface FamilyTreePeoplePage {
  graph_revision: number;
  items: FamilyTreePerson[];
  total: number;
  next_cursor: number | null;
}
export interface FamilyTreeStoriesPage {
  graph_revision: number;
  items: FamilyTreeStory[];
  next_cursor: number | null;
}
export interface FamilyTreeResidencesPage {
  graph_revision: number;
  items: FamilyTreeResidence[];
  next_cursor: number | null;
}
export interface FamilyTreePageParams {
  cursor?: number | null;
  limit?: number;
}
export interface FamilyTreePeopleParams extends FamilyTreePageParams {
  query?: string;
  tag?: string | null;
  living_status?: FamilyTreeLivingStatus | null;
  archived?: boolean;
}
export interface FamilyTreeGraphNode {
  id: number;
  display_name: string;
  living_status: FamilyTreeLivingStatus;
  birth_date: FamilyTreePartialDate | null;
  death_date: FamilyTreePartialDate | null;
  is_locked: boolean;
  expansion_counts: Record<
    "parents" | "children" | "partners" | "care",
    number
  >;
}
export interface FamilyTreeGraphEdge {
  id: string;
  record_id: number;
  source_person_id: number;
  target_person_id: number;
  type: "parent" | "care" | "partner";
  kind: string;
  status: FamilyTreePartnerStatus | null;
  start_date: FamilyTreePartialDate | null;
  end_date: FamilyTreePartialDate | null;
}
export interface FamilyTreeProjectionLimits {
  max_nodes: number;
  max_edges: number;
  hard_max_nodes: number;
  hard_max_edges: number;
}
export interface FamilyTreeGraphProjection {
  graph_revision: number;
  focus_person_id: number | null;
  nodes: FamilyTreeGraphNode[];
  edges: FamilyTreeGraphEdge[];
  truncated: boolean;
  expansion_token: string | null;
  warnings: string[];
  projection_limits: FamilyTreeProjectionLimits;
}
export interface FamilyTreeGraphParams {
  focus_person_id?: number | null;
  up_depth?: number;
  down_depth?: number;
  include_partners?: boolean;
  include_history?: boolean;
  include_care?: boolean;
  max_nodes?: number;
  max_edges?: number;
  expansion_token?: string | null;
  collapsed_up_ids?: readonly number[] | null;
  collapsed_down_ids?: readonly number[] | null;
}
export interface FamilyTreeCompareParams {
  person_a_id: number;
  person_b_id: number;
  include_history?: boolean;
  max_nodes?: number;
  max_edges?: number;
}
export interface FamilyTreeCompareResult {
  graph_revision: number;
  person_a_id: number;
  person_b_id: number;
  state: "connected" | "disconnected" | "truncated";
  distance: number | null;
  person_ids: number[];
  path: FamilyTreeGraphEdge[];
  warnings: string[];
  projection_limits: FamilyTreeProjectionLimits;
}
export type FamilyTreeErrorCode =
  | "revision_conflict"
  | "person_locked"
  | "person_merged"
  | "relationship_cycle"
  | "identity_link_conflict"
  | "idempotency_conflict"
  | "integrity_conflict"
  | "resource_limit"
  | "validation_error"
  | "chronology_review"
  | "server_busy"
  | "merge_aliases_present"
  | "merge_conflict"
  | "transfer_expired"
  | "media_unavailable"
  | "storage_unavailable";
// Domain exceptions serialize exclude_unset, unlike normal response_model DTOs.
export interface FamilyTreeErrorDetail {
  code: FamilyTreeErrorCode;
  message: string;
  canonical_person_id?: number | null;
  warnings?: string[];
  blocking_alias_ids?: number[];
}
export interface FamilyTreeErrorResponse {
  detail: FamilyTreeErrorDetail | string;
}

// Managed assets have no public URL or server filesystem path.
export type FamilyTreeMediaRole = "primary" | "gallery" | "story";
export interface FamilyTreeMedia {
  id: number;
  mime_type: string;
  byte_size: number;
  checksum: string;
  width: number;
  height: number;
  caption: string | null;
  state: string;
}
export interface FamilyTreeMediaReference {
  id: number;
  asset_id: number;
  person_id: number;
  story_id: number | null;
  role: string;
  asset: FamilyTreeMedia;
}
export interface FamilyTreeAttachMediaRequest extends FamilyTreeCommand {
  person_id: number;
  story_id?: number | null;
  role?: FamilyTreeMediaRole;
}
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

// Portable v1 uses source keys, not local account/household IDs. These typings
// describe data, never authorize import or replace server package validation.
export interface FamilyTreePortableProvenanceInput {
  source_label?: string | null;
  created_at?: string | null;
  attribution?: string | null;
}
export type FamilyTreePortableProvenance =
  Required<FamilyTreePortableProvenanceInput>;
export interface FamilyTreePortablePersonInput {
  key: string;
  person: FamilyTreePersonInput;
  is_locked?: boolean;
  lock_reason?: string | null;
  archived?: boolean;
  merged_into_key?: string | null;
  provenance?: FamilyTreePortableProvenanceInput;
}
export interface FamilyTreePortableParentInput extends FamilyTreeCitationInput {
  key: string;
  parent_key: string;
  child_key: string;
  kind: FamilyTreeParentKind;
  provenance?: FamilyTreePortableProvenanceInput;
}
export interface FamilyTreePortableCareInput extends FamilyTreeDatedCitationInput {
  key: string;
  caregiver_key: string;
  recipient_key: string;
  kind: FamilyTreeCareKind;
  provenance?: FamilyTreePortableProvenanceInput;
}
export interface FamilyTreePortablePartnerInput extends FamilyTreeDatedCitationInput {
  key: string;
  person_a_key: string;
  person_b_key: string;
  kind: FamilyTreePartnerKind;
  status?: FamilyTreePartnerStatus;
  provenance?: FamilyTreePortableProvenanceInput;
}
export interface FamilyTreePortableStoryInput {
  key: string;
  person_key: string;
  story: FamilyTreeStoryInput;
  position: number;
  provenance?: FamilyTreePortableProvenanceInput;
}
export interface FamilyTreePortableResidenceInput {
  key: string;
  person_key: string;
  residence: FamilyTreeResidenceInput;
  provenance?: FamilyTreePortableProvenanceInput;
}
export interface FamilyTreePortableMediaInput {
  key: string;
  path: string;
  mime_type: "image/png" | "image/jpeg" | "image/webp";
  checksum: string;
  byte_size: number;
  caption?: string | null;
}
export interface FamilyTreePortableReferenceInput {
  key: string;
  asset_key: string;
  person_key: string;
  story_key?: string | null;
  role: FamilyTreeMediaRole;
}
export interface FamilyTreeManifestInput {
  schema_version: 1;
  producer: string;
  exported_at: string;
  collection_title: string;
  snapshot_revision: number;
  default_focus_key?: string | null;
  media_omitted?: boolean;
  people?: FamilyTreePortablePersonInput[];
  parent_links?: FamilyTreePortableParentInput[];
  care_links?: FamilyTreePortableCareInput[];
  partner_episodes?: FamilyTreePortablePartnerInput[];
  stories?: FamilyTreePortableStoryInput[];
  residences?: FamilyTreePortableResidenceInput[];
  media?: FamilyTreePortableMediaInput[];
  media_references?: FamilyTreePortableReferenceInput[];
}
// Actual normalized export includes producer-populated nested defaults.
export interface FamilyTreePortablePersonData extends Omit<
  Required<FamilyTreePersonInput>,
  "aliases" | "birth_date" | "death_date"
> {
  aliases: Required<FamilyTreeAliasInput>[];
  birth_date: FamilyTreePartialDate | null;
  death_date: FamilyTreePartialDate | null;
}
export interface FamilyTreePortablePerson extends Omit<
  Required<FamilyTreePortablePersonInput>,
  "person" | "provenance"
> {
  person: FamilyTreePortablePersonData;
  provenance: FamilyTreePortableProvenance;
}
export interface FamilyTreePortableParent extends Omit<
  Required<FamilyTreePortableParentInput>,
  "provenance"
> {
  provenance: FamilyTreePortableProvenance;
}
export interface FamilyTreePortableCare extends Omit<
  Required<FamilyTreePortableCareInput>,
  "provenance" | "start_date" | "end_date"
> {
  provenance: FamilyTreePortableProvenance;
  start_date: FamilyTreePartialDate | null;
  end_date: FamilyTreePartialDate | null;
}
export interface FamilyTreePortablePartner extends Omit<
  Required<FamilyTreePortablePartnerInput>,
  "provenance" | "start_date" | "end_date"
> {
  provenance: FamilyTreePortableProvenance;
  start_date: FamilyTreePartialDate | null;
  end_date: FamilyTreePartialDate | null;
}
export interface FamilyTreePortableStoryData extends Omit<
  Required<FamilyTreeStoryInput>,
  "date"
> {
  date: FamilyTreePartialDate | null;
}
export interface FamilyTreePortableStory extends Omit<
  Required<FamilyTreePortableStoryInput>,
  "story" | "provenance"
> {
  story: FamilyTreePortableStoryData;
  provenance: FamilyTreePortableProvenance;
}
export interface FamilyTreePortableResidenceData extends FamilyTreeDatedCitation {
  place: string;
  is_primary: boolean;
}
export interface FamilyTreePortableResidence extends Omit<
  Required<FamilyTreePortableResidenceInput>,
  "residence" | "provenance"
> {
  residence: FamilyTreePortableResidenceData;
  provenance: FamilyTreePortableProvenance;
}
export type FamilyTreePortableMedia = Required<FamilyTreePortableMediaInput>;
export type FamilyTreePortableReference =
  Required<FamilyTreePortableReferenceInput>;
export interface FamilyTreeManifest extends Omit<
  Required<FamilyTreeManifestInput>,
  | "people"
  | "parent_links"
  | "care_links"
  | "partner_episodes"
  | "stories"
  | "residences"
  | "media"
  | "media_references"
> {
  people: FamilyTreePortablePerson[];
  parent_links: FamilyTreePortableParent[];
  care_links: FamilyTreePortableCare[];
  partner_episodes: FamilyTreePortablePartner[];
  stories: FamilyTreePortableStory[];
  residences: FamilyTreePortableResidence[];
  media: FamilyTreePortableMedia[];
  media_references: FamilyTreePortableReference[];
}
