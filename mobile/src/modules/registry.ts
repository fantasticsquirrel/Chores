import {
  getFamilyModulesForPlatform,
  type FamilyModuleKey,
} from "@family-manager/family-api/modules";
import type { ModulePlatformRegistration } from "@family-manager/family-api/module-manifest-validator";

export type { FamilyModuleKey } from "@family-manager/family-api/modules";

export const familyModules: Array<{
  key: FamilyModuleKey;
  label: string;
  description: string;
  roles: string[];
  destination: string;
  navigation: boolean;
  dashboard: boolean;
}> = getFamilyModulesForPlatform("mobile").map((module) => ({
  key: module.key,
  label: module.labels.mobile,
  description: module.description,
  roles: module.platformDefinitions.mobile.roles,
  destination: module.platformDefinitions.mobile.destination ?? "",
  navigation: module.platformDefinitions.mobile.navigation,
  dashboard: module.platformDefinitions.mobile.dashboard,
}));

const MOBILE_NAVIGATION_MODULE_KEYS = [
  "chores",
  "homeschool",
  "admin",
] as const satisfies ReadonlyArray<FamilyModuleKey>;

export const mobileModuleNavigationItems = MOBILE_NAVIGATION_MODULE_KEYS.map(
  (moduleKey) => getMobileModule(moduleKey),
);

export const MOBILE_MODULE_REGISTRATION: ModulePlatformRegistration = {
  routes: [
    { moduleKey: "chores", destination: "chores" },
    { moduleKey: "chores", destination: "review" },
    { moduleKey: "chores", destination: "money" },
    { moduleKey: "chores", destination: "today" },
    { moduleKey: "homeschool", destination: "homeschool" },
    { moduleKey: "admin", destination: "admin" },
  ],
  navigation: mobileModuleNavigationItems.map(({ key, destination }) => ({
    moduleKey: key,
    destination,
  })),
  guards: ["chores", "homeschool", "admin"],
  dashboardCards: ["chores"],
};

export function getMobileModule(moduleKey: FamilyModuleKey) {
  const module = familyModules.find((candidate) => candidate.key === moduleKey);
  if (module === undefined) {
    throw new Error(`Mobile module ${moduleKey} is not registered.`);
  }
  return module;
}

export function hasMobileModuleGuard(moduleKey: FamilyModuleKey): boolean {
  return MOBILE_MODULE_REGISTRATION.guards.includes(moduleKey);
}

export function hasMobileDashboardCard(moduleKey: FamilyModuleKey): boolean {
  return MOBILE_MODULE_REGISTRATION.dashboardCards.includes(moduleKey);
}

export function canAccessMobileModule(
  modules: ReadonlyArray<{ key: string }>,
  moduleKey: FamilyModuleKey,
): boolean {
  return (
    hasMobileModuleGuard(moduleKey) &&
    modules.some((module) => module.key === moduleKey)
  );
}
