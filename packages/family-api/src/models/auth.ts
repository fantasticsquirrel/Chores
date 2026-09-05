import type { UserRole } from "./common";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChildLoginRequest {
  parent_email: string;
  child_name: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetRequestResponse {
  detail: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  new_password: string;
}

export interface PasswordResetConfirmResponse {
  detail: string;
}

export interface RegistrationRequest {
  email: string;
  password: string;
  household_name: string;
  timezone: string;
}

export interface RegistrationVerifyRequest {
  token: string;
}

export interface AuthUser {
  id: number;
  household_id: number;
  email: string;
  role: UserRole;
  child_id?: number | null;
  is_household_owner: boolean;
}

export interface AuthSessionResponse {
  user: AuthUser;
  csrf_token?: string | null;
}
