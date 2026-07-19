import type { RequestQuery } from "./client-core";
import type {
  AppendOpsSupportNoteRequest, ComplimentaryEntitlementRequest, CreateOpsSupportCaseRequest,
  OpsAuditEntry, OpsBillingDetail, OpsEventSummary, OpsHouseholdDetail, OpsHouseholdSummary, OpsLoginRequest,
  OpsReauthRequest, OpsReconcileRequest, OpsSessionResponse, OpsSupportCase, OpsSupportNote,
} from "./ops-models";

export const opsApiRoutes = {
  auth: { login: "/auth/login", me: "/auth/me", logout: "/auth/logout", reauthenticate: "/auth/reauth" },
  households: () => "/households",
  household: (id: number) => `/households/${id}`,
  householdBilling: (id: number) => `/households/${id}/billing`,
  householdEvents: (id: number) => `/households/${id}/events`,
  householdAudit: (id: number) => `/households/${id}/audit`,
  householdComplimentary: (id: number) => `/households/${id}/complimentary`,
  householdReconcile: (id: number) => `/households/${id}/reconcile`,
  supportCases: () => "/support/cases",
  supportCaseNotes: (id: number) => `/support/cases/${id}/notes`,
} as const;

export abstract class OpsApiEndpoints {
  protected abstract get<TResponse>(path: string, query?: RequestQuery): Promise<TResponse>;
  protected abstract post<TResponse, TBody>(path: string, body: TBody): Promise<TResponse>;
  protected abstract postNoContent(path: string): Promise<void>;

  login(payload: OpsLoginRequest): Promise<OpsSessionResponse> { return this.post(opsApiRoutes.auth.login, payload); }
  getCurrentOpsSession(): Promise<OpsSessionResponse> { return this.get(opsApiRoutes.auth.me); }
  logout(): Promise<void> { return this.postNoContent(opsApiRoutes.auth.logout); }
  reauthenticate(payload: OpsReauthRequest): Promise<void> { return this.post(opsApiRoutes.auth.reauthenticate, payload); }
  searchHouseholds(query: string): Promise<OpsHouseholdSummary[]> { return this.get(opsApiRoutes.households(), { query }); }
  getHousehold(id: number): Promise<OpsHouseholdDetail> { return this.get(opsApiRoutes.household(id)); }
  getHouseholdBilling(id: number): Promise<OpsBillingDetail> { return this.get(opsApiRoutes.householdBilling(id)); }
  listHouseholdEvents(id: number): Promise<OpsEventSummary[]> { return this.get(opsApiRoutes.householdEvents(id)); }
  listAuditEntries(id: number): Promise<OpsAuditEntry[]> { return this.get(opsApiRoutes.householdAudit(id)); }
  createSupportCase(id: number, payload: CreateOpsSupportCaseRequest): Promise<OpsSupportCase> { return this.post(opsApiRoutes.supportCases(), { ...payload, household_id: id }); }
  appendSupportNote(id: number, payload: AppendOpsSupportNoteRequest): Promise<OpsSupportNote> { return this.post(opsApiRoutes.supportCaseNotes(id), payload); }
  reconcileHousehold(id: number, payload: OpsReconcileRequest): Promise<OpsHouseholdDetail> { return this.post(opsApiRoutes.householdReconcile(id), payload); }
  grantComplimentary(id: number, payload: ComplimentaryEntitlementRequest): Promise<OpsHouseholdDetail> { return this.post(opsApiRoutes.householdComplimentary(id), payload); }
}
