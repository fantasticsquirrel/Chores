import type {
  FamilyTreeExportFormat,
  FamilyTreeJob,
  FamilyTreePerson,
} from "./family-tree";

/** Checked presentation data, never permissions, freshness or commit authority.
 * The producer JobDTO summary is an extensible dictionary. Unknown/incomplete
 * shapes return null instead of guessed counts or unsafe assertions. */
export interface FamilyTreeExportSummary {
  format: FamilyTreeExportFormat;
  people: number;
  media: number;
  media_omitted: boolean;
}
export interface FamilyTreeImportSummary {
  people: number;
  relationships: number;
  stories: number;
  residences: number;
  media: number;
  missing_media: number;
  warnings: string[];
  duplicate_provenance: boolean;
  duplicate_suggestions: {
    source_key: string;
    candidate_person_ids: number[];
  }[];
  unsupported_fields: string[];
}
export type FamilyTreeMergePersonSummary = Pick<
  FamilyTreePerson,
  "id" | "display_name" | "first_name" | "last_name"
>;
export interface FamilyTreeMergeSummary {
  source: FamilyTreeMergePersonSummary;
  target: FamilyTreeMergePersonSummary;
  conflicting_fields: string[];
  unresolved_fields: string[];
  relationship_changes: {
    table: string;
    id: number;
    endpoints: [number, number];
  }[];
  retained_records: {
    stories: number;
    residences: number;
    tags: number;
    names: number;
    media_references: number;
  };
  retargeted_alias_ids: number[];
  similar_partner_episode_ids: number[];
  requires_partner_review: boolean;
  warnings: string[];
}
export interface FamilyTreePurgeSummary {
  person_id: number;
  alias_only: boolean;
  retained_backup_policy: string;
  stories: number;
  residences: number;
  media_references: number;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function id(value: unknown): value is number {
  return count(value) && value > 0;
}
function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
function ids(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(id);
}
function nullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
function person(value: unknown): FamilyTreeMergePersonSummary | null {
  if (
    !record(value) ||
    !id(value.id) ||
    !nullableText(value.display_name) ||
    !nullableText(value.first_name) ||
    !nullableText(value.last_name)
  )
    return null;
  return {
    id: value.id,
    display_name: value.display_name,
    first_name: value.first_name,
    last_name: value.last_name,
  };
}
export function readFamilyTreeExportSummary(
  job: FamilyTreeJob,
): FamilyTreeExportSummary | null {
  const s = job.summary;
  if (
    job.kind !== "export" ||
    !record(s) ||
    (s.format !== "json" && s.format !== "zip") ||
    !count(s.people) ||
    !count(s.media) ||
    typeof s.media_omitted !== "boolean"
  )
    return null;
  return {
    format: s.format,
    people: s.people,
    media: s.media,
    media_omitted: s.media_omitted,
  };
}
export function readFamilyTreeImportSummary(
  job: FamilyTreeJob,
): FamilyTreeImportSummary | null {
  const s = job.summary;
  if (
    job.kind !== "import" ||
    !record(s) ||
    !count(s.people) ||
    !count(s.relationships) ||
    !count(s.stories) ||
    !count(s.residences) ||
    !count(s.media) ||
    !count(s.missing_media) ||
    !strings(s.warnings) ||
    typeof s.duplicate_provenance !== "boolean" ||
    !strings(s.unsupported_fields) ||
    !Array.isArray(s.duplicate_suggestions)
  )
    return null;
  const suggestions: FamilyTreeImportSummary["duplicate_suggestions"] = [];
  for (const item of s.duplicate_suggestions) {
    if (
      !record(item) ||
      typeof item.source_key !== "string" ||
      !ids(item.candidate_person_ids)
    )
      return null;
    suggestions.push({
      source_key: item.source_key,
      candidate_person_ids: [...item.candidate_person_ids],
    });
  }
  return {
    people: s.people,
    relationships: s.relationships,
    stories: s.stories,
    residences: s.residences,
    media: s.media,
    missing_media: s.missing_media,
    warnings: [...s.warnings],
    duplicate_provenance: s.duplicate_provenance,
    duplicate_suggestions: suggestions,
    unsupported_fields: [...s.unsupported_fields],
  };
}
export function readFamilyTreeMergeSummary(
  job: FamilyTreeJob,
): FamilyTreeMergeSummary | null {
  const s = job.summary;
  if (job.kind !== "merge" || !record(s)) return null;
  const source = person(s.source),
    target = person(s.target);
  if (
    !source ||
    !target ||
    !strings(s.conflicting_fields) ||
    !strings(s.unresolved_fields) ||
    !ids(s.retargeted_alias_ids) ||
    !ids(s.similar_partner_episode_ids) ||
    typeof s.requires_partner_review !== "boolean" ||
    !strings(s.warnings) ||
    !record(s.retained_records) ||
    !Array.isArray(s.relationship_changes)
  )
    return null;
  const r = s.retained_records;
  if (
    !count(r.stories) ||
    !count(r.residences) ||
    !count(r.tags) ||
    !count(r.names) ||
    !count(r.media_references)
  )
    return null;
  const changes: FamilyTreeMergeSummary["relationship_changes"] = [];
  for (const item of s.relationship_changes) {
    if (
      !record(item) ||
      typeof item.table !== "string" ||
      !id(item.id) ||
      !ids(item.endpoints) ||
      item.endpoints.length !== 2
    )
      return null;
    changes.push({
      table: item.table,
      id: item.id,
      endpoints: [item.endpoints[0], item.endpoints[1]],
    });
  }
  return {
    source,
    target,
    conflicting_fields: [...s.conflicting_fields],
    unresolved_fields: [...s.unresolved_fields],
    relationship_changes: changes,
    retained_records: {
      stories: r.stories,
      residences: r.residences,
      tags: r.tags,
      names: r.names,
      media_references: r.media_references,
    },
    retargeted_alias_ids: [...s.retargeted_alias_ids],
    similar_partner_episode_ids: [...s.similar_partner_episode_ids],
    requires_partner_review: s.requires_partner_review,
    warnings: [...s.warnings],
  };
}
export function readFamilyTreePurgeSummary(
  job: FamilyTreeJob,
): FamilyTreePurgeSummary | null {
  const s = job.summary;
  if (
    job.kind !== "purge" ||
    !record(s) ||
    !id(s.person_id) ||
    typeof s.alias_only !== "boolean" ||
    typeof s.retained_backup_policy !== "string" ||
    !count(s.stories) ||
    !count(s.residences) ||
    !count(s.media_references)
  )
    return null;
  return {
    person_id: s.person_id,
    alias_only: s.alias_only,
    retained_backup_policy: s.retained_backup_policy,
    stories: s.stories,
    residences: s.residences,
    media_references: s.media_references,
  };
}
