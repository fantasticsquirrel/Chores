import { describe, expect, expectTypeOf, it } from "vitest";
import type { RequestQuery } from "./client-core";
import { OpsApiEndpoints } from "./ops-endpoints";
import type {
  OwnerAccountPage,
  OwnerOverview,
  GlobalModule,
  HouseholdModule,
} from "./ops-models";

class OwnerHarness extends OpsApiEndpoints {
  calls: unknown[] = [];
  protected get<T>(path: string, query?: RequestQuery): Promise<T> {
    this.calls.push({ method: "GET", path, query });
    return Promise.resolve({} as T);
  }
  protected post<T, B>(path: string, body: B): Promise<T> {
    this.calls.push({ method: "POST", path, body });
    return Promise.resolve({} as T);
  }
  protected postNoContent(): Promise<void> {
    return Promise.resolve();
  }
}

describe("frozen owner operations contract", () => {
  it("maps reads, member search pagination, and CAS mutations without credentials in payloads", async () => {
    const api = new OwnerHarness();
    const change = {
      enabled: false,
      expected_enabled: true,
      reason: "Service maintenance",
    };
    await api.getOwnerOverview();
    await api.listOwnerHouseholds();
    await api.listOwnerHouseholds({
      query: "parent@example.com",
      offset: 25,
      limit: 25,
    });
    await api.listGlobalModules();
    await api.setGlobalModule("meal/plan", change);
    await api.listOwnerHouseholdModules(42);
    await api.setOwnerHouseholdModule(42, "meal/plan", change);
    await api.listOwnerHouseholdAccounts(42, { offset: 25, limit: 25 });
    expect(api.calls).toEqual([
      { method: "GET", path: "/owner/overview", query: undefined },
      {
        method: "GET",
        path: "/owner/households",
        query: { query: "", offset: 0, limit: 25 },
      },
      {
        method: "GET",
        path: "/owner/households",
        query: { query: "parent@example.com", offset: 25, limit: 25 },
      },
      { method: "GET", path: "/owner/modules", query: undefined },
      { method: "POST", path: "/owner/modules/meal%2Fplan", body: change },
      { method: "GET", path: "/owner/households/42/modules", query: undefined },
      {
        method: "POST",
        path: "/owner/households/42/modules/meal%2Fplan",
        body: change,
      },
      {
        method: "GET",
        path: "/owner/households/42/accounts",
        query: { offset: 25, limit: 25 },
      },
    ]);
  });
  it("exposes typed safe owner reads distinct from support lookup", () => {
    expectTypeOf<ReturnType<OwnerHarness["getOwnerOverview"]>>().toEqualTypeOf<
      Promise<OwnerOverview>
    >();
    expectTypeOf<ReturnType<OwnerHarness["listGlobalModules"]>>().toEqualTypeOf<
      Promise<GlobalModule[]>
    >();
    expectTypeOf<
      ReturnType<OwnerHarness["listOwnerHouseholdModules"]>
    >().toEqualTypeOf<Promise<HouseholdModule[]>>();
    expectTypeOf<
      ReturnType<OwnerHarness["listOwnerHouseholdAccounts"]>
    >().toEqualTypeOf<Promise<OwnerAccountPage>>();
  });
});
