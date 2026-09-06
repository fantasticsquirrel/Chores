import { describe, expect, it } from "vitest";

import {
  canAccessMobileModule,
  familyModules,
  getMobileModule,
  MOBILE_MODULE_REGISTRATION,
} from "./registry";

describe("mobile family module registry", () => {
  it("documents the currently supported mobile modules", () => {
    expect(familyModules.map((module) => module.key)).toEqual([
      "chores",
      "homeschool",
      "admin",
    ]);
  });

  it("keeps admin mobile navigation limited to parent admins", () => {
    const adminModule = familyModules.find((module) => module.key === "admin");

    expect(adminModule?.roles).toEqual(["PARENT_ADMIN"]);
  });

  it("derives mobile destinations and labels from the canonical manifest", () => {
    expect(getMobileModule("homeschool")).toMatchObject({
      destination: "homeschool",
      label: "School",
      navigation: true,
    });
    expect(MOBILE_MODULE_REGISTRATION.dashboardCards).toEqual(["chores"]);
    expect(canAccessMobileModule([{ key: "chores" }], "chores")).toBe(true);
    expect(canAccessMobileModule([], "chores")).toBe(false);
  });
});
