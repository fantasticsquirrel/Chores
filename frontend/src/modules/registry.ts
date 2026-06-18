import type { UserRole } from "../api";
import {
  getFamilyModulesForPlatform,
  type FamilyModuleKey,
} from "@family-manager/family-api/modules";

export type { FamilyModuleKey } from "@family-manager/family-api/modules";

export type FamilyModule = {
  key: FamilyModuleKey;
  label: string;
  description: string;
  path: string;
  roles: UserRole[];
};

export const familyModules: FamilyModule[] = getFamilyModulesForPlatform("web").map(
  (module) => ({
    key: module.key,
    label: module.label,
    description: module.description,
    path: module.path,
    roles: module.roles,
  }),
);
