import type { FamilyModule, UserRole } from "../api/models";
import { isParentRole } from "../utils/format";
import type {
  AppTab,
  NavigationItem,
  NavigationLayout,
  PrimaryNavigationItem,
} from "./types";

export function defaultTabForRole(role: UserRole): AppTab {
  return isParentRole(role) ? "home" : "today";
}

export function hasModule(modules: FamilyModule[], key: string): boolean {
  return modules.some((module) => module.key === key);
}

export function buildNavigationLayout(
  role: UserRole,
  modules: FamilyModule[],
): NavigationLayout {
  if (!isParentRole(role)) {
    return {
      primary: [
        { key: "today", label: "Today" },
        { key: "account", label: "Account" },
      ],
      overflow: [],
    };
  }

  const choresEnabled = hasModule(modules, "chores");
  const homeschoolEnabled = hasModule(modules, "homeschool");
  const primary: PrimaryNavigationItem[] = [{ key: "home", label: "Home" }];
  const overflow: NavigationItem[] = [];

  if (choresEnabled) {
    primary.push({ key: "chores", label: "Chores" });
  }

  if (homeschoolEnabled) {
    primary.push({ key: "homeschool", label: "School" });
    overflow.push({ key: "children", label: "Children" });
  } else {
    primary.push({ key: "children", label: "Children" });
  }

  if (choresEnabled) {
    overflow.push({ key: "review", label: "Review" });
  }

  if (role === "PARENT_ADMIN" && hasModule(modules, "admin")) {
    overflow.push({ key: "admin", label: "Admin" });
  }
  overflow.push({ key: "account", label: "Account" });

  if (overflow.length > 0) {
    primary.push({ key: "more", label: "More" });
  }

  return { overflow, primary };
}

export function navigationDestinations(layout: NavigationLayout): AppTab[] {
  return [
    ...layout.primary.flatMap((item) =>
      item.key === "more" ? [] : [item.key],
    ),
    ...layout.overflow.map((item) => item.key),
  ];
}

export function isMoreSelected(
  layout: NavigationLayout,
  activeTab: AppTab,
): boolean {
  return layout.overflow.some((item) => item.key === activeTab);
}

export function resolveActiveTab(
  layout: NavigationLayout,
  activeTab: AppTab,
  role: UserRole,
): AppTab {
  const destinations = navigationDestinations(layout);
  if (destinations.includes(activeTab)) {
    return activeTab;
  }
  const preferred = defaultTabForRole(role);
  return destinations.includes(preferred) ? preferred : destinations[0] ?? preferred;
}
