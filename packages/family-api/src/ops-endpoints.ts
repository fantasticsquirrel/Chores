import type { RequestQuery } from "./client-core";
import type {
  AppendOpsSupportNoteRequest,
  ComplimentaryEntitlementRequest,
  CreateOpsSupportCaseRequest,
  OpsAuditEntry,
  OpsBillingDetail,
  OpsEventSummary,
  OpsHouseholdDetail,
  OpsHouseholdSummary,
  OpsLoginRequest,
  GlobalModule,
  HouseholdModule,
  ModuleAccessChange,
  OwnerAccountPage,
  OwnerHouseholdPage,
  OwnerHouseholdQuery,
  OwnerOverview,
  OwnerPagination,
  OpsReauthRequest,
  OpsReconcileRequest,
  OpsSessionResponse,
  OpsSupportCase,
  OpsSupportNote,
} from "./ops-models";

export const opsApiRoutes = {
  auth: {
    login: "/auth/login",
    me: "/auth/me",
    logout: "/auth/logout",
    reauthenticate: "/auth/reauth",
  },
  households: () => "/households",
  household: (id: number) => `/households/${id}`,
  householdBilling: (id: number) => `/households/${id}/billing`,
  householdEvents: (id: number) => `/households/${id}/events`,
  householdAudit: (id: number) => `/households/${id}/audit`,
  householdComplimentary: (id: number) => `/households/${id}/complimentary`,
  householdReconcile: (id: number) => `/households/${id}/reconcile`,
  ownerOverview: "/owner/overview",
  ownerHouseholds: "/owner/households",
  ownerModules: "/owner/modules",
  ownerModule: (key: string) => `/owner/modules/${encodeURIComponent(key)}`,
  ownerHouseholdModules: (id: number) => `/owner/households/${id}/modules`,
  ownerHouseholdModule: (id: number, key: string) =>
    `/owner/households/${id}/modules/${encodeURIComponent(key)}`,
  ownerHouseholdAccounts: (id: number) => `/owner/households/${id}/accounts`,
  supportCases: () => "/support/cases",
  supportCaseNotes: (id: number) => `/support/cases/${id}/notes`,
} as const;

export abstract class OpsApiEndpoints {
  protected abstract get<TResponse>(
    path: string,
    query?: RequestQuery,
  ): Promise<TResponse>;
  protected abstract post<TResponse, TBody>(
    path: string,
    body: TBody,
  ): Promise<TResponse>;
  protected abstract postNoContent(path: string): Promise<void>;

  getOwnerOverview(): Promise<OwnerOverview> {
    return this.get(opsApiRoutes.ownerOverview);
  }
  listOwnerHouseholds({
    query = "",
    offset = 0,
    limit = 25,
  }: OwnerHouseholdQuery = {}): Promise<OwnerHouseholdPage> {
    return this.get(opsApiRoutes.ownerHouseholds, { query, offset, limit });
  }
  listGlobalModules(): Promise<GlobalModule[]> {
    return this.get(opsApiRoutes.ownerModules);
  }
  setGlobalModule(
    key: string,
    payload: ModuleAccessChange,
  ): Promise<GlobalModule> {
    return this.post(opsApiRoutes.ownerModule(key), payload);
  }
  listOwnerHouseholdModules(id: number): Promise<HouseholdModule[]> {
    return this.get(opsApiRoutes.ownerHouseholdModules(id));
  }
  setOwnerHouseholdModule(
    id: number,
    key: string,
    payload: ModuleAccessChange,
  ): Promise<HouseholdModule> {
    return this.post(opsApiRoutes.ownerHouseholdModule(id, key), payload);
  }
  listOwnerHouseholdAccounts(
    id: number,
    { offset = 0, limit = 25 }: OwnerPagination = {},
  ): Promise<OwnerAccountPage> {
    return this.get(opsApiRoutes.ownerHouseholdAccounts(id), { offset, limit });
  }
  login(payload: OpsLoginRequest): Promise<OpsSessionResponse> {
    return this.post(opsApiRoutes.auth.login, payload);
  }
  getCurrentOpsSession(): Promise<OpsSessionResponse> {
    return this.get(opsApiRoutes.auth.me);
  }
  logout(): Promise<void> {
    return this.postNoContent(opsApiRoutes.auth.logout);
  }
  reauthenticate(payload: OpsReauthRequest): Promise<void> {
    return this.post(opsApiRoutes.auth.reauthenticate, payload);
  }
  searchHouseholds(query: string): Promise<OpsHouseholdSummary[]> {
    return this.get(opsApiRoutes.households(), { query });
  }
  getHousehold(id: number): Promise<OpsHouseholdDetail> {
    return this.get(opsApiRoutes.household(id));
  }
  getHouseholdBilling(id: number): Promise<OpsBillingDetail> {
    return this.get(opsApiRoutes.householdBilling(id));
  }
  listHouseholdEvents(id: number): Promise<OpsEventSummary[]> {
    return this.get(opsApiRoutes.householdEvents(id));
  }
  listAuditEntries(id: number): Promise<OpsAuditEntry[]> {
    return this.get(opsApiRoutes.householdAudit(id));
  }
  createSupportCase(
    id: number,
    payload: CreateOpsSupportCaseRequest,
  ): Promise<OpsSupportCase> {
    return this.post(opsApiRoutes.supportCases(), {
      ...payload,
      household_id: id,
    });
  }
  appendSupportNote(
    id: number,
    payload: AppendOpsSupportNoteRequest,
  ): Promise<OpsSupportNote> {
    return this.post(opsApiRoutes.supportCaseNotes(id), payload);
  }
  reconcileHousehold(
    id: number,
    payload: OpsReconcileRequest,
  ): Promise<OpsHouseholdDetail> {
    return this.post(opsApiRoutes.householdReconcile(id), payload);
  }
  grantComplimentary(
    id: number,
    payload: ComplimentaryEntitlementRequest,
  ): Promise<OpsHouseholdDetail> {
    return this.post(opsApiRoutes.householdComplimentary(id), payload);
  }
}
