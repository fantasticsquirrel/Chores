import { describe, expect, it } from "vitest";

import type { FamilyModuleKey } from "@family-manager/family-api/modules";
import type { FamilyModule } from "../api/models";
import { buildTabs } from "./tabs";

const modules = (...keys: FamilyModuleKey[]): FamilyModule[] =>
  keys.map((key) => ({
    description: key,
    key,
    name: key,
  }));

describe("buildTabs", () => {
  it("keeps child navigation limited to child workflow and account", () => {
    expect(buildTabs("CHILD", modules("chores", "homeschool", "admin"))).toEqual([
      { key: "today", label: "Today" },
      { key: "account", label: "Account" },
    ]);
  });

  it("derives parent tabs from enabled modules", () => {
    expect(buildTabs("PARENT", modules("chores"))).toEqual([
      { key: "home", label: "Home" },
      { key: "children", label: "Children" },
      { key: "chores", label: "Chores" },
      { key: "review", label: "Review" },
      { key: "account", label: "Account" },
    ]);
  });

  it("adds admin only for parent admins with admin module access", () => {
    expect(buildTabs("PARENT_ADMIN", modules("chores", "admin"))).toEqual([
      { key: "home", label: "Home" },
      { key: "children", label: "Children" },
      { key: "chores", label: "Chores" },
      { key: "review", label: "Review" },
      { key: "admin", label: "Admin" },
      { key: "account", label: "Account" },
    ]);
  });
});
