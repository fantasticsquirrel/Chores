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
