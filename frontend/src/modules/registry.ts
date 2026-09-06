import {
  getFamilyModulesForPlatform,
  type FamilyModuleKey,
} from "@family-manager/family-api/modules";
import type { ModulePlatformRegistration } from "@family-manager/family-api/module-manifest-validator";

import type { UserRole } from "../api";

export type { FamilyModuleKey } from "@family-manager/family-api/modules";

export type FamilyModule = {
  key: FamilyModuleKey;
  label: string;
  description: string;
  path: string;
  roles: UserRole[];
  navigation: boolean;
  dashboard: boolean;
};

export const familyModules: FamilyModule[] = getFamilyModulesForPlatform(
  "web",
).map((module) => ({
  key: module.key,
  label: module.labels.web,
  description: module.description,
  path: module.platformDefinitions.web.destination ?? "",
  roles: module.platformDefinitions.web.roles,
  navigation: module.platformDefinitions.web.navigation,
  dashboard: module.platformDefinitions.web.dashboard,
}));

export const webModuleNavigationItems = familyModules
  .filter((module) => module.navigation)
  .map((module) => ({
    to: module.path,
    label: module.label,
    roles: module.roles,
    moduleKey: module.key,
  }));

export const WEB_MODULE_REGISTRATION: ModulePlatformRegistration = {
  routes: [
    { moduleKey: "chores", destination: "/parent/chores" },
    { moduleKey: "chores", destination: "/board" },
    { moduleKey: "chores", destination: "/parent/children" },
    { moduleKey: "chores", destination: "/parent/money" },
    { moduleKey: "chores", destination: "/child/today" },
    { moduleKey: "chores", destination: "/child/history" },
    { moduleKey: "homeschool", destination: "/homeschool" },
    { moduleKey: "recipes", destination: "/recipes" },
    { moduleKey: "recipes", destination: "/recipes/:recipeId" },
    { moduleKey: "admin", destination: "/admin/dashboard" },
  ],
  navigation: webModuleNavigationItems.map(({ moduleKey, to }) => ({
    moduleKey,
    destination: to,
  })),
  guards: ["chores", "homeschool", "recipes", "admin"],
  dashboardCards: ["chores", "homeschool", "recipes"],
};

export function getWebModuleDestination(moduleKey: FamilyModuleKey): string {
  const module = familyModules.find((candidate) => candidate.key === moduleKey);
  if (module === undefined) {
    throw new Error(`Web module ${moduleKey} is not registered.`);
  }
  return module.path;
}

export function hasWebModuleGuard(moduleKey: FamilyModuleKey): boolean {
  return WEB_MODULE_REGISTRATION.guards.includes(moduleKey);
}

export function hasWebDashboardCard(moduleKey: FamilyModuleKey): boolean {
  return WEB_MODULE_REGISTRATION.dashboardCards.includes(moduleKey);
}
