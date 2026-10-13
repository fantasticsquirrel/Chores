import type {
  AuthUser,
  FamilyTreeCollectionState,
  FamilyTreePerson,
  FamilyTreePersonDetail,
  FamilyTreeGraphProjection,
  FamilyTreeMutationResult,
} from "../../../api";
export const adult: AuthUser = {
  id: 41,
  household_id: 7,
  email: "adult@example.test",
  role: "PARENT",
  child_id: null,
  is_household_owner: false,
};
export function person(id = 1, name = "Alex"): FamilyTreePerson {
  return {
    id,
    display_name: name,
    first_name: name,
    middle_name: null,
    last_name: null,
    maiden_name: null,
    suffix: null,
    gender: null,
    living_status: "unknown",
    aliases: [],
    birth_date: null,
    death_date: null,
    birth_place: null,
    death_place: null,
    birth_source: null,
    death_source: null,
    notes_md: "Original note",
    source_label: null,
    source_url: null,
    tags: [],
    created_by_user_id: 41,
    created_at: "2026-10-13T00:00:00Z",
    updated_at: "2026-10-13T00:00:00Z",
    is_locked: false,
    lock_reason: null,
    locked_by_user_id: null,
    locked_at: null,
    archived_at: null,
    merged_into_person_id: null,
    primary_image_asset_id: null,
  };
}
export function collection(revision = 1, count = 1): FamilyTreeCollectionState {
  return {
    state: count ? "initialized" : "uninitialized",
    collection_id: count ? 1 : null,
    title: "Family Tree",
    graph_revision: revision,
    default_focus_person_id: count ? 1 : null,
    active_people_count: count,
    archived_people_count: 0,
    capabilities: { can_manage: true, can_export: false, can_purge: false },
  };
}
export function detail(
  record = person(),
  revision = 1,
): FamilyTreePersonDetail {
  return {
    graph_revision: revision,
    person: record,
    canonical_person: null,
    parent_links: [],
    care_links: [],
    partner_episodes: [],
    identity_link: null,
  };
}
export function graph(
  records = [person()],
  revision = 1,
): FamilyTreeGraphProjection {
  return {
    graph_revision: revision,
    focus_person_id: records[0]?.id ?? null,
    nodes: records.map((record) => ({
      id: record.id,
      display_name: record.display_name!,
      living_status: record.living_status,
      birth_date: record.birth_date,
      death_date: record.death_date,
      is_locked: record.is_locked,
      expansion_counts: { parents: 0, children: 0, partners: 0, care: 0 },
    })),
    edges: [],
    truncated: false,
    expansion_token: null,
    warnings: [],
    projection_limits: {
      max_nodes: 150,
      max_edges: 300,
      hard_max_nodes: 500,
      hard_max_edges: 1000,
    },
  };
}
export function mutation(revision = 2, ids = [1]): FamilyTreeMutationResult {
  return {
    committed_revision: revision,
    current_revision: revision,
    replayed: false,
    affected: {
      person_ids: ids,
      relationship_ids: [],
      story_ids: [],
      residence_ids: [],
      identity_link_ids: [],
      media_asset_ids: [],
      media_reference_ids: [],
    },
    warnings: [],
  };
}
