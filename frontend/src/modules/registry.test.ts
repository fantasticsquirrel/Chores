import { describe, expect, it } from "vitest";

import {
  familyModules,
  getWebModuleDestination,
  WEB_MODULE_REGISTRATION,
} from "./registry";

describe("frontend family module registry", () => {
  it("lists the currently supported web modules in display order", () => {
    expect(familyModules.map((module) => module.key)).toEqual([
      "chores",
      "homeschool",
      "recipes",
      "admin",
    ]);
  });

  it("keeps admin web navigation limited to parent admins", () => {
    const adminModule = familyModules.find((module) => module.key === "admin");

    expect(adminModule?.roles).toEqual(["PARENT_ADMIN"]);
  });

  it("derives web destinations and dashboard requests from the canonical manifest", () => {
    expect(getWebModuleDestination("recipes")).toBe("/recipes");
    expect(WEB_MODULE_REGISTRATION.dashboardCards).toEqual([
      "chores",
      "homeschool",
      "recipes",
    ]);
  });
});
