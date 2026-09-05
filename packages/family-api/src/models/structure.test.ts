import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const modelsDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = dirname(modelsDirectory);
const domainFiles = readdirSync(modelsDirectory)
  .filter(
    (file) =>
      file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "index.ts",
  )
  .sort();

const expectedPublicModels = [
  "ApiErrorResponse",
  "AssignmentMode",
  "AuthSessionResponse",
  "AuthUser",
  "BillingActionRequest",
  "BillingActionResponse",
  "BillingAvailableAction",
  "BillingStatus",
  "BillingStatusResponse",
  "ChangePasswordRequest",
  "Child",
  "ChildAccount",
  "ChildBalance",
  "ChildLoginRequest",
  "Chore",
  "ChoreTransaction",
  "ChoreTransactionType",
  "CompletionMode",
  "CreateChildAccountRequest",
  "CreateChildRequest",
  "CreateChoreRequest",
  "CreateChoreTransactionRequest",
  "CreateHomeschoolSemesterRequest",
  "CreateHomeschoolSubjectRequest",
  "CreateParentUserRequest",
  "CreateRecipeCategoryRequest",
  "CreateRecipeRequest",
  "CreateRecipeTagRequest",
  "DuplicateRecipeRequest",
  "EligibleChore",
  "FamilyModule",
  "HealthResponse",
  "HomeschoolAttendance",
  "HomeschoolDayComment",
  "HomeschoolGrade",
  "HomeschoolSemester",
  "HomeschoolSubject",
  "HouseholdModuleAccess",
  "HouseholdOwnershipResponse",
  "ImportRecipeBackupResponse",
  "ListChildrenParams",
  "ListChoresParams",
  "ListEligibleChoresParams",
  "ListRecipesParams",
  "ListSubmissionsParams",
  "LoginRequest",
  "MyModulesResponse",
  "NotificationItem",
  "NotificationListResponse",
  "NotificationSettingResponse",
  "NotificationSettingUpdate",
  "NotificationSettings",
  "NotificationSettingsByModule",
  "PasswordResetConfirmRequest",
  "PasswordResetConfirmResponse",
  "PasswordResetRequest",
  "PasswordResetRequestResponse",
  "PushConfigResponse",
  "PushSubscriptionCreate",
  "PushSubscriptionResponse",
  "ReadinessResponse",
  "RecipeBackup",
  "RecipeCategory",
  "RecipeComponent",
  "RecipeComponentRequest",
  "RecipeDetail",
  "RecipeFeedback",
  "RecipeFeedbackReviewerType",
  "RecipeFeedbackSummary",
  "RecipeIngredient",
  "RecipeIngredientRequest",
  "RecipeScaleResponse",
  "RecipeStep",
  "RecipeStepRequest",
  "RecipeSummary",
  "RecipeTag",
  "RegistrationRequest",
  "RegistrationVerifyRequest",
  "ResetChildAccountEmailRequest",
  "ResetChildAccountPasswordRequest",
  "ScheduleMode",
  "ScheduleUnit",
  "SetHouseholdModuleAccessRequest",
  "SetUserModuleAccessRequest",
  "SubmissionItemDecisionRequest",
  "SubmissionItemResponse",
  "SubmissionRequest",
  "SubmissionResponse",
  "SubmissionReview",
  "SubmissionReviewItem",
  "TransferHouseholdOwnershipRequest",
  "UpdateChildRequest",
  "UpdateChoreRequest",
  "UpdateHomeschoolSemesterRequest",
  "UpdateHomeschoolSubjectRequest",
  "UpdateRecipeCategoryRequest",
  "UpdateRecipeRequest",
  "UpdateRecipeTagRequest",
  "UpsertHomeschoolAttendanceRequest",
  "UpsertHomeschoolDayCommentRequest",
  "UpsertHomeschoolGradeRequest",
  "UpsertRecipeFeedbackRequest",
  "UserModuleAccess",
  "UserRole",
];

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("domain model structure", () => {
  it("declares every compatibility export exactly once without any", () => {
    const declarations = domainFiles.flatMap((file) => {
      const source = readSource(join(modelsDirectory, file));
      expect(source).not.toMatch(/\bany\b/);
      return [...source.matchAll(/^export (?:interface|type) (\w+)/gm)].map(
        (match) => match[1],
      );
    });

    expect(declarations.sort()).toEqual(expectedPublicModels);
    expect(new Set(declarations).size).toBe(declarations.length);
  });

  it("re-exports every domain through the new and compatibility barrels", () => {
    const domainBarrel = readSource(join(modelsDirectory, "index.ts"));
    const reexportedDomains = [...domainBarrel.matchAll(/from "\.\/(\w+)"/g)]
      .map((match) => `${match[1]}.ts`)
      .sort();

    expect(reexportedDomains).toEqual(domainFiles);
    expect(readSource(join(sourceDirectory, "models.ts"))).toContain(
      'export type * from "./models/index";',
    );

    const packageManifest = JSON.parse(
      readSource(join(sourceDirectory, "../package.json")),
    ) as { exports: Record<string, string> };
    expect(packageManifest.exports["./models"]).toBe("./src/models.ts");
    expect(packageManifest.exports["./models/*"]).toBe("./src/models/*.ts");
  });

  it("keeps shared-package source dependencies acyclic", () => {
    const productionFiles = [
      ...readdirSync(sourceDirectory)
        .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
        .map((file) => join(sourceDirectory, file)),
      ...domainFiles.map((file) => join(modelsDirectory, file)),
      join(modelsDirectory, "index.ts"),
    ];
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
