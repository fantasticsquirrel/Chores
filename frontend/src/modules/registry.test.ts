import { describe, expect, it } from "vitest";

import { familyModules } from "./registry";

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
});
