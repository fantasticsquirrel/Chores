import type { FamilyModule, NotificationItem } from "../../../api/models";
import type { AppTab } from "../../../navigation/types";
// Server-fetched inbox links are still untrusted. Never navigate provider URLs.
export function relatedTab(item: NotificationItem, modules: FamilyModule[], parent: boolean): AppTab | null {
  if (!modules.some((module) => module.key === item.module_key)) return null;
  if (typeof item.link_url !== "string") return null;
  const path = item.link_url.split(/[?#]/)[0];
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (item.module_key === "chores") {
    if (!parent) return path === "/chore/child/today" ? "today" : null;
    const destinations: Record<string, AppTab> = {
      "/chore/board": "review", "/chore/parent/dashboard": "home",
      "/chore/parent/chores": "chores", "/chore/parent/children": "children",
      "/chore/parent/reports": "money",
    };
    return destinations[path] ?? null;
  }
  if (parent && item.module_key === "homeschool" && path === "/homeschool") return "homeschool";
  if (parent && item.module_key === "recipes" && path === "/recipes") return "recipes";
  return null;
}
