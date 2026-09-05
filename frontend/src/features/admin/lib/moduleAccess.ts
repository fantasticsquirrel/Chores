import type { UserModuleAccess } from "../../../api";
import type { FamilyModuleKey } from "../../../modules/registry";

export function hasModule(
  user: UserModuleAccess,
  moduleKey: FamilyModuleKey,
): boolean {
  return user.modules.some((module) => module.key === moduleKey);
}

export function isLastAdminAccess(
  users: UserModuleAccess[],
  user: UserModuleAccess,
  moduleKey: FamilyModuleKey,
): boolean {
  if (moduleKey !== "admin" || !hasModule(user, "admin")) {
    return false;
  }

  return (
    users.filter(
      (row) => row.role === "PARENT_ADMIN" && hasModule(row, "admin"),
    ).length === 1
  );
}
