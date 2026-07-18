import { describe, expectTypeOf, it } from "vitest";

import type {
  AuthSessionResponse,
  BillingStatusResponse,
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
      user: { id: number; household_id: number; email: string; role: UserRole; is_household_owner: boolean };
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

  it("exposes provider-neutral household ownership and billing contracts", () => {
    expectTypeOf<BillingStatusResponse["status"]>().toEqualTypeOf<
      | "none"
      | "trialing"
      | "active"
      | "grace_period"
      | "billing_retry"
      | "canceled_active"
      | "expired"
      | "refunded"
      | "revoked"
      | "complimentary"
    >();
    expectTypeOf<BillingStatusResponse>().toMatchTypeOf<{
      provider: string | null;
      expires_at: string | null;
      available_actions: Array<{ key: string; label: string }>;
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
