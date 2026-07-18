import { describe, expect, expectTypeOf, it } from "vitest";

import type { RequestQuery } from "./client-core";
import type {
  AuthSessionResponse,
  BillingStatusResponse,
  Chore,
  CreateChildRequest,
  CreateRecipeRequest,
  HomeschoolSemester,
  ListChoresParams,
  RecipeDetail,
  RecipeSummary,
} from "./models";
import {
  FamilyCoreApiEndpoints,
  FamilyRecipeApiEndpoints,
  familyApiRoutes,
} from "./api-endpoints";

class CoreHarness extends FamilyCoreApiEndpoints {
  protected get<TResponse>(_path: string, _query?: RequestQuery): Promise<TResponse> {
    throw new Error("not implemented");
  }
  protected post<TResponse, TBody>(
    _path: string,
    _body: TBody,
    _query?: RequestQuery,
  ): Promise<TResponse> {
    throw new Error("not implemented");
  }
  protected put<TResponse, TBody>(_path: string, _body: TBody): Promise<TResponse> {
    throw new Error("not implemented");
  }
  protected patch<TResponse, TBody>(_path: string, _body: TBody): Promise<TResponse> {
    throw new Error("not implemented");
  }
  protected delete(_path: string, _query?: RequestQuery): Promise<void> {
    throw new Error("not implemented");
  }
  protected postNoContent(_path: string): Promise<void> {
    throw new Error("not implemented");
  }
  protected postNoContentWithBody<TBody>(_path: string, _body: TBody): Promise<void> {
    throw new Error("not implemented");
  }
}

class RecipeHarness extends FamilyRecipeApiEndpoints {
  protected get<TResponse>(_path: string, _query?: RequestQuery): Promise<TResponse> {
    throw new Error("not implemented");
  }
  protected post<TResponse, TBody>(
    _path: string,
    _body: TBody,
    _query?: RequestQuery,
  ): Promise<TResponse> {
    throw new Error("not implemented");
  }
  protected put<TResponse, TBody>(_path: string, _body: TBody): Promise<TResponse> {
    throw new Error("not implemented");
  }
  protected patch<TResponse, TBody>(_path: string, _body: TBody): Promise<TResponse> {
    throw new Error("not implemented");
  }
  protected delete(_path: string, _query?: RequestQuery): Promise<void> {
    throw new Error("not implemented");
  }
  protected postNoContent(_path: string): Promise<void> {
    throw new Error("not implemented");
  }
  protected postNoContentWithBody<TBody>(_path: string, _body: TBody): Promise<void> {
    throw new Error("not implemented");
  }
}

describe("shared API endpoint method contracts", () => {
  it("centralizes the deployed household ownership and billing routes", () => {
    expect(familyApiRoutes.householdOwnership).toBe("/households/me/ownership");
    expect(familyApiRoutes.billing).toBe("/billing");
  });

  it("exposes common auth, module, child, chore, workflow, and homeschool methods", () => {
    expectTypeOf<CoreHarness["login"]>().parameter(0).toMatchTypeOf<{ email: string; password: string }>();
    expectTypeOf<CoreHarness["login"]>().returns.resolves.toEqualTypeOf<AuthSessionResponse>();
    expectTypeOf<CoreHarness["createChild"]>().parameter(0).toEqualTypeOf<CreateChildRequest>();
    expectTypeOf<CoreHarness["listChores"]>().parameter(0).toEqualTypeOf<ListChoresParams>();
    expectTypeOf<CoreHarness["listChores"]>().returns.resolves.toEqualTypeOf<Chore[]>();
    expectTypeOf<CoreHarness["listHomeschoolSemesters"]>().returns.resolves.toEqualTypeOf<HomeschoolSemester[]>();
    expectTypeOf<CoreHarness["getBillingStatus"]>().returns.resolves.toEqualTypeOf<BillingStatusResponse>();
  });

  it("keeps recipe methods in the web-only endpoint base", () => {
    expectTypeOf<RecipeHarness["listRecipes"]>().returns.resolves.toEqualTypeOf<RecipeSummary[]>();
    expectTypeOf<RecipeHarness["createRecipe"]>().parameter(0).toEqualTypeOf<CreateRecipeRequest>();
    expectTypeOf<RecipeHarness["createRecipe"]>().returns.resolves.toEqualTypeOf<RecipeDetail>();
  });
});
