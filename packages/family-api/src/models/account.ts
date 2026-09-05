export type BillingStatus =
  | "none"
  | "trialing"
  | "active"
  | "grace_period"
  | "billing_retry"
  | "canceled_active"
  | "expired"
  | "refunded"
  | "revoked"
  | "complimentary";

export interface BillingAvailableAction {
  key: string;
  label: string;
}

export interface HouseholdOwnershipResponse {
  household_id: number;
  owner_user_id: number;
  owner_email: string;
}

export interface TransferHouseholdOwnershipRequest {
  new_owner_user_id: number;
  current_password: string;
  confirmation: "TRANSFER OWNERSHIP";
}

export interface BillingStatusResponse {
  status: BillingStatus;
  provider: string | null;
  plan_name: string | null;
  expires_at: string | null;
  current_period_ends_at: string | null;
  available_actions: BillingAvailableAction[];
}

export interface BillingActionRequest {
  action: string;
}

export interface BillingActionResponse {
  message: string;
  redirect_url?: string | null;
}
