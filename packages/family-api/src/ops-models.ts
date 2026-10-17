import type {
  BillingStatusResponse,
  HouseholdOwnershipResponse,
} from "./models/account";

export type OpsRole = "PLATFORM_OWNER" | "PLATFORM_SUPPORT";
export interface OpsUser {
  id: number;
  email: string;
  role: OpsRole;
  mfa_required: boolean;
  mfa_verified: boolean;
}
export interface OpsSessionResponse {
  user: OpsUser;
  csrf_token?: string | null;
}
export interface OpsLoginRequest {
  email: string;
  password: string;
  totp_code: string;
}
export interface OpsReauthRequest {
  password: string;
  totp_code: string;
}
export interface OpsHouseholdSummary {
  id: number;
  name: string;
  owner_email: string;
  billing_status: BillingStatusResponse["status"];
}
export interface OpsEntitlementSummary {
  key: string;
  status: string;
  expires_at: string | null;
}
export interface OpsEventSummary {
  id: string;
  type: string;
  occurred_at: string;
  summary: string;
}
export interface OpsAuditEntry {
  id: string;
  actor_email: string;
  action: string;
  occurred_at: string;
  reason: string | null;
}
export interface OpsSupportNote {
  id: number;
  author_email: string;
  body: string;
  created_at: string;
}
export interface OpsSupportCase {
  id: number;
  subject: string;
  status: string;
  created_at: string;
  notes: OpsSupportNote[];
}
export interface OpsHouseholdDetail extends OpsHouseholdSummary {
  ownership: HouseholdOwnershipResponse;
  billing: BillingStatusResponse;
  entitlements: OpsEntitlementSummary[];
  support_cases: OpsSupportCase[];
}
export interface OpsBillingDetail {
  household_id: number;
  entitlement: { plan_key: string; status: string; valid_until: string | null };
  events: Array<{
    id: number;
    source: string;
    event_type: string;
    occurred_at: string;
  }>;
}
export interface CreateOpsSupportCaseRequest {
  reason: string;
}
export interface AppendOpsSupportNoteRequest {
  body: string;
}
export interface OpsReconcileRequest {
  case_id: number;
  reason: string;
}
export interface ComplimentaryEntitlementRequest {
  reason: string;
  idempotency_key: string;
  expires_at: string;
}

export interface OwnerOverview {
  household_count: number;
  account_count: number;
  active_account_count: number;
  enabled_module_count: number;
  module_count: number;
}
export interface OwnerHousehold extends OpsHouseholdSummary {
  timezone: string;
  account_count: number;
  active_account_count: number;
}
export interface OwnerPage<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}
export type OwnerHouseholdPage = OwnerPage<OwnerHousehold>;
export interface OwnerPagination {
  offset?: number;
  limit?: number;
}
export interface OwnerHouseholdQuery extends OwnerPagination {
  query?: string;
}
export interface ModuleAccessChange {
  enabled: boolean;
  expected_enabled: boolean;
  reason: string;
}
export interface ModuleAccessSummary {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  can_enable: boolean;
  can_disable: boolean;
  restriction: string | null;
}
export interface GlobalModule extends ModuleAccessSummary {
  platforms: { web: boolean; mobile: boolean };
}
export interface HouseholdModule extends ModuleAccessSummary {
  globally_enabled: boolean;
  effective_enabled: boolean;
}
export interface OwnerAccount {
  id: number;
  email: string;
  role: "PARENT_ADMIN" | "PARENT" | "CHILD";
  active: boolean;
  is_household_owner: boolean;
}
export interface OwnerAccountPage extends OwnerPage<OwnerAccount> {
  household_id: number;
}
