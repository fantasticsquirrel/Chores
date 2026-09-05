import type { FamilyModuleKey } from "../modules";
import type { UserRole } from "./common";

export interface FamilyModule {
  key: FamilyModuleKey;
  name: string;
  description: string;
  can_manage?: boolean;
}

export interface MyModulesResponse {
  modules: FamilyModule[];
}

export interface HouseholdModuleAccess extends FamilyModule {
  enabled: boolean;
  can_disable: boolean;
}

export interface SetHouseholdModuleAccessRequest {
  enabled: boolean;
}

export interface UserModuleAccess {
  id: number;
  household_id: number;
  email: string;
  role: UserRole;
  child_id?: number | null;
  modules: FamilyModule[];
}

export interface CreateParentUserRequest {
  email: string;
  password: string;
  role: "PARENT" | "PARENT_ADMIN";
}

export interface SetUserModuleAccessRequest {
  module_key: FamilyModuleKey;
  can_view: boolean;
  can_manage?: boolean;
}
