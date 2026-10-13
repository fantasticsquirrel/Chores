import type { FamilyTreeMutationResult } from "../models/family-tree-core";
import type {
  FamilyTreeExportRequest,
  FamilyTreeImportCommitRequest,
  FamilyTreeJob,
} from "../models/family-tree-transfer";
import type { BinaryDownload, RequestOptions } from "../client-core";
import { FamilyTreeCoreApiEndpoints } from "./family-tree-core";

/** Staged portable export/import jobs, binary downloads and cancellation. */
export abstract class FamilyTreeTransferApiEndpoints extends FamilyTreeCoreApiEndpoints {
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
