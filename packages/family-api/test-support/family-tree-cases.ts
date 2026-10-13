import type { FamilyTreeApiEndpoints } from "../src/endpoints/family-tree";
import type { FamilyTreeCommand } from "../src/models/family-tree";

const command: FamilyTreeCommand = {
  expected_graph_revision: 4,
  reviewed_warnings: ["chronology_review"],
  idempotency_key: "command-key",
};
const person = {
  display_name: "Ada",
  birth_date: { value: "1900", uncertain: true },
};
const createPerson = { ...command, idempotency_key: "person-1", person };
const parent = {
  ...command,
  parent_person_id: 2,
  child_person_id: 7,
  kind: "adoptive" as const,
};
const care = {
  ...command,
  caregiver_person_id: 2,
  recipient_person_id: 7,
  kind: "guardian" as const,
  end_date: null,
};
const partner = {
  ...command,
  person_a_id: 2,
  person_b_id: 7,
  kind: "civil_union" as const,
  status: "ended" as const,
};
export interface FamilyTreeCase {
  name: string;
  method: string;
  path: string;
  schema?: string;
  response?: string;
  responseArray?: boolean;
  binary?: boolean;
  multipart?: readonly string[];
  query?: Record<string, unknown>;
  body?: unknown;
  invoke: (api: FamilyTreeApiEndpoints) => Promise<unknown>;
}
const mediaForm = new FormData();
mediaForm.append(
  "file",
  new Blob(["image"], { type: "image/png" }),
  "photo.png",
);
mediaForm.append("caption", "Original caption");
const importForm = new FormData();
importForm.append(
  "file",
  new Blob(["{}"], { type: "application/json" }),
  "tree.json",
);
importForm.append("expected_graph_revision", "4");
const mergePreview = {
  ...command,
  source_person_id: 2,
  target_person_id: 7,
  scalar_choices: { display_name: "target" as const },
  retain_similar_partner_episodes: true,
};
const previewCommit = {
  ...command,
  idempotency_key: "commit-key",
  preview_token: "a".repeat(64),
};
const purgePreview = { ...command, password: " fresh password " };
const purgeCommit = { ...previewCommit, password: " fresh password " };
const importCommit = {
  ...command,
  idempotency_key: "import-key",
  confirmed: true as const,
  acknowledge_duplicate_provenance: true,
};
export const familyTreeCases: FamilyTreeCase[] = [
  {
    name: "getFamilyTreeCollection",
    method: "get",
    path: "/family-tree/",
    response: "CollectionState",
    invoke: (api: FamilyTreeApiEndpoints) => api.getFamilyTreeCollection(),
  },
  {
    name: "listFamilyTreePeople",
    method: "get",
    path: "/family-tree/people",
    response: "PeoplePage",
    query: {
      query: "Ada & Ann",
      tag: "research",
      living_status: "unknown",
      archived: false,
      cursor: 8,
      limit: 12,
    },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.listFamilyTreePeople({
        query: "Ada & Ann",
        tag: "research",
        living_status: "unknown",
        archived: false,
        cursor: 8,
        limit: 12,
      }),
  },
  {
    name: "getFamilyTreePerson",
    method: "get",
    path: "/family-tree/people/{person_id}",
    response: "PersonDetail",
    invoke: (api: FamilyTreeApiEndpoints) => api.getFamilyTreePerson(7),
  },
  {
    name: "getFamilyTreeGraph",
    method: "get",
    path: "/family-tree/graph",
    response: "GraphProjection",
    query: {
      focus_person_id: 7,
      up_depth: 0,
      down_depth: 3,
      include_partners: false,
      include_history: true,
      include_care: true,
      max_nodes: 40,
      max_edges: 60,
      expansion_token: "a & b",
      collapsed_up_ids: [2, 3],
      collapsed_down_ids: [8, 9],
    },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.getFamilyTreeGraph({
        focus_person_id: 7,
        up_depth: 0,
        down_depth: 3,
        include_partners: false,
        include_history: true,
        include_care: true,
        max_nodes: 40,
        max_edges: 60,
        expansion_token: "a & b",
        collapsed_up_ids: [2, 3],
        collapsed_down_ids: [8, 9],
      }),
  },
  {
    name: "compareFamilyTreePeople",
    method: "get",
    path: "/family-tree/compare",
    response: "CompareResult",
    query: {
      person_a_id: 2,
      person_b_id: 7,
      include_history: false,
      max_nodes: 40,
      max_edges: 60,
    },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.compareFamilyTreePeople({
        person_a_id: 2,
        person_b_id: 7,
        include_history: false,
        max_nodes: 40,
        max_edges: 60,
      }),
  },
  {
    name: "listFamilyTreeIdentityCandidates",
    method: "get",
    path: "/family-tree/identity-candidates",
    response: "IdentityCandidates",
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.listFamilyTreeIdentityCandidates(),
  },
  {
    name: "createFamilyTreePerson",
    method: "post",
    path: "/family-tree/people",
    schema: "CreatePerson",
    body: createPerson,
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.createFamilyTreePerson(createPerson),
  },
  {
    name: "patchFamilyTreePerson",
    method: "patch",
    path: "/family-tree/people/{person_id}",
    schema: "PatchPerson",
    body: { ...command, changes: { death_place: null, display_name: "Ada" } },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.patchFamilyTreePerson(7, {
        ...command,
        changes: { death_place: null, display_name: "Ada" },
      }),
  },
  {
    name: "createFamilyTreeRelative",
    method: "post",
    path: "/family-tree/relatives",
    schema: "CreateRelative",
    body: {
      ...createPerson,
      anchor_person_id: 2,
      relationship: { direction: "child", kind: "biological" },
    },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.createFamilyTreeRelative({
        ...createPerson,
        anchor_person_id: 2,
        relationship: { direction: "child", kind: "biological" },
      }),
  },
  ...(["archive", "restore"] as const).map((action) => ({
    name: `${action}FamilyTreePerson`,
    method: "post",
    path: `/family-tree/people/{person_id}/${action}`,
    schema: "Command",
    body: command,
    invoke: (api: FamilyTreeApiEndpoints) =>
      action === "archive"
        ? api.archiveFamilyTreePerson(7, command)
        : api.restoreFamilyTreePerson(7, command),
  })),
  ...(["lock", "unlock"] as const).map((action) => ({
    name: `${action}FamilyTreePerson`,
    method: "post",
    path: `/family-tree/people/{person_id}/${action}`,
    schema: "ReasonCommand",
    body: { ...command, reason: "Reviewed source" },
    invoke: (api: FamilyTreeApiEndpoints) =>
      action === "lock"
        ? api.lockFamilyTreePerson(7, { ...command, reason: "Reviewed source" })
        : api.unlockFamilyTreePerson(7, {
            ...command,
            reason: "Reviewed source",
          }),
  })),
  {
    name: "createFamilyTreeParentLink",
    method: "post",
    path: "/family-tree/parent-links",
    schema: "CreateParent",
    body: parent,
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.createFamilyTreeParentLink(parent),
  },
  {
    name: "patchFamilyTreeParentLink",
    method: "patch",
    path: "/family-tree/parent-links/{relationship_id}",
    schema: "PatchParent",
    body: { ...command, changes: { kind: "step" } },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.patchFamilyTreeParentLink(7, {
        ...command,
        changes: { kind: "step" },
      }),
  },
  {
    name: "deleteFamilyTreeParentLink",
    method: "delete",
    path: "/family-tree/parent-links/{relationship_id}",
    schema: "Command",
    body: command,
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.deleteFamilyTreeParentLink(7, command),
  },
  {
    name: "createFamilyTreeCareLink",
    method: "post",
    path: "/family-tree/care-links",
    schema: "CreateCare",
    body: care,
    invoke: (api: FamilyTreeApiEndpoints) => api.createFamilyTreeCareLink(care),
  },
  {
    name: "patchFamilyTreeCareLink",
    method: "patch",
    path: "/family-tree/care-links/{relationship_id}",
    schema: "PatchCare",
    body: { ...command, changes: { end_date: null } },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.patchFamilyTreeCareLink(7, {
        ...command,
        changes: { end_date: null },
      }),
  },
  {
    name: "deleteFamilyTreeCareLink",
    method: "delete",
    path: "/family-tree/care-links/{relationship_id}",
    schema: "Command",
    body: command,
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.deleteFamilyTreeCareLink(7, command),
  },
  {
    name: "createFamilyTreePartnerEpisode",
    method: "post",
    path: "/family-tree/partner-episodes",
    schema: "CreatePartner",
    body: partner,
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.createFamilyTreePartnerEpisode(partner),
  },
  {
    name: "patchFamilyTreePartnerEpisode",
    method: "patch",
    path: "/family-tree/partner-episodes/{relationship_id}",
    schema: "PatchPartner",
    body: { ...command, changes: { status: "separated", end_date: null } },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.patchFamilyTreePartnerEpisode(7, {
        ...command,
        changes: { status: "separated", end_date: null },
      }),
  },
  {
    name: "deleteFamilyTreePartnerEpisode",
    method: "delete",
    path: "/family-tree/partner-episodes/{relationship_id}",
    schema: "Command",
    body: command,
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.deleteFamilyTreePartnerEpisode(7, command),
  },
  {
    name: "listFamilyTreeStories",
    method: "get",
    path: "/family-tree/people/{person_id}/stories",
    response: "StoriesPage",
    query: { cursor: 8, limit: 12 },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.listFamilyTreeStories(7, { cursor: 8, limit: 12 }),
  },
  {
    name: "createFamilyTreeStory",
    method: "post",
    path: "/family-tree/people/{person_id}/stories",
    schema: "CreateStory",
    body: {
      ...command,
      idempotency_key: "story-1",
      story: {
        title: "Early life",
        body_md: "A paragraph",
        date: { value: "1900-03" },
      },
    },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.createFamilyTreeStory(7, {
        ...command,
        idempotency_key: "story-1",
        story: {
          title: "Early life",
          body_md: "A paragraph",
          date: { value: "1900-03" },
        },
      }),
  },
  {
    name: "patchFamilyTreeStory",
    method: "patch",
    path: "/family-tree/stories/{record_id}",
    schema: "PatchStory",
    body: { ...command, changes: { source_url: null } },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.patchFamilyTreeStory(7, {
        ...command,
        changes: { source_url: null },
      }),
  },
  {
    name: "deleteFamilyTreeStory",
    method: "delete",
    path: "/family-tree/stories/{record_id}",
    schema: "Command",
    body: command,
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.deleteFamilyTreeStory(7, command),
  },
  {
    name: "listFamilyTreeResidences",
    method: "get",
    path: "/family-tree/people/{person_id}/residences",
    response: "ResidencesPage",
    query: { cursor: 8, limit: 12 },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.listFamilyTreeResidences(7, { cursor: 8, limit: 12 }),
  },
  {
    name: "createFamilyTreeResidence",
    method: "post",
    path: "/family-tree/people/{person_id}/residences",
    schema: "CreateResidence",
    body: { ...command, residence: { place: "London", is_primary: true } },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.createFamilyTreeResidence(7, {
        ...command,
        residence: { place: "London", is_primary: true },
      }),
  },
  {
    name: "patchFamilyTreeResidence",
    method: "patch",
    path: "/family-tree/residences/{record_id}",
    schema: "PatchResidence",
    body: { ...command, changes: { is_primary: false, end_date: null } },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.patchFamilyTreeResidence(7, {
        ...command,
        changes: { is_primary: false, end_date: null },
      }),
  },
  {
    name: "deleteFamilyTreeResidence",
    method: "delete",
    path: "/family-tree/residences/{record_id}",
    schema: "Command",
    body: command,
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.deleteFamilyTreeResidence(7, command),
  },
  {
    name: "reorderFamilyTreeStories",
    method: "post",
    path: "/family-tree/people/{person_id}/stories/reorder",
    schema: "ReorderStories",
    body: { ...command, story_ids: [8, 7] },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.reorderFamilyTreeStories(7, { ...command, story_ids: [8, 7] }),
  },
  {
    name: "linkFamilyTreeIdentity",
    method: "put",
    path: "/family-tree/people/{person_id}/identity-link",
    schema: "LinkIdentity",
    body: { ...command, user_id: 2, confirmed: true },
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.linkFamilyTreeIdentity(7, {
        ...command,
        user_id: 2,
        confirmed: true,
      }),
  },
  {
    name: "unlinkFamilyTreeIdentity",
    method: "delete",
    path: "/family-tree/people/{person_id}/identity-link",
    schema: "Command",
    body: command,
    invoke: (api: FamilyTreeApiEndpoints) =>
      api.unlinkFamilyTreeIdentity(7, command),
  },
  {
    name: "uploadFamilyTreeMedia",
    method: "post",
    path: "/family-tree/media",
    response: "MediaDTO",
    multipart: ["file", "caption"],
    body: mediaForm,
    invoke: (api) => api.uploadFamilyTreeMedia(mediaForm),
  },
  {
    name: "getFamilyTreeMediaContent",
    method: "get",
    path: "/family-tree/media/{asset_id}/content",
    response: "BinaryDownload",
    binary: true,
    invoke: (api) => api.getFamilyTreeMediaContent(7),
  },
  {
    name: "listFamilyTreeMediaReferences",
    method: "get",
    path: "/family-tree/people/{person_id}/media",
    response: "MediaReferenceDTO",
    responseArray: true,
    invoke: (api) => api.listFamilyTreeMediaReferences(7),
  },
  {
    name: "attachFamilyTreeMedia",
    method: "post",
    path: "/family-tree/media/{asset_id}/attach",
    schema: "AttachMedia",
    body: { ...command, person_id: 7, role: "gallery" },
    invoke: (api) =>
      api.attachFamilyTreeMedia(7, {
        ...command,
        person_id: 7,
        role: "gallery",
      }),
  },
  {
    name: "removeFamilyTreeMediaReference",
    method: "delete",
    path: "/family-tree/media/{asset_id}/references/{reference_id}",
    schema: "Command",
    body: command,
    invoke: (api) => api.removeFamilyTreeMediaReference(7, 7, command),
  },
  {
    name: "previewFamilyTreeMerge",
    method: "post",
    path: "/family-tree/merge-preview",
    schema: "MergePreview",
    response: "PreviewDTO",
    body: mergePreview,
    invoke: (api) => api.previewFamilyTreeMerge(mergePreview),
  },
  {
    name: "commitFamilyTreeMerge",
    method: "post",
    path: "/family-tree/merge",
    schema: "PreviewCommit",
    body: previewCommit,
    invoke: (api) => api.commitFamilyTreeMerge(previewCommit),
  },
  {
    name: "previewFamilyTreePurge",
    method: "post",
    path: "/family-tree/people/{person_id}/purge-preview",
    schema: "PurgePreview",
    response: "PreviewDTO",
    body: purgePreview,
    invoke: (api) => api.previewFamilyTreePurge(7, purgePreview),
  },
  {
    name: "commitFamilyTreePurge",
    method: "post",
    path: "/family-tree/people/{person_id}/purge",
    schema: "PurgeCommit",
    body: purgeCommit,
    invoke: (api) => api.commitFamilyTreePurge(7, purgeCommit),
  },
  {
    name: "createFamilyTreeExport",
    method: "post",
    path: "/family-tree/exports",
    schema: "ExportRequest",
    response: "JobDTO",
    body: { format: "json" },
    invoke: (api) => api.createFamilyTreeExport({ format: "json" }),
  },
  {
    name: "getFamilyTreeExportJob",
    method: "get",
    path: "/family-tree/exports/{job_id}",
    response: "JobDTO",
    invoke: (api) => api.getFamilyTreeExportJob(7),
  },
  {
    name: "downloadFamilyTreeExport",
    method: "get",
    path: "/family-tree/exports/{job_id}/download",
    response: "BinaryDownload",
    binary: true,
    invoke: (api) => api.downloadFamilyTreeExport(7),
  },
  {
    name: "stageFamilyTreeImport",
    method: "post",
    path: "/family-tree/imports",
    response: "JobDTO",
    multipart: ["file", "expected_graph_revision"],
    body: importForm,
    invoke: (api) => api.stageFamilyTreeImport(importForm),
  },
  {
    name: "getFamilyTreeImportJob",
    method: "get",
    path: "/family-tree/imports/{job_id}",
    response: "JobDTO",
    invoke: (api) => api.getFamilyTreeImportJob(7),
  },
  {
    name: "commitFamilyTreeImport",
    method: "post",
    path: "/family-tree/imports/{job_id}/commit",
    schema: "ImportCommit",
    body: importCommit,
    invoke: (api) => api.commitFamilyTreeImport(7, importCommit),
  },
  {
    name: "cancelFamilyTreeImport",
    method: "delete",
    path: "/family-tree/imports/{job_id}",
    response: "JobDTO",
    invoke: (api) => api.cancelFamilyTreeImport(7),
  },
];
