import { describe, expectTypeOf, it } from "vitest";

import type {
  AuthSessionResponse,
  Chore,
  CreateRecipeRequest,
  FamilyModule,
  HomeschoolAttendance,
  ListRecipesParams,
  RecipeDetail,
  SetUserModuleAccessRequest,
  UserRole,
} from "./models";

describe("shared API models", () => {
  it("exposes common auth and module contracts without loosening literal types", () => {
    expectTypeOf<UserRole>().toEqualTypeOf<"PARENT_ADMIN" | "PARENT" | "CHILD">();
    expectTypeOf<AuthSessionResponse>().toMatchTypeOf<{
      user: { id: number; household_id: number; email: string; role: UserRole };
      csrf_token?: string | null;
    }>();
    expectTypeOf<FamilyModule>().toMatchTypeOf<{
      key: "chores" | "homeschool" | "recipes" | "admin";
      name: string;
      description: string;
    }>();
    expectTypeOf<SetUserModuleAccessRequest>().toMatchTypeOf<{
      module_key: "chores" | "homeschool" | "recipes" | "admin";
      can_view: boolean;
      can_manage?: boolean;
    }>();
  });

  it("exposes common chore and homeschool payloads shared by web and mobile", () => {
    expectTypeOf<Chore>().toMatchTypeOf<{
      id: number;
      household_id: number;
      schedule_mode: "NONE" | "EVERY" | "AFTER_COMPLETION" | "ONCE";
      allowed_child_ids: number[];
      rotation_order: number[];
    }>();
    expectTypeOf<HomeschoolAttendance>().toMatchTypeOf<{
      child_id: number;
      subject_id: number;
      date: string;
      present: boolean;
      comment: string;
    }>();
  });

  it("keeps recipe contracts available for the web-only recipes module", () => {
    expectTypeOf<CreateRecipeRequest>().toMatchTypeOf<{
      title: string;
      ingredients?: Array<{ position: number; item: string }>;
      steps?: Array<{ position: number; instruction: string }>;
    }>();
    expectTypeOf<ListRecipesParams>().toMatchTypeOf<{
      query?: string;
      active_only?: boolean;
    }>();
    expectTypeOf<RecipeDetail>().toMatchTypeOf<{
      ingredients: unknown[];
      steps: unknown[];
      feedback: unknown[];
    }>();
  });
});
