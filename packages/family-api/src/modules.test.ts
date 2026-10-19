import { describe, expect, it } from "vitest";

import {
  FAMILY_MODULE_DEFINITIONS,
  getFamilyModulesForPlatform,
  isFamilyModuleSupportedOnPlatform,
} from "./modules";

describe("shared family module metadata", () => {
  it("defines every backend module once with explicit released platform support", () => {
    expect(FAMILY_MODULE_DEFINITIONS.map((module) => module.key)).toEqual([
      "chores",
      "homeschool",
      "recipes",
      "admin",
      "family-tree",
    ]);
    for (const module of FAMILY_MODULE_DEFINITIONS) {
      expect(Object.keys(module.platformDefinitions).sort()).toEqual([
        "mobile",
        "web",
      ]);
    }
    const familyTree = FAMILY_MODULE_DEFINITIONS.find(
      (module) => module.key === "family-tree",
    );
    expect(familyTree?.platformDefinitions).toEqual({
      web: {
        supported: true,
        destination: "/family-tree",
        roles: ["PARENT_ADMIN", "PARENT"],
        navigation: true,
        dashboard: true,
      },
      mobile: {
        supported: true,
        destination: "family-tree",
        roles: ["PARENT_ADMIN", "PARENT"],
        navigation: true,
        dashboard: true,
      },
    });
  });

  it("supports the cookbook and adult-only Family Tree on both platforms", () => {
    for (const platform of ["web", "mobile"] as const) {
      expect(getFamilyModulesForPlatform(platform).map((module) => module.key)).toEqual([
        "chores",
        "homeschool",
        "recipes",
        "admin",
        "family-tree",
      ]);
      expect(isFamilyModuleSupportedOnPlatform("recipes", platform)).toBe(true);
      expect(isFamilyModuleSupportedOnPlatform("family-tree", platform)).toBe(true);
    }
  });
});
