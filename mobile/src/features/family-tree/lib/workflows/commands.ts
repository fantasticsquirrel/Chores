import type { ApiClient } from "../../../../api/client";
import type * as FT from "@family-manager/family-api/models";
import type { TreeRequestOptions } from "./requests";
export type TreeApi = Pick<
  ApiClient,
  | "authenticationGeneration"
  | "withAuthentication"
  | "getMyModules"
  | "getFamilyTreeCollection"
  | "listFamilyTreePeople"
  | "getFamilyTreePerson"
  | "getFamilyTreeGraph"
  | "compareFamilyTreePeople"
  | "listFamilyTreeIdentityCandidates"
  | "listFamilyTreeStories"
  | "listFamilyTreeResidences"
  | "createFamilyTreePerson"
  | "patchFamilyTreePerson"
  | "createFamilyTreeRelative"
  | "archiveFamilyTreePerson"
  | "restoreFamilyTreePerson"
  | "lockFamilyTreePerson"
  | "unlockFamilyTreePerson"
  | "createFamilyTreeParentLink"
  | "patchFamilyTreeParentLink"
  | "deleteFamilyTreeParentLink"
  | "createFamilyTreeCareLink"
  | "patchFamilyTreeCareLink"
  | "deleteFamilyTreeCareLink"
  | "createFamilyTreePartnerEpisode"
  | "patchFamilyTreePartnerEpisode"
  | "deleteFamilyTreePartnerEpisode"
  | "createFamilyTreeStory"
  | "patchFamilyTreeStory"
  | "deleteFamilyTreeStory"
  | "reorderFamilyTreeStories"
  | "createFamilyTreeResidence"
  | "patchFamilyTreeResidence"
  | "deleteFamilyTreeResidence"
  | "linkFamilyTreeIdentity"
  | "unlinkFamilyTreeIdentity"
>;
export type TreeAction =
  | { type: "createPerson"; person: FT.FamilyTreePersonInput }
  | {
      type: "patchPerson";
      personId: number;
      changes: FT.FamilyTreePersonChanges;
    }
  | {
      type: "createRelative";
      personId: number;
      person: FT.FamilyTreePersonInput;
      relationship: FT.FamilyTreeRelativeRelationship;
    }
  | { type: "archive" | "restore"; personId: number }
  | {
      type: "unlinkIdentity";
      personId: number;
      originalLink?: FT.FamilyTreeIdentityLink | null;
    }
  | { type: "lock" | "unlock"; personId: number; reason: string }
  | { type: "createParent"; data: FT.FamilyTreeParentData }
  | { type: "patchParent"; id: number; changes: FT.FamilyTreeParentChanges }
  | {
      type:
        | "deleteParent"
        | "deleteCare"
        | "deletePartner"
        | "deleteStory"
        | "deleteResidence";
      id: number;
    }
  | { type: "createCare"; data: FT.FamilyTreeCareData }
  | { type: "patchCare"; id: number; changes: FT.FamilyTreeCareChanges }
  | { type: "createPartner"; data: FT.FamilyTreePartnerData }
  | { type: "patchPartner"; id: number; changes: FT.FamilyTreePartnerChanges }
  | { type: "createStory"; personId: number; story: FT.FamilyTreeStoryInput }
  | { type: "patchStory"; id: number; changes: FT.FamilyTreeStoryChanges }
  | { type: "reorderStories"; personId: number; storyIds: number[] }
  | {
      type: "createResidence";
      personId: number;
      residence: FT.FamilyTreeResidenceInput;
    }
  | {
      type: "patchResidence";
      id: number;
      changes: FT.FamilyTreeResidenceChanges;
    }
  | {
      type: "linkIdentity";
      personId: number;
      candidate: FT.FamilyTreeIdentityCandidate;
      confirmed: true;
    };
export function executeCommand(
  api: TreeApi,
  a: TreeAction,
  c: FT.FamilyTreeCommand & { idempotency_key: string },
  options?: TreeRequestOptions,
): Promise<FT.FamilyTreeMutationResult> {
  const call = <A extends unknown[], R>(
    operation: (...args: A) => Promise<R>,
    ...args: A
  ): Promise<R> =>
    operation.apply(api, (options ? [...args, options] : args) as A);
  switch (a.type) {
    case "createPerson":
      return call(api.createFamilyTreePerson, { ...c, person: a.person });
    case "patchPerson":
      return call(api.patchFamilyTreePerson, a.personId, {
        ...c,
        changes: a.changes,
      });
    case "createRelative":
      return call(api.createFamilyTreeRelative, {
        ...c,
        anchor_person_id: a.personId,
        person: a.person,
        relationship: a.relationship,
      });
    case "archive":
      return call(api.archiveFamilyTreePerson, a.personId, c);
    case "restore":
      return call(api.restoreFamilyTreePerson, a.personId, c);
    case "lock":
      return call(api.lockFamilyTreePerson, a.personId, {
        ...c,
        reason: a.reason,
      });
    case "unlock":
      return call(api.unlockFamilyTreePerson, a.personId, {
        ...c,
        reason: a.reason,
      });
    case "createParent":
      return call(api.createFamilyTreeParentLink, { ...c, ...a.data });
    case "patchParent":
      return call(api.patchFamilyTreeParentLink, a.id, {
        ...c,
        changes: a.changes,
      });
    case "deleteParent":
      return call(api.deleteFamilyTreeParentLink, a.id, c);
    case "createCare":
      return call(api.createFamilyTreeCareLink, { ...c, ...a.data });
    case "patchCare":
      return call(api.patchFamilyTreeCareLink, a.id, {
        ...c,
        changes: a.changes,
      });
    case "deleteCare":
      return call(api.deleteFamilyTreeCareLink, a.id, c);
    case "createPartner":
      return call(api.createFamilyTreePartnerEpisode, { ...c, ...a.data });
    case "patchPartner":
      return call(api.patchFamilyTreePartnerEpisode, a.id, {
        ...c,
        changes: a.changes,
      });
    case "deletePartner":
      return call(api.deleteFamilyTreePartnerEpisode, a.id, c);
    case "createStory":
      return call(api.createFamilyTreeStory, a.personId, {
        ...c,
        story: a.story,
      });
    case "patchStory":
      return call(api.patchFamilyTreeStory, a.id, { ...c, changes: a.changes });
    case "deleteStory":
      return call(api.deleteFamilyTreeStory, a.id, c);
    case "reorderStories":
      return call(api.reorderFamilyTreeStories, a.personId, {
        ...c,
        story_ids: a.storyIds,
      });
    case "createResidence":
      return call(api.createFamilyTreeResidence, a.personId, {
        ...c,
        residence: a.residence,
      });
    case "patchResidence":
      return call(api.patchFamilyTreeResidence, a.id, {
        ...c,
        changes: a.changes,
      });
    case "deleteResidence":
      return call(api.deleteFamilyTreeResidence, a.id, c);
    case "linkIdentity":
      return call(api.linkFamilyTreeIdentity, a.personId, {
        ...c,
        confirmed: true,
        ...(a.candidate.kind === "child"
          ? { child_id: a.candidate.id }
          : { user_id: a.candidate.id }),
      });
    case "unlinkIdentity":
      return call(api.unlinkFamilyTreeIdentity, a.personId, c);
  }
}
