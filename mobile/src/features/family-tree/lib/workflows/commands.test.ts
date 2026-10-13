import { describe, expect, it, vi } from "vitest";
import { executeCommand, type TreeAction, type TreeApi } from "./commands";
const command = {
  expected_graph_revision: 7,
  idempotency_key: "opaque-operation-identity",
};
const cases: Array<{
  action: TreeAction;
  method: keyof TreeApi;
  args: unknown[];
}> = [
  {
    action: { type: "createPerson", person: { display_name: "A" } },
    method: "createFamilyTreePerson",
    args: [{ ...command, person: { display_name: "A" } }],
  },
  {
    action: { type: "patchPerson", personId: 3, changes: { birth_date: null } },
    method: "patchFamilyTreePerson",
    args: [3, { ...command, changes: { birth_date: null } }],
  },
  {
    action: {
      type: "createRelative",
      personId: 3,
      person: { first_name: "B" },
      relationship: { direction: "child", kind: "adoptive" },
    },
    method: "createFamilyTreeRelative",
    args: [
      {
        ...command,
        anchor_person_id: 3,
        person: { first_name: "B" },
        relationship: { direction: "child", kind: "adoptive" },
      },
    ],
  },
  {
    action: { type: "archive", personId: 3 },
    method: "archiveFamilyTreePerson",
    args: [3, command],
  },
  {
    action: { type: "restore", personId: 3 },
    method: "restoreFamilyTreePerson",
    args: [3, command],
  },
  {
    action: { type: "lock", personId: 3, reason: "Reviewed" },
    method: "lockFamilyTreePerson",
    args: [3, { ...command, reason: "Reviewed" }],
  },
  {
    action: { type: "unlock", personId: 3, reason: "Reviewed" },
    method: "unlockFamilyTreePerson",
    args: [3, { ...command, reason: "Reviewed" }],
  },
  {
    action: {
      type: "createParent",
      data: { parent_person_id: 3, child_person_id: 4, kind: "unknown" },
    },
    method: "createFamilyTreeParentLink",
    args: [
      { ...command, parent_person_id: 3, child_person_id: 4, kind: "unknown" },
    ],
  },
  {
    action: { type: "patchParent", id: 8, changes: { kind: "step" } },
    method: "patchFamilyTreeParentLink",
    args: [8, { ...command, changes: { kind: "step" } }],
  },
  {
    action: { type: "deleteParent", id: 8 },
    method: "deleteFamilyTreeParentLink",
    args: [8, command],
  },
  {
    action: {
      type: "createCare",
      data: {
        caregiver_person_id: 3,
        recipient_person_id: 4,
        kind: "guardian",
      },
    },
    method: "createFamilyTreeCareLink",
    args: [
      {
        ...command,
        caregiver_person_id: 3,
        recipient_person_id: 4,
        kind: "guardian",
      },
    ],
  },
  {
    action: {
      type: "patchCare",
      id: 8,
      changes: { kind: "caregiver", end_date: null },
    },
    method: "patchFamilyTreeCareLink",
    args: [8, { ...command, changes: { kind: "caregiver", end_date: null } }],
  },
  {
    action: { type: "deleteCare", id: 8 },
    method: "deleteFamilyTreeCareLink",
    args: [8, command],
  },
  {
    action: {
      type: "createPartner",
      data: {
        person_a_id: 3,
        person_b_id: 4,
        kind: "partners",
        status: "ended",
      },
    },
    method: "createFamilyTreePartnerEpisode",
    args: [
      {
        ...command,
        person_a_id: 3,
        person_b_id: 4,
        kind: "partners",
        status: "ended",
      },
    ],
  },
  {
    action: { type: "patchPartner", id: 8, changes: { status: "separated" } },
    method: "patchFamilyTreePartnerEpisode",
    args: [8, { ...command, changes: { status: "separated" } }],
  },
  {
    action: { type: "deletePartner", id: 8 },
    method: "deleteFamilyTreePartnerEpisode",
    args: [8, command],
  },
  {
    action: {
      type: "createStory",
      personId: 3,
      story: { title: "History", body_md: "Text" },
    },
    method: "createFamilyTreeStory",
    args: [3, { ...command, story: { title: "History", body_md: "Text" } }],
  },
  {
    action: { type: "patchStory", id: 8, changes: { date: null } },
    method: "patchFamilyTreeStory",
    args: [8, { ...command, changes: { date: null } }],
  },
  {
    action: { type: "deleteStory", id: 8 },
    method: "deleteFamilyTreeStory",
    args: [8, command],
  },
  {
    action: { type: "reorderStories", personId: 3, storyIds: [5, 4] },
    method: "reorderFamilyTreeStories",
    args: [3, { ...command, story_ids: [5, 4] }],
  },
  {
    action: {
      type: "createResidence",
      personId: 3,
      residence: { place: "London", is_primary: true },
    },
    method: "createFamilyTreeResidence",
    args: [3, { ...command, residence: { place: "London", is_primary: true } }],
  },
  {
    action: { type: "patchResidence", id: 8, changes: { is_primary: true } },
    method: "patchFamilyTreeResidence",
    args: [8, { ...command, changes: { is_primary: true } }],
  },
  {
    action: { type: "deleteResidence", id: 8 },
    method: "deleteFamilyTreeResidence",
    args: [8, command],
  },
  {
    action: {
      type: "linkIdentity",
      personId: 3,
      candidate: { kind: "user", id: 8, label: "Adult", active: true },
      confirmed: true,
    },
    method: "linkFamilyTreeIdentity",
    args: [3, { ...command, user_id: 8, confirmed: true }],
  },
  {
    action: {
      type: "linkIdentity",
      personId: 3,
      candidate: { kind: "child", id: 8, label: "Child", active: true },
      confirmed: true,
    },
    method: "linkFamilyTreeIdentity",
    args: [3, { ...command, child_id: 8, confirmed: true }],
  },
  {
    action: { type: "unlinkIdentity", personId: 3 },
    method: "unlinkFamilyTreeIdentity",
    args: [3, command],
  },
];
describe("all native FT2 mutation payload routes (external API seam)", () => {
  it.each(cases)(
    "$action.type calls $method with exact typed command",
    async ({ action, method, args }) => {
      const target = vi.fn().mockResolvedValue({ current_revision: 8 });
      const api = { [method]: target } as unknown as TreeApi;
      expect(await executeCommand(api, action, command)).toEqual({
        current_revision: 8,
      });
      expect(target).toHaveBeenCalledExactlyOnceWith(...args);
    },
  );
});
