import { describe, expect, it } from "vitest";

import type { FamilyModuleKey } from "@family-manager/family-api/modules";
import type { FamilyModule } from "../api/models";
import {
  buildNavigationLayout,
  isMoreSelected,
  navigationDestinations,
  resolveActiveTab,
} from "./tabs";

const modules = (...keys: FamilyModuleKey[]): FamilyModule[] =>
  keys.map((key) => ({
    description: key,
    key,
    name: key,
  }));

describe("buildNavigationLayout", () => {
  it("keeps child navigation limited to Today and Account", () => {
    const layout = buildNavigationLayout(
      "CHILD",
      modules("chores", "homeschool", "admin"),
    );

    expect(layout).toEqual({
      primary: [
        { key: "today", label: "Today" },
        { key: "account", label: "Account" },
      ],
      overflow: [],
    });
    expect(navigationDestinations(layout)).toEqual(["today", "account"]);
  });

  it("keeps Children primary when chores is the only enabled work module", () => {
    expect(buildNavigationLayout("PARENT", modules("chores"))).toEqual({
      primary: [
        { key: "home", label: "Home" },
        { key: "chores", label: "Chores" },
        { key: "children", label: "Children" },
        { key: "more", label: "More" },
      ],
      overflow: [
        { key: "review", label: "Review" },
        { key: "account", label: "Account" },
      ],
    });
  });

  it("moves secondary destinations into More when School is enabled", () => {
    expect(
      buildNavigationLayout("PARENT", modules("chores", "homeschool")),
    ).toEqual({
      primary: [
        { key: "home", label: "Home" },
        { key: "chores", label: "Chores" },
        { key: "homeschool", label: "School" },
        { key: "more", label: "More" },
      ],
      overflow: [
        { key: "children", label: "Children" },
        { key: "review", label: "Review" },
        { key: "account", label: "Account" },
      ],
    });
  });

  it("adds Admin only for parent admins with admin module access", () => {
    const parent = buildNavigationLayout(
      "PARENT",
      modules("chores", "admin"),
    );
    const adminWithoutAccess = buildNavigationLayout(
      "PARENT_ADMIN",
      modules("chores"),
    );
    const admin = buildNavigationLayout(
      "PARENT_ADMIN",
      modules("chores", "admin"),
    );

    expect(navigationDestinations(parent)).not.toContain("admin");
    expect(navigationDestinations(adminWithoutAccess)).not.toContain("admin");
    expect(admin.overflow).toContainEqual({ key: "admin", label: "Admin" });
  });

  it("keeps More selected while an overflow destination is active", () => {
    const layout = buildNavigationLayout(
      "PARENT_ADMIN",
      modules("chores", "homeschool", "admin"),
    );

    expect(isMoreSelected(layout, "children")).toBe(true);
    expect(isMoreSelected(layout, "admin")).toBe(true);
    expect(isMoreSelected(layout, "home")).toBe(false);
  });

  it("preserves a valid destination and falls back after module access changes", () => {
    const fullLayout = buildNavigationLayout(
      "PARENT_ADMIN",
      modules("chores", "homeschool", "admin"),
    );
    const reducedLayout = buildNavigationLayout("PARENT", modules("chores"));

    expect(resolveActiveTab(fullLayout, "admin", "PARENT_ADMIN")).toBe("admin");
    expect(resolveActiveTab(reducedLayout, "admin", "PARENT")).toBe("home");
  });
});
