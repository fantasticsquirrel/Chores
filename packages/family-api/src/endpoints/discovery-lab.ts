import type {
  DiscoveryPackagePayload,
  DiscoveryPackageSummary,
} from "../models/discovery-packages";
import type { RequestQuery } from "../client-core";
import type {
  DiscoveryAccessUpdate,
  DiscoveryChild,
  DiscoveryChildAccess,
  DiscoveryExploration,
  DiscoveryFilters,
} from "../models/discovery-lab";
import { FamilyCoreApiEndpoints } from "./core";

export abstract class FamilyDiscoveryApiEndpoints extends FamilyCoreApiEndpoints {
  async listDiscoveryPackages(): Promise<DiscoveryPackageSummary[]> {
    return this.get<DiscoveryPackageSummary[]>("/discovery/packages");
  }
  async uploadDiscoveryPackage(
    archive_base64: string,
  ): Promise<DiscoveryPackageSummary> {
    return this.post<DiscoveryPackageSummary, { archive_base64: string }>(
      "/discovery/packages",
      { archive_base64 },
    );
  }
  async previewDiscoveryPackage(
    id: string,
    version: string,
  ): Promise<DiscoveryPackagePayload> {
    return this.get<DiscoveryPackagePayload>(
      `/discovery/packages/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}`,
    );
  }
  async publishDiscoveryPackage(
    id: string,
    version: string,
  ): Promise<DiscoveryPackageSummary> {
    return this.post<DiscoveryPackageSummary, Record<string, never>>(
      `/discovery/packages/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/publish`,
      {},
    );
  }
  async getDiscoveryPackage(id: string): Promise<DiscoveryPackagePayload> {
    return this.get<DiscoveryPackagePayload>(
      `/discovery/explorations/${encodeURIComponent(id)}/package`,
    );
  }
  async listDiscoveryExplorations(
    params: DiscoveryFilters = {},
  ): Promise<DiscoveryExploration[]> {
    return this.get<DiscoveryExploration[]>(
      "/discovery/explorations",
      params as RequestQuery,
    );
  }
  async getDiscoveryExploration(
    id: string,
    childId?: number,
  ): Promise<DiscoveryExploration> {
    return this.get<DiscoveryExploration>(
      `/discovery/explorations/${encodeURIComponent(id)}`,
      { child_id: childId },
    );
  }
  async listDiscoveryChildren(): Promise<DiscoveryChild[]> {
    return this.get<DiscoveryChild[]>("/discovery/children");
  }
  async getDiscoveryChildAccess(
    childId: number,
  ): Promise<DiscoveryChildAccess> {
    return this.get<DiscoveryChildAccess>(
      `/discovery/children/${childId}/access`,
    );
  }
  async updateDiscoveryChildAccess(
    childId: number,
    payload: DiscoveryAccessUpdate,
  ): Promise<DiscoveryChildAccess> {
    return this.put<DiscoveryChildAccess, DiscoveryAccessUpdate>(
      `/discovery/children/${childId}/access`,
      payload,
    );
  }
}
