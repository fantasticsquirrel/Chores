import { describe, expect, it } from "vitest";

import { familyModules } from "./registry";

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
});
