import type {
  FamilyTreeAttachMediaRequest,
  FamilyTreeMedia,
  FamilyTreeMediaReference,
  FamilyTreeMergePreviewRequest,
  FamilyTreePreviewCommitRequest,
  FamilyTreePurgePreviewRequest,
  FamilyTreePurgeCommitRequest,
  FamilyTreeExportRequest,
  FamilyTreeImportCommitRequest,
  FamilyTreeJob,
  FamilyTreePreview,
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

import type { BinaryDownload, RequestOptions } from "../client-core";

/** Only implemented FT0/FT1/FT2/FT3 server operations. */
export abstract class FamilyTreeApiEndpoints extends FamilyRecipeApiEndpoints {
  async getFamilyTreeCollection(
    options?: RequestOptions,
  ): Promise<FamilyTreeCollectionState> {
    return this.get<FamilyTreeCollectionState>(
      "/family-tree/",
      undefined,
      options,
    );
  }

  async listFamilyTreePeople(
    params: FamilyTreePeopleParams = {},
    options?: RequestOptions,
  ): Promise<FamilyTreePeoplePage> {
    return this.get<FamilyTreePeoplePage>(
      "/family-tree/people",
      params,
      options,
    );
  }

  async getFamilyTreePerson(
    personId: number,
    options?: RequestOptions,
  ): Promise<FamilyTreePersonDetail> {
    return this.get<FamilyTreePersonDetail>(
      `/family-tree/people/${personId}`,
      undefined,
      options,
    );
  }

  async getFamilyTreeGraph(
    params: FamilyTreeGraphParams = {},
    options?: RequestOptions,
  ): Promise<FamilyTreeGraphProjection> {
    return this.get<FamilyTreeGraphProjection>(
      "/family-tree/graph",
      params,
      options,
    );
  }

  async compareFamilyTreePeople(
    params: FamilyTreeCompareParams,
    options?: RequestOptions,
  ): Promise<FamilyTreeCompareResult> {
    return this.get<FamilyTreeCompareResult>(
      "/family-tree/compare",
      params,
      options,
    );
  }

  async listFamilyTreeIdentityCandidates(
    options?: RequestOptions,
  ): Promise<FamilyTreeIdentityCandidates> {
    return this.get<FamilyTreeIdentityCandidates>(
      "/family-tree/identity-candidates",
      undefined,
      options,
    );
  }

  async createFamilyTreePerson(
    payload: FamilyTreeCreatePersonRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeCreatePersonRequest>(
      "/family-tree/people",
      payload,
      undefined,
      options,
    );
  }

  async patchFamilyTreePerson(
    personId: number,
    payload: FamilyTreePatchPersonRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.patch<FamilyTreeMutationResult, FamilyTreePatchPersonRequest>(
      `/family-tree/people/${personId}`,
      payload,
      options,
    );
  }

  async createFamilyTreeRelative(
    payload: FamilyTreeCreateRelativeRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeCreateRelativeRequest>(
      "/family-tree/relatives",
      payload,
      undefined,
      options,
    );
  }

  async archiveFamilyTreePerson(
    personId: number,
    payload: FamilyTreeCommand,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/people/${personId}/archive`,
      payload,
      undefined,
      options,
    );
  }

  async restoreFamilyTreePerson(
    personId: number,
    payload: FamilyTreeCommand,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/people/${personId}/restore`,
      payload,
      undefined,
      options,
    );
  }

  async lockFamilyTreePerson(
    personId: number,
    payload: FamilyTreeReasonCommand,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeReasonCommand>(
      `/family-tree/people/${personId}/lock`,
      payload,
      undefined,
      options,
    );
  }

  async unlockFamilyTreePerson(
    personId: number,
    payload: FamilyTreeReasonCommand,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeReasonCommand>(
      `/family-tree/people/${personId}/unlock`,
      payload,
      undefined,
      options,
    );
  }

  async createFamilyTreeParentLink(
    payload: FamilyTreeCreateParentLinkRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<
      FamilyTreeMutationResult,
      FamilyTreeCreateParentLinkRequest
    >("/family-tree/parent-links", payload, undefined, options);
  }

  async patchFamilyTreeParentLink(
    relationshipId: number,
    payload: FamilyTreePatchParentLinkRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.patch<
      FamilyTreeMutationResult,
      FamilyTreePatchParentLinkRequest
    >(`/family-tree/parent-links/${relationshipId}`, payload, options);
  }

  async deleteFamilyTreeParentLink(
    relationshipId: number,
    payload: FamilyTreeCommand,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.deleteWithBody<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/parent-links/${relationshipId}`,
      payload,
      options,
    );
  }

  async createFamilyTreeCareLink(
    payload: FamilyTreeCreateCareLinkRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeCreateCareLinkRequest>(
      "/family-tree/care-links",
      payload,
      undefined,
      options,
    );
  }

  async patchFamilyTreeCareLink(
    relationshipId: number,
    payload: FamilyTreePatchCareLinkRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.patch<FamilyTreeMutationResult, FamilyTreePatchCareLinkRequest>(
      `/family-tree/care-links/${relationshipId}`,
      payload,
      options,
    );
  }

  async deleteFamilyTreeCareLink(
    relationshipId: number,
    payload: FamilyTreeCommand,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.deleteWithBody<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/care-links/${relationshipId}`,
      payload,
      options,
    );
  }

  async createFamilyTreePartnerEpisode(
    payload: FamilyTreeCreatePartnerEpisodeRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<
      FamilyTreeMutationResult,
      FamilyTreeCreatePartnerEpisodeRequest
    >("/family-tree/partner-episodes", payload, undefined, options);
  }

  async patchFamilyTreePartnerEpisode(
    relationshipId: number,
    payload: FamilyTreePatchPartnerEpisodeRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.patch<
      FamilyTreeMutationResult,
      FamilyTreePatchPartnerEpisodeRequest
    >(`/family-tree/partner-episodes/${relationshipId}`, payload, options);
  }

  async deleteFamilyTreePartnerEpisode(
    relationshipId: number,
    payload: FamilyTreeCommand,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.deleteWithBody<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/partner-episodes/${relationshipId}`,
      payload,
      options,
    );
  }

  async listFamilyTreeStories(
    personId: number,
    params: FamilyTreePageParams = {},
    options?: RequestOptions,
  ): Promise<FamilyTreeStoriesPage> {
    return this.get<FamilyTreeStoriesPage>(
      `/family-tree/people/${personId}/stories`,
      params,
      options,
    );
  }

  async createFamilyTreeStory(
    personId: number,
    payload: FamilyTreeCreateStoryRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeCreateStoryRequest>(
      `/family-tree/people/${personId}/stories`,
      payload,
      undefined,
      options,
    );
  }

  async patchFamilyTreeStory(
    recordId: number,
    payload: FamilyTreePatchStoryRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.patch<FamilyTreeMutationResult, FamilyTreePatchStoryRequest>(
      `/family-tree/stories/${recordId}`,
      payload,
      options,
    );
  }

  async deleteFamilyTreeStory(
    recordId: number,
    payload: FamilyTreeCommand,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.deleteWithBody<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/stories/${recordId}`,
      payload,
      options,
    );
  }

  async listFamilyTreeResidences(
    personId: number,
    params: FamilyTreePageParams = {},
    options?: RequestOptions,
  ): Promise<FamilyTreeResidencesPage> {
    return this.get<FamilyTreeResidencesPage>(
      `/family-tree/people/${personId}/residences`,
      params,
      options,
    );
  }

  async createFamilyTreeResidence(
    personId: number,
    payload: FamilyTreeCreateResidenceRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<
      FamilyTreeMutationResult,
      FamilyTreeCreateResidenceRequest
    >(
      `/family-tree/people/${personId}/residences`,
      payload,
      undefined,
      options,
    );
  }

  async patchFamilyTreeResidence(
    recordId: number,
    payload: FamilyTreePatchResidenceRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.patch<
      FamilyTreeMutationResult,
      FamilyTreePatchResidenceRequest
    >(`/family-tree/residences/${recordId}`, payload, options);
  }

  async deleteFamilyTreeResidence(
    recordId: number,
    payload: FamilyTreeCommand,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.deleteWithBody<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/residences/${recordId}`,
      payload,
      options,
    );
  }

  async reorderFamilyTreeStories(
    personId: number,
    payload: FamilyTreeReorderStoriesRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeReorderStoriesRequest>(
      `/family-tree/people/${personId}/stories/reorder`,
      payload,
      undefined,
      options,
    );
  }

  async linkFamilyTreeIdentity(
    personId: number,
    payload: FamilyTreeLinkIdentityRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.put<FamilyTreeMutationResult, FamilyTreeLinkIdentityRequest>(
      `/family-tree/people/${personId}/identity-link`,
      payload,
      options,
    );
  }

  async unlinkFamilyTreeIdentity(
    personId: number,
    payload: FamilyTreeCommand,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.deleteWithBody<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/people/${personId}/identity-link`,
      payload,
      options,
    );
  }

  // Platforms own original File/URI parts and caption/revision FormData fields.
  async uploadFamilyTreeMedia(
    body: FormData,
    options?: RequestOptions,
  ): Promise<FamilyTreeMedia> {
    return this.postMultipart<FamilyTreeMedia>(
      "/family-tree/media",
      body,
      options,
    );
  }
  async getFamilyTreeMediaContent(
    assetId: number,
    options?: RequestOptions,
  ): Promise<BinaryDownload> {
    return this.getBinary(`/family-tree/media/${assetId}/content`, options);
  }
  async listFamilyTreeMediaReferences(
    personId: number,
    options?: RequestOptions,
  ): Promise<FamilyTreeMediaReference[]> {
    return this.get<FamilyTreeMediaReference[]>(
      `/family-tree/people/${personId}/media`,
      undefined,
      options,
    );
  }
  async attachFamilyTreeMedia(
    assetId: number,
    payload: FamilyTreeAttachMediaRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeAttachMediaRequest>(
      `/family-tree/media/${assetId}/attach`,
      payload,
      undefined,
      options,
    );
  }
  async removeFamilyTreeMediaReference(
    assetId: number,
    referenceId: number,
    payload: FamilyTreeCommand,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.deleteWithBody<FamilyTreeMutationResult, FamilyTreeCommand>(
      `/family-tree/media/${assetId}/references/${referenceId}`,
      payload,
      options,
    );
  }
  async previewFamilyTreeMerge(
    payload: FamilyTreeMergePreviewRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreePreview> {
    return this.post<FamilyTreePreview, FamilyTreeMergePreviewRequest>(
      "/family-tree/merge-preview",
      payload,
      undefined,
      options,
    );
  }
  async commitFamilyTreeMerge(
    payload: FamilyTreePreviewCommitRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreePreviewCommitRequest>(
      "/family-tree/merge",
      payload,
      undefined,
      options,
    );
  }
  async previewFamilyTreePurge(
    personId: number,
    payload: FamilyTreePurgePreviewRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreePreview> {
    return this.post<FamilyTreePreview, FamilyTreePurgePreviewRequest>(
      `/family-tree/people/${personId}/purge-preview`,
      payload,
      undefined,
      options,
    );
  }
  async commitFamilyTreePurge(
    personId: number,
    payload: FamilyTreePurgeCommitRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreePurgeCommitRequest>(
      `/family-tree/people/${personId}/purge`,
      payload,
      undefined,
      options,
    );
  }
  async createFamilyTreeExport(
    payload: FamilyTreeExportRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeJob> {
    return this.post<FamilyTreeJob, FamilyTreeExportRequest>(
      "/family-tree/exports",
      payload,
      undefined,
      options,
    );
  }
  async getFamilyTreeExportJob(
    jobId: number,
    options?: RequestOptions,
  ): Promise<FamilyTreeJob> {
    return this.get<FamilyTreeJob>(
      `/family-tree/exports/${jobId}`,
      undefined,
      options,
    );
  }
  async downloadFamilyTreeExport(
    jobId: number,
    options?: RequestOptions,
  ): Promise<BinaryDownload> {
    return this.getBinary(`/family-tree/exports/${jobId}/download`, options);
  }
  async stageFamilyTreeImport(
    body: FormData,
    options?: RequestOptions,
  ): Promise<FamilyTreeJob> {
    return this.postMultipart<FamilyTreeJob>(
      "/family-tree/imports",
      body,
      options,
    );
  }
  async getFamilyTreeImportJob(
    jobId: number,
    options?: RequestOptions,
  ): Promise<FamilyTreeJob> {
    return this.get<FamilyTreeJob>(
      `/family-tree/imports/${jobId}`,
      undefined,
      options,
    );
  }
  async commitFamilyTreeImport(
    jobId: number,
    payload: FamilyTreeImportCommitRequest,
    options?: RequestOptions,
  ): Promise<FamilyTreeMutationResult> {
    return this.post<FamilyTreeMutationResult, FamilyTreeImportCommitRequest>(
      `/family-tree/imports/${jobId}/commit`,
      payload,
      undefined,
      options,
    );
  }
  async cancelFamilyTreeImport(
    jobId: number,
    options?: RequestOptions,
  ): Promise<FamilyTreeJob> {
    return this.deleteWithResponse<FamilyTreeJob>(
      `/family-tree/imports/${jobId}`,
      options,
    );
  }
}
