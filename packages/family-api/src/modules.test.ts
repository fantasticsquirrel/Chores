import { describe, expect, it } from "vitest";

import {
  FAMILY_MODULE_DEFINITIONS,
  getFamilyModulesForPlatform,
  isFamilyModuleSupportedOnPlatform,
} from "./modules";

describe("shared family module metadata", () => {
  it("defines every backend module once with explicit platform support", () => {
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
        supported: false,
        destination: null,
        roles: [],
        navigation: false,
        dashboard: false,
      },
      mobile: {
        supported: false,
        destination: null,
        roles: [],
        navigation: false,
        dashboard: false,
      },
    });
  });

  it("supports the implemented cookbook on both web and mobile", () => {
    expect(getFamilyModulesForPlatform("web").map((module) => module.key)).toEqual([
      "chores",
      "homeschool",
      "recipes",
      "admin",
    ]);
    expect(getFamilyModulesForPlatform("mobile").map((module) => module.key)).toEqual([
      "chores",
      "homeschool",
      "recipes",
      "admin",
    ]);
    expect(isFamilyModuleSupportedOnPlatform("recipes", "web")).toBe(true);
    expect(isFamilyModuleSupportedOnPlatform("recipes", "mobile")).toBe(true);
  });
});
