import { describe, expect, it } from "vitest";
import { getFamilyModulesForPlatform } from "@family-manager/family-api/modules";

import {
  familyModules,
  getWebModuleDestination,
  WEB_MODULE_REGISTRATION,
} from "./registry";

describe("frontend family module registry", () => {
  it("lists the currently supported web modules in display order", () => {
    const supported = getFamilyModulesForPlatform("web");
    expect(familyModules.map((module) => module.key)).toEqual([
      "chores",
      "homeschool",
      "recipes",
      "admin",
      ...(supported.some((module) => module.key === "family-tree")
        ? ["family-tree"]
        : []),
      "discovery-lab",
    ]);
  });

  it("registers Discovery Lab for children and parents without claiming a dashboard card", () => {
    const discovery = familyModules.find(
      (module) => module.key === "discovery-lab",
    );
    expect(discovery?.roles).toEqual(["PARENT_ADMIN", "PARENT", "CHILD"]);
    expect(getWebModuleDestination("discovery-lab")).toBe("/discovery-lab");
    expect(WEB_MODULE_REGISTRATION.guards).toContain("discovery-lab");
    expect(WEB_MODULE_REGISTRATION.dashboardCards).not.toContain(
      "discovery-lab",
    );
  });

  it("keeps admin web navigation limited to parent admins", () => {
    const adminModule = familyModules.find((module) => module.key === "admin");

    expect(adminModule?.roles).toEqual(["PARENT_ADMIN"]);
  });

  it("derives web destinations and registers implemented dashboard cards", () => {
    expect(getWebModuleDestination("recipes")).toBe("/recipes");
    expect(WEB_MODULE_REGISTRATION.dashboardCards).toEqual([
      "chores",
      "homeschool",
      "recipes",
      "family-tree",
    ]);
  });
});
