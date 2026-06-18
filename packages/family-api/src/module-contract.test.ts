import { describe, expect, it } from "vitest";

import {
  BACKEND_DEFAULT_ROLE_MODULES,
  BACKEND_MODULE_DEFINITIONS,
  FAMILY_MODULE_DEFINITIONS,
} from "./modules";

describe("backend/shared module contract", () => {
  it("keeps backend module keys and display metadata in lockstep with shared definitions", () => {
    expect(BACKEND_MODULE_DEFINITIONS).toEqual(
      FAMILY_MODULE_DEFINITIONS.map(({ key, name, description }) => ({
        key,
        name,
        description,
      })),
    );
  });

  it("documents default backend module grants by role", () => {
    expect(BACKEND_DEFAULT_ROLE_MODULES).toEqual({
      PARENT_ADMIN: ["chores", "homeschool", "recipes", "admin"],
      PARENT: ["chores", "homeschool", "recipes"],
      CHILD: ["chores"],
    });
  });
});
