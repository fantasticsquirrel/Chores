import type {
  FamilyTreeAliasInput,
  FamilyTreeCareKind,
  FamilyTreeCitationInput,
  FamilyTreeDatedCitation,
  FamilyTreeDatedCitationInput,
  FamilyTreeParentKind,
  FamilyTreePartialDate,
  FamilyTreePartnerKind,
  FamilyTreePartnerStatus,
  FamilyTreePersonInput,
  FamilyTreeResidenceInput,
  FamilyTreeStoryInput,
} from "./family-tree-core";
import type { FamilyTreeMediaRole } from "./family-tree-media";

// Portable v1 uses source keys, not local account/household IDs. These typings
// describe data, never authorize import or replace server package validation.
export interface FamilyTreePortableProvenanceInput {
  source_label?: string | null;
  created_at?: string | null;
  attribution?: string | null;
}
export type FamilyTreePortableProvenance =
  Required<FamilyTreePortableProvenanceInput>;
export interface FamilyTreePortableAliasProvenanceInput
  extends FamilyTreePortableProvenanceInput {
  status?: "known" | "unknown";
}
export type FamilyTreePortableAliasProvenance =
  Required<FamilyTreePortableAliasProvenanceInput>;
export interface FamilyTreePortableAliasInput extends FamilyTreeAliasInput {
  provenance?: FamilyTreePortableAliasProvenanceInput;
}
export interface FamilyTreePortableAlias extends Required<FamilyTreeAliasInput> {
  provenance: FamilyTreePortableAliasProvenance;
}
export interface FamilyTreePortablePersonDataInput extends Omit<
  FamilyTreePersonInput,
  "aliases"
> {
  aliases?: FamilyTreePortableAliasInput[];
}
export interface FamilyTreePortablePersonInput {
  key: string;
  person: FamilyTreePortablePersonDataInput;
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
  aliases: FamilyTreePortableAlias[];
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
