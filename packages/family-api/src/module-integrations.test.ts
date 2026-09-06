import { describe, expect, it } from "vitest";

import { WEB_MODULE_REGISTRATION } from "../../../frontend/src/modules/registry";
import { MOBILE_MODULE_REGISTRATION } from "../../../mobile/src/modules/registry";
import {
  BACKEND_DEFAULT_ROLE_MODULES,
  BACKEND_MODULE_DEFINITIONS,
  FAMILY_MODULE_DEFINITIONS,
  FAMILY_MODULE_MANIFEST,
} from "./modules";
import { validateModuleManifest } from "./module-manifest-validator";

describe("checked module integrations", () => {
  it("keeps backend/shared metadata and both platform registrations aligned", () => {
    expect(
      validateModuleManifest({
        manifest: FAMILY_MODULE_MANIFEST,
        backendKeys: BACKEND_MODULE_DEFINITIONS.map((module) => module.key),
        sharedKeys: FAMILY_MODULE_DEFINITIONS.map((module) => module.key),
        backendDefaultRoleModules: BACKEND_DEFAULT_ROLE_MODULES,
        sharedDefaultRoleModules: BACKEND_DEFAULT_ROLE_MODULES,
        registrations: {
          web: WEB_MODULE_REGISTRATION,
          mobile: MOBILE_MODULE_REGISTRATION,
        },
      }),
    ).toEqual([]);
  });
});
