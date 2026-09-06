import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const endpointsDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = dirname(endpointsDirectory);
const endpointFiles = readdirSync(endpointsDirectory)
  .filter(
    (file) =>
      file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "index.ts",
  )
  .sort();

const expectedMethodsByFile: Record<string, string[]> = {
  "core.ts": [
    "approveSubmission",
    "archiveChore",
    "completeParentTask",
    "createChild",
    "createChildAccount",
    "createChore",
    "createChoreTransaction",
    "createHomeschoolSemester",
    "createHomeschoolSubject",
    "createSubmission",
    "decideSubmissionItem",
    "deleteHomeschoolAttendance",
    "deleteHomeschoolDayComment",
    "deleteHomeschoolGrade",
    "deleteHomeschoolSemester",
    "deleteHomeschoolSubject",
    "listChildBalances",
    "listChildren",
    "listChoreTransactions",
    "listChores",
    "listEligibleChores",
    "listHomeschoolAttendance",
    "listHomeschoolDayComments",
    "listHomeschoolGrades",
    "listHomeschoolSemesters",
    "listHomeschoolSubjects",
    "listMyParentTasks",
    "listSubmissions",
    "resetChildAccountEmail",
    "resetChildAccountPassword",
    "updateChild",
    "updateChore",
    "updateHomeschoolSemester",
    "updateHomeschoolSubject",
    "upsertHomeschoolAttendance",
    "upsertHomeschoolDayComment",
    "upsertHomeschoolGrade",
  ],
  "notifications.ts": [
    "createPushSubscription",
    "disablePushSubscriptions",
    "getNotificationSettings",
    "getPushConfig",
    "listNotifications",
    "markAllNotificationsRead",
    "markNotificationRead",
    "updateNotificationSettings",
  ],
  "recipes.ts": [
    "archiveRecipe",
    "createRecipe",
    "createRecipeCategory",
    "createRecipeTag",
    "createRecipeVariant",
    "deleteRecipe",
    "deleteRecipeCategory",
    "deleteRecipeTag",
    "duplicateRecipe",
    "exportRecipeBackup",
    "getRecipe",
    "importRecipeBackup",
    "importRecipeFromUrl",
    "listRecipeCategories",
    "listRecipeTags",
    "listRecipes",
    "scaleRecipe",
    "updateRecipe",
    "updateRecipeCategory",
    "updateRecipeTag",
    "upsertRecipeFeedback",
  ],
  "support.ts": [
    "changePassword",
    "childLogin",
    "confirmPasswordReset",
    "createParentUser",
    "getBillingStatus",
    "getCurrentSession",
    "getHealth",
    "getHouseholdOwnership",
    "getLiveness",
    "getMyModules",
    "getReadiness",
    "listHouseholdModules",
    "listUserModuleAccess",
    "login",
    "logout",
    "requestPasswordReset",
    "requestRegistration",
    "setHouseholdModuleAccess",
    "setUserModuleAccess",
    "transferHouseholdOwnership",
    "verifyRegistration",
  ],
};

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

function endpointMethods(source: string): string[] {
  return [...source.matchAll(/^  async (\w+)/gm)]
    .map((match) => match[1])
    .sort();
}

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return productionTypeScriptFiles(path);
    }
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
      ? [path]
      : [];
  });
}

describe("endpoint group structure", () => {
  it("owns each endpoint exactly once in the intended domain file", () => {
    expect(endpointFiles).toEqual([
      "core.ts",
      "notifications.ts",
      "recipes.ts",
      "support.ts",
    ]);

    const allMethods = endpointFiles.flatMap((file) => {
      const source = readSource(join(endpointsDirectory, file));
      expect(source).not.toMatch(/\bany\b/);
      expect(source).not.toContain('from "../models"');
      expect(source).not.toMatch(
        /protected abstract (?:get|post|put|patch|delete)/,
      );
      expect(endpointMethods(source)).toEqual(expectedMethodsByFile[file]);
      return endpointMethods(source);
    });

    expect(new Set(allMethods).size).toBe(allMethods.length);
  });

  it("keeps transport primitives in client-core and platform policy out of endpoints", () => {
    const clientCore = readSource(join(sourceDirectory, "client-core.ts"));
    const endpointSources = endpointFiles
      .map((file) => readSource(join(endpointsDirectory, file)))
      .join("\n");

    for (const primitive of [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "postNoContent",
      "postNoContentWithBody",
    ]) {
      expect(clientCore).toMatch(
        new RegExp(`protected abstract ${primitive}(?:<[^>]+>)?\\(`),
      );
    }
    expect(endpointSources).not.toMatch(
      /\b(?:credentials|csrf|cookie|fetchImpl|baseUrl)\b/i,
    );
  });

  it("publishes domain endpoint entry points without a compatibility barrel", () => {
    const endpointBarrel = readSource(join(endpointsDirectory, "index.ts"));
    const packageManifest = JSON.parse(
      readSource(join(sourceDirectory, "../package.json")),
    ) as { exports: Record<string, string> };

    expect(
      [...endpointBarrel.matchAll(/from "\.\/(\w+)"/g)]
        .map((match) => `${match[1]}.ts`)
        .sort(),
    ).toEqual(endpointFiles);
    expect(packageManifest.exports["./api-endpoints"]).toBeUndefined();
    expect(packageManifest.exports["./endpoints"]).toBe(
      "./src/endpoints/index.ts",
    );
    expect(packageManifest.exports["./endpoints/*"]).toBe(
      "./src/endpoints/*.ts",
    );
  });

  it("keeps shared-package dependencies acyclic", () => {
    const productionFiles = productionTypeScriptFiles(sourceDirectory);
    const knownFiles = new Set(productionFiles);
    const dependencies = new Map(
      productionFiles.map((file) => {
        const imports = [...readSource(file).matchAll(/\bfrom\s+"(\.[^"]+)"/g)]
          .map((match) => resolve(dirname(file), match[1]))
          .map((path) =>
            knownFiles.has(`${path}.ts`)
              ? `${path}.ts`
              : join(path, "index.ts"),
          )
          .filter((path) => knownFiles.has(path));
        return [file, imports] as const;
      }),
    );
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (file: string): void => {
      if (visiting.has(file)) {
        throw new Error(`Cyclic shared-package dependency at ${file}`);
      }
      if (visited.has(file)) {
        return;
      }
      visiting.add(file);
      dependencies.get(file)?.forEach(visit);
      visiting.delete(file);
      visited.add(file);
    };

    expect(() => productionFiles.forEach(visit)).not.toThrow();
  });
});
