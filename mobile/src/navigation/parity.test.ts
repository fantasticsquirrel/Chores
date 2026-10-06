import {describe, expect, it} from "vitest";
import {buildNavigationLayout, navigationDestinations, resolveActiveTab} from "./tabs";
import {canAccessMobileModule, getMobileModule} from "../modules/registry";
import type {FamilyModule} from "../api/models";
const modules = (...keys: FamilyModule["key"][]): FamilyModule[] => keys.map(key=>({key,name:key,description:key}));

describe("website destination parity", () => {
  it("registers and exposes the cookbook for granted parents", () => {
    expect(getMobileModule("recipes").destination).toBe("recipes");
    expect(canAccessMobileModule(modules("recipes"),"recipes")).toBe(true);
    expect(navigationDestinations(buildNavigationLayout("PARENT",modules("recipes")))).toContain("recipes");
  });
  it("exposes the inbox to parents and children with chores access", () => {
    for(const role of ["PARENT", "PARENT_ADMIN", "CHILD"] as const) {
      expect(navigationDestinations(buildNavigationLayout(role,modules("chores")))).toContain("notifications");
    }
  });
  it("removes revoked destinations and keeps children management module-gated", () => {
    const layout=buildNavigationLayout("PARENT",[]);
    expect(navigationDestinations(layout)).not.toContain("children");
    expect(navigationDestinations(layout)).not.toContain("notifications");
    expect(navigationDestinations(layout)).not.toContain("recipes");
    expect(resolveActiveTab(layout,"recipes","PARENT")).toBe("home");
  });
  it("keeps recipes out of child navigation even with a stray grant", () => {
    expect(navigationDestinations(buildNavigationLayout("CHILD",modules("chores","recipes")))).not.toContain("recipes");
  });
});
