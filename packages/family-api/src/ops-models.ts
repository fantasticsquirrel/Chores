import type { BillingStatusResponse, HouseholdOwnershipResponse } from "./models";

export type OpsRole = "OWNER" | "SUPPORT";
export interface OpsUser { id: number; email: string; role: OpsRole; mfa_required: boolean; mfa_verified: boolean }
export interface OpsSessionResponse { user: OpsUser; csrf_token?: string | null }
export interface OpsLoginRequest { email: string; password: string; totp_code: string }
export interface OpsReauthRequest { password: string; totp_code: string }
export interface OpsHouseholdSummary { id: number; name: string; owner_email: string; billing_status: BillingStatusResponse["status"] }
export interface OpsEntitlementSummary { key: string; status: string; expires_at: string | null }
export interface OpsEventSummary { id: string; type: string; occurred_at: string; summary: string }
export interface OpsAuditEntry { id: string; actor_email: string; action: string; occurred_at: string; reason: string | null }
export interface OpsSupportNote { id: number; author_email: string; body: string; created_at: string }
export interface OpsSupportCase { id: number; subject: string; status: string; created_at: string; notes: OpsSupportNote[] }
export interface OpsHouseholdDetail extends OpsHouseholdSummary {
  ownership: HouseholdOwnershipResponse;
  billing: BillingStatusResponse;
  entitlements: OpsEntitlementSummary[];
  support_cases: OpsSupportCase[];
}
export interface CreateOpsSupportCaseRequest { reason: string }
export interface AppendOpsSupportNoteRequest { body: string }
export interface OpsReconcileRequest { case_id: number; reason: string }
export interface ComplimentaryEntitlementRequest { reason: string; idempotency_key: string; expires_at: string }
