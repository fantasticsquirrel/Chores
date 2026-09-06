import manifestJson from "../module-contract.json";

import type { UserRole } from "./models/common";
import type {
  CheckedModuleDefinition,
  CheckedModuleManifest,
  CheckedModulePlatform,
  ManifestPlatform,
  ManifestRole,
} from "./module-manifest-validator";

export type FamilyModuleKey = keyof typeof manifestJson.modules;
export type FamilyModulePlatform = ManifestPlatform;

export type FamilyModulePlatformDefinition = CheckedModulePlatform & {
  roles: UserRole[];
};

export type FamilyModuleDefinition = {
  key: FamilyModuleKey;
  label: string;
  name: string;
  description: string;
  path: string;
  roles: UserRole[];
  platforms: FamilyModulePlatform[];
  labels: Record<FamilyModulePlatform, string>;
  defaultGrants: Record<UserRole, boolean>;
  platformDefinitions: Record<
    FamilyModulePlatform,
    FamilyModulePlatformDefinition
  >;
};

export type BackendModuleDefinition = Pick<
  FamilyModuleDefinition,
  "key" | "name" | "description"
>;

const moduleEntries = Object.entries(manifestJson.modules) as Array<
  [FamilyModuleKey, (typeof manifestJson.modules)[FamilyModuleKey]]
>;

function toCheckedModuleDefinition(
  key: FamilyModuleKey,
  module: (typeof manifestJson.modules)[FamilyModuleKey],
): CheckedModuleDefinition {
  if (module.key !== key) {
    throw new Error(
      `Module manifest key ${module.key} does not match object key ${key}.`,
    );
  }
  return {
    key,
    name: module.name,
    description: module.description,
    labels: module.labels,
    defaultGrants: module.default_grants,
    platforms: {
      web: {
        ...module.platforms.web,
        roles: module.platforms.web.roles as ManifestRole[],
      },
      mobile: {
        ...module.platforms.mobile,
        roles: module.platforms.mobile.roles as ManifestRole[],
      },
    },
  };
}

export const FAMILY_MODULE_MANIFEST: CheckedModuleManifest = {
  modules: moduleEntries.map(([key, module]) =>
    toCheckedModuleDefinition(key, module),
  ),
};

export const FAMILY_MODULE_DEFINITIONS: FamilyModuleDefinition[] =
  FAMILY_MODULE_MANIFEST.modules.map((module) => {
    const web = module.platforms.web as FamilyModulePlatformDefinition;
    return {
      key: module.key as FamilyModuleKey,
      label: module.labels.web,
      name: module.name,
      description: module.description,
      path: web.destination ?? "",
      roles: web.roles,
      platforms: (["web", "mobile"] as FamilyModulePlatform[]).filter(
        (platform) => module.platforms[platform].supported,
      ),
      labels: module.labels,
      defaultGrants: module.defaultGrants,
      platformDefinitions: module.platforms as Record<
        FamilyModulePlatform,
        FamilyModulePlatformDefinition
      >,
    };
  });

export const BACKEND_MODULE_DEFINITIONS: BackendModuleDefinition[] =
  FAMILY_MODULE_DEFINITIONS.map(({ key, name, description }) => ({
    key,
    name,
    description,
  }));

export const BACKEND_DEFAULT_ROLE_MODULES: Record<UserRole, FamilyModuleKey[]> =
  {
    PARENT_ADMIN: FAMILY_MODULE_DEFINITIONS.filter(
      (module) => module.defaultGrants.PARENT_ADMIN,
    ).map((module) => module.key),
    PARENT: FAMILY_MODULE_DEFINITIONS.filter(
      (module) => module.defaultGrants.PARENT,
    ).map((module) => module.key),
    CHILD: FAMILY_MODULE_DEFINITIONS.filter(
      (module) => module.defaultGrants.CHILD,
    ).map((module) => module.key),
  };

export function getFamilyModulesForPlatform(
  platform: FamilyModulePlatform,
): FamilyModuleDefinition[] {
  return FAMILY_MODULE_DEFINITIONS.filter(
    (module) => module.platformDefinitions[platform].supported,
  );
}

export function isFamilyModuleSupportedOnPlatform(
  moduleKey: FamilyModuleKey,
  platform: FamilyModulePlatform,
): boolean {
  return FAMILY_MODULE_DEFINITIONS.some(
    (module) =>
      module.key === moduleKey &&
      module.platformDefinitions[platform].supported,
  );
}
