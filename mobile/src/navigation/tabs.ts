import type { FamilyModule, UserRole } from "../api/models";
import { isParentRole } from "../utils/format";
import type { AppTab, TabDefinition } from "./types";

export function defaultTabForRole(role: UserRole): AppTab {
  return isParentRole(role) ? "home" : "today";
}

export function hasModule(modules: FamilyModule[], key: string): boolean {
  return modules.some((module) => module.key === key);
}

export function buildTabs(
  role: UserRole,
  modules: FamilyModule[],
): TabDefinition[] {
  if (!isParentRole(role)) {
    return [
      { key: "today", label: "Today" },
      { key: "account", label: "Account" },
    ];
  }

  const tabs: TabDefinition[] = [
    { key: "home", label: "Home" },
    { key: "children", label: "Children" },
  ];

  if (hasModule(modules, "chores")) {
    tabs.push({ key: "chores", label: "Chores" });
    tabs.push({ key: "review", label: "Review" });
  }

  if (hasModule(modules, "homeschool")) {
    tabs.push({ key: "homeschool", label: "School" });
  }

  if (role === "PARENT_ADMIN" && hasModule(modules, "admin")) {
    tabs.push({ key: "admin", label: "Admin" });
  }

  tabs.push({ key: "account", label: "Account" });
  return tabs;
}
