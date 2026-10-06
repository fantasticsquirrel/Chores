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
    ]);
    expect(
      FAMILY_MODULE_DEFINITIONS.every((module) => module.platforms.length > 0),
    ).toBe(true);
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
