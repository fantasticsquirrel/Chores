import type {
  FamilyTreeCollectionState,
  FamilyTreeCommand,
  FamilyTreeCompareParams,
  FamilyTreeCompareResult,
  FamilyTreeCreateCareLinkRequest,
  FamilyTreeCreateParentLinkRequest,
  FamilyTreeCreatePartnerEpisodeRequest,
  FamilyTreeCreatePersonRequest,
  FamilyTreeCreateRelativeRequest,
  FamilyTreeCreateResidenceRequest,
  FamilyTreeCreateStoryRequest,
  FamilyTreeGraphParams,
  FamilyTreeGraphProjection,
  FamilyTreeIdentityCandidates,
  FamilyTreeLinkIdentityRequest,
  FamilyTreeMutationResult,
  FamilyTreePageParams,
  FamilyTreePatchCareLinkRequest,
  FamilyTreePatchParentLinkRequest,
  FamilyTreePatchPartnerEpisodeRequest,
  FamilyTreePatchPersonRequest,
  FamilyTreePatchResidenceRequest,
  FamilyTreePatchStoryRequest,
  FamilyTreePeoplePage,
  FamilyTreePeopleParams,
  FamilyTreePersonDetail,
  FamilyTreeReasonCommand,
  FamilyTreeReorderStoriesRequest,
  FamilyTreeResidencesPage,
  FamilyTreeStoriesPage,
} from "../models/family-tree";
import { FamilyRecipeApiEndpoints } from "./recipes";

/** Only implemented FT0/FT1/FT2 server operations; no FT3 placeholders. */
export abstract class FamilyTreeApiEndpoints extends FamilyRecipeApiEndpoints {
  async getFamilyTreeCollection(): Promise<FamilyTreeCollectionState> {
    return this.get<FamilyTreeCollectionState>("/family-tree/");
  }

  async listFamilyTreePeople(
    params: FamilyTreePeopleParams = {},
  ): Promise<FamilyTreePeoplePage> {
    return this.get<FamilyTreePeoplePage>("/family-tree/people", params);
  }

  async getFamilyTreePerson(personId: number): Promise<FamilyTreePersonDetail> {
    return this.get<FamilyTreePersonDetail>(`/family-tree/people/${personId}`);
  }

  async getFamilyTreeGraph(
    params: FamilyTreeGraphParams = {},
  ): Promise<FamilyTreeGraphProjection> {
    return this.get<FamilyTreeGraphProjection>("/family-tree/graph", params);
  }

  async compareFamilyTreePeople(
    params: FamilyTreeCompareParams,
  ): Promise<FamilyTreeCompareResult> {
    return this.get<FamilyTreeCompareResult>("/family-tree/compare", params);
  }

  async listFamilyTreeIdentityCandidates(): Promise<FamilyTreeIdentityCandidates> {
    return this.get<FamilyTreeIdentityCandidates>(
      "/family-tree/identity-candidates",
    );
  }

  async createFamilyTreePerson(
    payload: FamilyTreeCreatePersonRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeCreatePersonRequest>(
      "/family-tree/people",
      payload,
    );
  }

  async patchFamilyTreePerson(
    personId: number,
    payload: FamilyTreePatchPersonRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.patch<FamilyTreeMutationResult, FamilyTreePatchPersonRequest>(
      `/family-tree/people/${personId}`,
      payload,
    );
  }

  async createFamilyTreeRelative(
    payload: FamilyTreeCreateRelativeRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeCreateRelativeRequest>(
      "/family-tree/relatives",
      payload,
    );
  }

  async archiveFamilyTreePerson(
    personId: number,
    payload: FamilyTreeCommand,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/people/${personId}/archive`,
      payload,
    );
  }

  async restoreFamilyTreePerson(
    personId: number,
    payload: FamilyTreeCommand,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/people/${personId}/restore`,
      payload,
    );
  }

  async lockFamilyTreePerson(
    personId: number,
    payload: FamilyTreeReasonCommand,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeReasonCommand>(
      `/family-tree/people/${personId}/lock`,
      payload,
    );
  }

  async unlockFamilyTreePerson(
    personId: number,
    payload: FamilyTreeReasonCommand,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeReasonCommand>(
      `/family-tree/people/${personId}/unlock`,
      payload,
    );
  }

  async createFamilyTreeParentLink(
    payload: FamilyTreeCreateParentLinkRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<
      FamilyTreeMutationResult,
      FamilyTreeCreateParentLinkRequest
    >("/family-tree/parent-links", payload);
  }

  async patchFamilyTreeParentLink(
    relationshipId: number,
    payload: FamilyTreePatchParentLinkRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.patch<
      FamilyTreeMutationResult,
      FamilyTreePatchParentLinkRequest
    >(`/family-tree/parent-links/${relationshipId}`, payload);
  }

  async deleteFamilyTreeParentLink(
    relationshipId: number,
    payload: FamilyTreeCommand,
  ): Promise<FamilyTreeMutationResult> {
    return this.deleteWithBody<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/parent-links/${relationshipId}`,
      payload,
    );
  }

  async createFamilyTreeCareLink(
    payload: FamilyTreeCreateCareLinkRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeCreateCareLinkRequest>(
      "/family-tree/care-links",
      payload,
    );
  }

  async patchFamilyTreeCareLink(
    relationshipId: number,
    payload: FamilyTreePatchCareLinkRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.patch<FamilyTreeMutationResult, FamilyTreePatchCareLinkRequest>(
      `/family-tree/care-links/${relationshipId}`,
      payload,
    );
  }

  async deleteFamilyTreeCareLink(
    relationshipId: number,
    payload: FamilyTreeCommand,
  ): Promise<FamilyTreeMutationResult> {
    return this.deleteWithBody<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/care-links/${relationshipId}`,
      payload,
    );
  }

  async createFamilyTreePartnerEpisode(
    payload: FamilyTreeCreatePartnerEpisodeRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<
      FamilyTreeMutationResult,
      FamilyTreeCreatePartnerEpisodeRequest
    >("/family-tree/partner-episodes", payload);
  }

  async patchFamilyTreePartnerEpisode(
    relationshipId: number,
    payload: FamilyTreePatchPartnerEpisodeRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.patch<
      FamilyTreeMutationResult,
      FamilyTreePatchPartnerEpisodeRequest
    >(`/family-tree/partner-episodes/${relationshipId}`, payload);
  }

  async deleteFamilyTreePartnerEpisode(
    relationshipId: number,
    payload: FamilyTreeCommand,
  ): Promise<FamilyTreeMutationResult> {
    return this.deleteWithBody<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/partner-episodes/${relationshipId}`,
      payload,
    );
  }

  async listFamilyTreeStories(
    personId: number,
    params: FamilyTreePageParams = {},
  ): Promise<FamilyTreeStoriesPage> {
    return this.get<FamilyTreeStoriesPage>(
      `/family-tree/people/${personId}/stories`,
      params,
    );
  }

  async createFamilyTreeStory(
    personId: number,
    payload: FamilyTreeCreateStoryRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeCreateStoryRequest>(
      `/family-tree/people/${personId}/stories`,
      payload,
    );
  }

  async patchFamilyTreeStory(
    recordId: number,
    payload: FamilyTreePatchStoryRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.patch<FamilyTreeMutationResult, FamilyTreePatchStoryRequest>(
      `/family-tree/stories/${recordId}`,
      payload,
    );
  }

  async deleteFamilyTreeStory(
    recordId: number,
    payload: FamilyTreeCommand,
  ): Promise<FamilyTreeMutationResult> {
    return this.deleteWithBody<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/stories/${recordId}`,
      payload,
    );
  }

  async listFamilyTreeResidences(
    personId: number,
    params: FamilyTreePageParams = {},
  ): Promise<FamilyTreeResidencesPage> {
    return this.get<FamilyTreeResidencesPage>(
      `/family-tree/people/${personId}/residences`,
      params,
    );
  }

  async createFamilyTreeResidence(
    personId: number,
    payload: FamilyTreeCreateResidenceRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<
      FamilyTreeMutationResult,
      FamilyTreeCreateResidenceRequest
    >(`/family-tree/people/${personId}/residences`, payload);
  }

  async patchFamilyTreeResidence(
    recordId: number,
    payload: FamilyTreePatchResidenceRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.patch<
      FamilyTreeMutationResult,
      FamilyTreePatchResidenceRequest
    >(`/family-tree/residences/${recordId}`, payload);
  }

  async deleteFamilyTreeResidence(
    recordId: number,
    payload: FamilyTreeCommand,
  ): Promise<FamilyTreeMutationResult> {
    return this.deleteWithBody<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/residences/${recordId}`,
      payload,
    );
  }

  async reorderFamilyTreeStories(
    personId: number,
    payload: FamilyTreeReorderStoriesRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeReorderStoriesRequest>(
      `/family-tree/people/${personId}/stories/reorder`,
      payload,
    );
  }

  async linkFamilyTreeIdentity(
    personId: number,
    payload: FamilyTreeLinkIdentityRequest,
  ): Promise<FamilyTreeMutationResult> {
    return this.put<FamilyTreeMutationResult, FamilyTreeLinkIdentityRequest>(
      `/family-tree/people/${personId}/identity-link`,
      payload,
    );
  }

  async unlinkFamilyTreeIdentity(
    personId: number,
    payload: FamilyTreeCommand,
  ): Promise<FamilyTreeMutationResult> {
    return this.deleteWithBody<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/people/${personId}/identity-link`,
      payload,
    );
  }
}
