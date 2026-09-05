import type { UserModuleAccess } from "../../../api";
import { hasModule, isLastAdminAccess } from "./moduleAccess";

const adminModule = {
  key: "admin" as const,
  name: "Admin",
  description: "Administration",
};

function adminUser(id: number): UserModuleAccess {
  return {
    id,
    household_id: 1,
    email: `admin${id}@example.com`,
    role: "PARENT_ADMIN",
    child_id: null,
    modules: [adminModule],
  };
}

describe("admin module access guards", () => {
  it("identifies assigned modules", () => {
    expect(hasModule(adminUser(1), "admin")).toBe(true);
    expect(hasModule(adminUser(1), "chores")).toBe(false);
  });

  it("only locks admin access for the final assigned parent admin", () => {
    const firstAdmin = adminUser(1);
    const secondAdmin = adminUser(2);

    expect(isLastAdminAccess([firstAdmin], firstAdmin, "admin")).toBe(true);
    expect(
      isLastAdminAccess([firstAdmin, secondAdmin], firstAdmin, "admin"),
    ).toBe(false);
    expect(isLastAdminAccess([firstAdmin], firstAdmin, "chores")).toBe(false);
  });
});
