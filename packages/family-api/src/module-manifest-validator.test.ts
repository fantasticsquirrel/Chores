import { describe, expect, it } from "vitest";

import {
  validateModuleManifest,
  type CheckedModuleManifest,
  type ModulePlatformRegistrations,
} from "./module-manifest-validator";

const manifest: CheckedModuleManifest = {
  modules: [
    {
      key: "chores",
      name: "Chores",
      description: "Household work.",
      labels: { web: "Chores", mobile: "Chores" },
      defaultGrants: { PARENT_ADMIN: true, PARENT: true, CHILD: true },
      platforms: {
        web: {
          supported: true,
          destination: "/parent/chores",
          roles: ["PARENT_ADMIN", "PARENT"],
          navigation: true,
          dashboard: true,
        },
        mobile: {
          supported: true,
          destination: "chores",
          roles: ["PARENT_ADMIN", "PARENT"],
          navigation: true,
          dashboard: false,
        },
      },
    },
  ],
};

const registrations: ModulePlatformRegistrations = {
  web: {
    routes: [{ moduleKey: "chores", destination: "/parent/chores" }],
    navigation: [{ moduleKey: "chores", destination: "/parent/chores" }],
    guards: ["chores"],
    dashboardCards: ["chores"],
  },
  mobile: {
    routes: [{ moduleKey: "chores", destination: "chores" }],
    navigation: [{ moduleKey: "chores", destination: "chores" }],
    guards: ["chores"],
    dashboardCards: [],
  },
};

const roleModules = {
  PARENT_ADMIN: ["chores"],
  PARENT: ["chores"],
  CHILD: ["chores"],
};

function validate(
  overrides: Partial<Parameters<typeof validateModuleManifest>[0]> = {},
): string[] {
  return validateModuleManifest({
    manifest,
    backendKeys: ["chores"],
    sharedKeys: ["chores"],
    backendDefaultRoleModules: roleModules,
    sharedDefaultRoleModules: roleModules,
    registrations,
    ...overrides,
  }).map((violation) => violation.code);
}

describe("module manifest validator", () => {
  it("accepts aligned backend, shared, route, navigation, guard, and dashboard registrations", () => {
    expect(
      validateModuleManifest({
        manifest,
        backendKeys: ["chores"],
        sharedKeys: ["chores"],
        backendDefaultRoleModules: roleModules,
        sharedDefaultRoleModules: roleModules,
        registrations,
      }),
    ).toEqual([]);
  });

  it("reports backend/shared key drift", () => {
    expect(validate({ backendKeys: ["chores", "ghost"] })).toContain(
      "backend-shared-key-drift",
    );
  });

  it("reports canonical manifest key drift", () => {
    expect(
      validate({
        backendKeys: ["chores", "ghost"],
        sharedKeys: ["chores", "ghost"],
      }),
    ).toContain("manifest-key-drift");
  });

  it("reports supported platforms without a destination", () => {
    const missingDestinationManifest: CheckedModuleManifest = {
      modules: [
        {
          ...manifest.modules[0],
          platforms: {
            ...manifest.modules[0].platforms,
            web: {
              ...manifest.modules[0].platforms.web,
              destination: null,
            },
          },
        },
      ],
    };

    expect(validate({ manifest: missingDestinationManifest })).toContain(
      "missing-platform-destination",
    );
  });

  it("reports supported platforms without registered routes or navigation", () => {
    const missingRoutes: ModulePlatformRegistrations = {
      ...registrations,
      web: { ...registrations.web, routes: [], navigation: [] },
    };

    expect(validate({ registrations: missingRoutes })).toEqual(
      expect.arrayContaining([
        "missing-platform-route",
        "missing-platform-navigation",
      ]),
    );
  });

  it("reports navigation-enabled modules without guards", () => {
    const missingGuard: ModulePlatformRegistrations = {
      ...registrations,
      mobile: { ...registrations.mobile, guards: [] },
    };

    expect(validate({ registrations: missingGuard })).toContain(
      "missing-module-guard",
    );
  });

  it("reports requested dashboard cards without registrations", () => {
    const missingCard: ModulePlatformRegistrations = {
      ...registrations,
      web: { ...registrations.web, dashboardCards: [] },
    };

    expect(validate({ registrations: missingCard })).toContain(
      "missing-dashboard-card",
    );
  });

  it("reports role/default grant drift", () => {
    expect(
      validate({
        backendDefaultRoleModules: { ...roleModules, CHILD: [] },
      }),
    ).toContain("role-default-drift");
  });

  it("reports platform roles that are not granted by default", () => {
    const roleDriftManifest: CheckedModuleManifest = {
      modules: [
        {
          ...manifest.modules[0],
          defaultGrants: {
            ...manifest.modules[0].defaultGrants,
            PARENT: false,
          },
        },
      ],
    };

    expect(validate({ manifest: roleDriftManifest })).toContain(
      "role-default-drift",
    );
  });
});
