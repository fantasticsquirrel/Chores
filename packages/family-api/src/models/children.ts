import type { UserRole } from "./common";

export interface Child {
  id: number;
  household_id: number;
  name: string;
  active: boolean;
}

export interface ListChildrenParams {
  household_id: number;
  active_only?: boolean;
}

export interface CreateChildRequest {
  household_id: number;
  name: string;
  active?: boolean;
}

export interface UpdateChildRequest {
  household_id: number;
  name?: string;
  active?: boolean;
}

export interface CreateChildAccountRequest {
  household_id: number;
  email?: string | null;
  password: string;
}

export interface ResetChildAccountEmailRequest {
  household_id: number;
  email?: string | null;
}

export interface ResetChildAccountPasswordRequest {
  household_id: number;
  new_password: string;
}

export interface ChildAccount {
  id: number;
  household_id: number;
  email: string;
  role: UserRole;
  child_id: number;
}
