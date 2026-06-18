import {
  getFamilyModulesForPlatform,
  type FamilyModuleKey,
} from "@family-manager/family-api/modules";

export type { FamilyModuleKey } from "@family-manager/family-api/modules";

export const familyModules: Array<{
  key: FamilyModuleKey;
  label: string;
  description: string;
  roles: string[];
}> = getFamilyModulesForPlatform("mobile").map((module) => ({
  key: module.key,
  label: module.label,
  description: module.description,
  roles: module.roles,
}));
