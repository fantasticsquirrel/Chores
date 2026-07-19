import { describe, expect, expectTypeOf, it } from "vitest";

import type { RequestQuery } from "./client-core";
import type { OpsBillingDetail, OpsHouseholdDetail, OpsSessionResponse } from "./ops-models";
import { OpsApiEndpoints, opsApiRoutes } from "./ops-endpoints";

class OpsHarness extends OpsApiEndpoints {
  calls: Array<{ method: string; path: string; body?: unknown; query?: RequestQuery }> = [];

  protected get<T>(path: string, query?: RequestQuery): Promise<T> {
    this.calls.push({ method: "GET", path, query });
    return Promise.resolve({} as T);
  }
  protected post<T, B>(path: string, body: B): Promise<T> {
    this.calls.push({ method: "POST", path, body });
    return Promise.resolve({} as T);
  }
  protected postNoContent(path: string): Promise<void> {
    this.calls.push({ method: "POST", path });
    return Promise.resolve();
  }
}

describe("ops API contracts", () => {
  it("centralizes ops routes independently from household API paths", () => {
    expect(opsApiRoutes.auth.me).toBe("/auth/me");
    expect(opsApiRoutes.households()).toBe("/households");
    expect(opsApiRoutes.householdBilling(42)).toBe("/households/42/billing");
    expect(opsApiRoutes.supportCases()).toBe("/support/cases");
    expect(opsApiRoutes.supportCaseNotes(7)).toBe("/support/cases/7/notes");
  });

  it("keeps ops identity separate from household roles", () => {
    expectTypeOf<OpsSessionResponse>().toMatchTypeOf<{
      user: { id: number; email: string; role: "PLATFORM_OWNER" | "PLATFORM_SUPPORT" };
      csrf_token?: string | null;
    }>();
    expectTypeOf<OpsHouseholdDetail>().toMatchTypeOf<{
      id: number;
      billing: { available_actions: Array<{ key: string; label: string }> };
    }>();
  });

  it("keeps the billing endpoint contract distinct from household detail", () => {
    expectTypeOf<ReturnType<OpsHarness["getHouseholdBilling"]>>().toEqualTypeOf<Promise<OpsBillingDetail>>();
  });

  it("maps auth, lookup, audit, support, reconcile, and complimentary methods", async () => {
    const api = new OpsHarness();
    await api.getCurrentOpsSession();
    await api.searchHouseholds("smith");
    await api.getHousehold(42);
    await api.listHouseholdEvents(42);
    await api.listAuditEntries(42);
    await api.createSupportCase(42, { reason: "Customer requested help" });
    await api.appendSupportNote(7, { body: "Verified identity" });
    await api.reconcileHousehold(42, { case_id: 7, reason: "Entitlement drift" });
    await api.grantComplimentary(42, {
      expires_at: "2027-01-01T00:00:00Z",
      reason: "Service recovery",
      idempotency_key: "grant-42-a",
    });

    expect(api.calls).toEqual([
      { method: "GET", path: "/auth/me", query: undefined },
      { method: "GET", path: "/households", query: { query: "smith" } },
      { method: "GET", path: "/households/42", query: undefined },
      { method: "GET", path: "/households/42/events", query: undefined },
      { method: "GET", path: "/households/42/audit", query: undefined },
      { method: "POST", path: "/support/cases", body: { household_id: 42, reason: "Customer requested help" } },
      { method: "POST", path: "/support/cases/7/notes", body: { body: "Verified identity" } },
      { method: "POST", path: "/households/42/reconcile", body: { case_id: 7, reason: "Entitlement drift" } },
      { method: "POST", path: "/households/42/complimentary", body: { expires_at: "2027-01-01T00:00:00Z", reason: "Service recovery", idempotency_key: "grant-42-a" } },
    ]);
  });
});
