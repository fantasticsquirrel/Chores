import { describe, it, expect, vi } from "vitest";
vi.mock("@family-manager/family-api/modules", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@family-manager/family-api/modules")>();
  const tree = real.FAMILY_MODULE_DEFINITIONS.find(
    (m) => m.key === "family-tree",
  )!;
  return {
    ...real,
    getFamilyModulesForPlatform: (platform: "mobile" | "web") => [
      ...real
        .getFamilyModulesForPlatform(platform)
        .filter((m) => m.key !== "family-tree"),
      {
        ...tree,
        platformDefinitions: {
          ...tree.platformDefinitions,
          mobile: {
            supported: true,
            destination: "family-tree",
            roles: ["PARENT", "PARENT_ADMIN"],
            navigation: true,
            dashboard: true,
          },
        },
      },
    ],
  };
});
import {
  MOBILE_MODULE_REGISTRATION,
  canAccessMobileModule,
} from "../modules/registry";
import { buildNavigationLayout, resolveActiveTab } from "./tabs";
const modules = [
  {
    key: "family-tree" as const,
    name: "Family Tree",
    description: "History",
    can_manage: false,
  },
];
describe("supported Family Tree native shell registrations", () => {
  it("registers actual route, strict guard, dashboard and navigation after supported flag", () => {
    expect(MOBILE_MODULE_REGISTRATION.routes).toContainEqual({
      moduleKey: "family-tree",
      destination: "family-tree",
    });
    expect(MOBILE_MODULE_REGISTRATION.guards).toContain("family-tree");
    expect(MOBILE_MODULE_REGISTRATION.dashboardCards).toContain("family-tree");
    expect(canAccessMobileModule(modules, "family-tree")).toBe(true);
  });
  it.each(["PARENT", "PARENT_ADMIN"] as const)(
    "adds only an overflow destination for granted adult %s",
    (role) => {
      const layout = buildNavigationLayout(role, modules);
      expect(layout.overflow).toContainEqual({
        key: "family-tree",
        label: "Family Tree",
      });
      expect(layout.primary.some((i) => i.key === "family-tree")).toBe(false);
      expect(resolveActiveTab(layout, "family-tree", role)).toBe("family-tree");
    },
  );
  it("denies stray child grants and hides revoked Family Tree", () => {
    expect(
      buildNavigationLayout("CHILD", modules).overflow.some(
        (i) => i.key === "family-tree",
      ),
    ).toBe(false);
    expect(
      buildNavigationLayout("PARENT", []).overflow.some(
        (i) => i.key === "family-tree",
      ),
    ).toBe(false);
    expect(
      resolveActiveTab(
        buildNavigationLayout("PARENT", []),
        "family-tree",
        "PARENT",
      ),
    ).toBe("home");
  });
});
