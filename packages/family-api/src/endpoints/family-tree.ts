import type {
  FamilyTreeCommand,
  FamilyTreeMutationResult,
} from "../models/family-tree-core";
import type {
  FamilyTreeAttachMediaRequest,
  FamilyTreeMedia,
  FamilyTreeMediaReference,
} from "../models/family-tree-media";
import type {
  FamilyTreeMergePreviewRequest,
  FamilyTreePreview,
  FamilyTreePreviewCommitRequest,
  FamilyTreePurgeCommitRequest,
  FamilyTreePurgePreviewRequest,
} from "../models/family-tree-transfer";
import type { BinaryDownload, RequestOptions } from "../client-core";
import { FamilyTreeTransferApiEndpoints } from "./family-tree-transfer";

/** Public Family Tree client: managed media and previewed merge/purge commands. */
export abstract class FamilyTreeApiEndpoints extends FamilyTreeTransferApiEndpoints {
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
}
