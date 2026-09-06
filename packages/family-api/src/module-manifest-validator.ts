export type ManifestRole = "PARENT_ADMIN" | "PARENT" | "CHILD";
export type ManifestPlatform = "web" | "mobile";

export type CheckedModulePlatform = {
  supported: boolean;
  destination: string | null;
  roles: ManifestRole[];
  navigation: boolean;
  dashboard: boolean;
};

export type CheckedModuleDefinition = {
  key: string;
  name: string;
  description: string;
  labels: Record<ManifestPlatform, string>;
  defaultGrants: Record<ManifestRole, boolean>;
  platforms: Record<ManifestPlatform, CheckedModulePlatform>;
};

export type CheckedModuleManifest = {
  modules: CheckedModuleDefinition[];
};

export type ModuleDestinationRegistration = {
  moduleKey: string;
  destination: string;
};

export type ModulePlatformRegistration = {
  routes: ModuleDestinationRegistration[];
  navigation: ModuleDestinationRegistration[];
  guards: string[];
  dashboardCards: string[];
};

export type ModulePlatformRegistrations = Record<
  ManifestPlatform,
  ModulePlatformRegistration
>;

export type ModuleManifestViolationCode =
  | "backend-shared-key-drift"
  | "manifest-key-drift"
  | "missing-platform-destination"
  | "missing-platform-route"
  | "missing-platform-navigation"
  | "missing-module-guard"
  | "missing-dashboard-card"
  | "role-default-drift";

export type ModuleManifestViolation = {
  code: ModuleManifestViolationCode;
  message: string;
};

type RoleModules = Record<ManifestRole, string[]>;

export type ValidateModuleManifestInput = {
  manifest: CheckedModuleManifest;
  backendKeys: string[];
  sharedKeys: string[];
  backendDefaultRoleModules: RoleModules;
  sharedDefaultRoleModules: RoleModules;
  registrations: ModulePlatformRegistrations;
};

const ROLES: ManifestRole[] = ["PARENT_ADMIN", "PARENT", "CHILD"];
const PLATFORMS: ManifestPlatform[] = ["web", "mobile"];

function sameValues(left: string[], right: string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function hasDestination(
  registrations: ModuleDestinationRegistration[],
  moduleKey: string,
  destination: string,
): boolean {
  return registrations.some(
    (registration) =>
      registration.moduleKey === moduleKey &&
      registration.destination === destination,
  );
}

export function validateModuleManifest({
  manifest,
  backendKeys,
  sharedKeys,
  backendDefaultRoleModules,
  sharedDefaultRoleModules,
  registrations,
}: ValidateModuleManifestInput): ModuleManifestViolation[] {
  const violations: ModuleManifestViolation[] = [];
  const manifestKeys = manifest.modules.map((module) => module.key);

  if (!sameValues(backendKeys, sharedKeys)) {
    violations.push({
      code: "backend-shared-key-drift",
      message: "Backend and shared module keys differ.",
    });
  }
  if (
    !sameValues(manifestKeys, backendKeys) ||
    !sameValues(manifestKeys, sharedKeys)
  ) {
    violations.push({
      code: "manifest-key-drift",
      message: "Runtime module keys differ from the canonical manifest.",
    });
  }

  for (const role of ROLES) {
    const expected = manifest.modules
      .filter((module) => module.defaultGrants[role])
      .map((module) => module.key);
    if (
      !sameValues(expected, backendDefaultRoleModules[role]) ||
      !sameValues(expected, sharedDefaultRoleModules[role])
    ) {
      violations.push({
        code: "role-default-drift",
        message: `Default grants for ${role} differ from the canonical manifest.`,
      });
    }
  }

  for (const module of manifest.modules) {
    for (const platform of PLATFORMS) {
      const definition = module.platforms[platform];
      if (!definition.supported) {
        continue;
      }
      if (
        definition.roles.some((role) => module.defaultGrants[role] !== true)
      ) {
        violations.push({
          code: "role-default-drift",
          message: `${module.key} exposes a ${platform} role without a default grant.`,
        });
      }
      if (
        definition.destination === null ||
        definition.destination.trim() === ""
      ) {
        violations.push({
          code: "missing-platform-destination",
          message: `${module.key} supports ${platform} without a destination.`,
        });
        continue;
      }
      const platformRegistrations = registrations[platform];
      if (
        !hasDestination(
          platformRegistrations.routes,
          module.key,
          definition.destination,
        )
      ) {
        violations.push({
          code: "missing-platform-route",
          message: `${module.key} has no registered ${platform} route for ${definition.destination}.`,
        });
      }
      if (
        definition.navigation &&
        !hasDestination(
          platformRegistrations.navigation,
          module.key,
          definition.destination,
        )
      ) {
        violations.push({
          code: "missing-platform-navigation",
          message: `${module.key} has no registered ${platform} navigation destination.`,
        });
      }
      if (
        definition.navigation &&
        !platformRegistrations.guards.includes(module.key)
      ) {
        violations.push({
          code: "missing-module-guard",
          message: `${module.key} has ${platform} navigation but no module guard.`,
        });
      }
      if (
        definition.dashboard &&
        !platformRegistrations.dashboardCards.includes(module.key)
      ) {
        violations.push({
          code: "missing-dashboard-card",
          message: `${module.key} requests a ${platform} dashboard card that is not registered.`,
        });
      }
    }
  }

  return violations;
}
