import type { UserRole } from "./models";

export type FamilyModuleKey = "chores" | "homeschool" | "recipes" | "admin";
export type FamilyModulePlatform = "web" | "mobile";

export type FamilyModuleDefinition = {
  key: FamilyModuleKey;
  label: string;
  name: string;
  description: string;
  path: string;
  roles: UserRole[];
  platforms: FamilyModulePlatform[];
};

export type BackendModuleDefinition = Pick<
  FamilyModuleDefinition,
  "key" | "name" | "description"
>;

export const FAMILY_MODULE_DEFINITIONS: FamilyModuleDefinition[] = [
  {
    key: "chores",
    label: "Chores",
    name: "Chores",
    description: "Chore assignments, submissions, approvals, and rewards.",
    path: "/parent/chores",
    roles: ["PARENT_ADMIN", "PARENT"],
    platforms: ["web", "mobile"],
  },
  {
    key: "homeschool",
    label: "Homeschool",
    name: "Homeschool",
    description: "Attendance, subjects, semesters, comments, and homeschool reporting.",
    path: "/homeschool",
    roles: ["PARENT_ADMIN", "PARENT"],
    platforms: ["web", "mobile"],
  },
  {
    key: "recipes",
    label: "Recipes",
    name: "Recipes",
    description: "Personal recipe collection, ingredients, scaling, and cooking notes.",
    path: "/recipes",
    roles: ["PARENT_ADMIN", "PARENT"],
    platforms: ["web"],
  },
  {
    key: "admin",
    label: "Admin",
    name: "Admin",
    description: "Household users, child accounts, and module access controls.",
    path: "/admin/dashboard",
    roles: ["PARENT_ADMIN"],
    platforms: ["web", "mobile"],
  },
];

export const BACKEND_MODULE_DEFINITIONS: BackendModuleDefinition[] =
  FAMILY_MODULE_DEFINITIONS.map(({ key, name, description }) => ({
    key,
    name,
    description,
  }));

export const BACKEND_DEFAULT_ROLE_MODULES: Record<UserRole, FamilyModuleKey[]> = {
  PARENT_ADMIN: ["chores", "homeschool", "recipes", "admin"],
  PARENT: ["chores", "homeschool", "recipes"],
  CHILD: ["chores"],
};

export function getFamilyModulesForPlatform(
  platform: FamilyModulePlatform,
): FamilyModuleDefinition[] {
  return FAMILY_MODULE_DEFINITIONS.filter((module) =>
    module.platforms.includes(platform),
  );
}

export function isFamilyModuleSupportedOnPlatform(
  moduleKey: FamilyModuleKey,
  platform: FamilyModulePlatform,
): boolean {
  return FAMILY_MODULE_DEFINITIONS.some(
    (module) => module.key === moduleKey && module.platforms.includes(platform),
  );
}
