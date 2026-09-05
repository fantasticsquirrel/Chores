import { describe, expect, expectTypeOf, it } from "vitest";

import {
  FamilyCoreApiEndpoints as CompatibilityCoreApiEndpoints,
  FamilyRecipeApiEndpoints as CompatibilityRecipeApiEndpoints,
  familyApiRoutes as compatibilityRoutes,
} from "../api-endpoints";
import type { RequestQuery } from "../client-core";
import type { AuthSessionResponse } from "../models/auth";
import type { NotificationSettingUpdate } from "../models/notifications";
import type { CreateRecipeRequest } from "../models/recipes";
import { FamilyCoreApiEndpoints } from "./core";
import { FamilyNotificationApiEndpoints } from "./notifications";
import { FamilyRecipeApiEndpoints } from "./recipes";
import { FamilySupportApiEndpoints, familyApiRoutes } from "./support";

type TransportCall = {
  method: "DELETE" | "GET" | "PATCH" | "POST" | "POST_NO_CONTENT" | "PUT";
  path: string;
  body?: unknown;
  query?: RequestQuery;
};

const session: AuthSessionResponse = {
  user: {
    id: 1,
    household_id: 2,
    email: "parent@example.com",
    role: "PARENT_ADMIN",
    child_id: null,
    is_household_owner: true,
  },
  csrf_token: "csrf-token",
};

class EndpointHarness extends FamilyRecipeApiEndpoints {
  readonly calls: TransportCall[] = [];
  readonly authSessions: AuthSessionResponse[] = [];
  logoutCount = 0;
  response: unknown = { marker: "response" };

  protected get<TResponse>(path: string, query?: RequestQuery): Promise<TResponse> {
    this.calls.push({ method: "GET", path, query });
    return Promise.resolve(this.response as TResponse);
  }

  protected post<TResponse, TBody>(
    path: string,
    body: TBody,
    query?: RequestQuery,
  ): Promise<TResponse> {
    this.calls.push({ method: "POST", path, body, query });
    return Promise.resolve(this.response as TResponse);
  }

  protected put<TResponse, TBody>(
    path: string,
    body: TBody,
  ): Promise<TResponse> {
    this.calls.push({ method: "PUT", path, body });
    return Promise.resolve(this.response as TResponse);
  }

  protected patch<TResponse, TBody>(
    path: string,
    body: TBody,
  ): Promise<TResponse> {
    this.calls.push({ method: "PATCH", path, body });
    return Promise.resolve(this.response as TResponse);
  }

  protected delete(path: string, query?: RequestQuery): Promise<void> {
    this.calls.push({ method: "DELETE", path, query });
    return Promise.resolve();
  }

  protected postNoContent(path: string): Promise<void> {
    this.calls.push({ method: "POST_NO_CONTENT", path });
    return Promise.resolve();
  }

  protected postNoContentWithBody<TBody>(
    path: string,
    body: TBody,
  ): Promise<void> {
    this.calls.push({ method: "POST_NO_CONTENT", path, body });
    return Promise.resolve();
  }

  protected override afterAuthSession(authSession: AuthSessionResponse): void {
    this.authSessions.push(authSession);
  }

  protected override afterLogout(): void {
    this.logoutCount += 1;
  }
}

describe("split endpoint contracts", () => {
  it("keeps legacy class and route exports identical to the new entry points", () => {
    expect(CompatibilityCoreApiEndpoints).toBe(FamilyCoreApiEndpoints);
    expect(CompatibilityRecipeApiEndpoints).toBe(FamilyRecipeApiEndpoints);
    expect(compatibilityRoutes).toBe(familyApiRoutes);
    expectTypeOf<FamilyNotificationApiEndpoints>().toMatchTypeOf<FamilySupportApiEndpoints>();
    expectTypeOf<FamilyCoreApiEndpoints>().toMatchTypeOf<FamilyNotificationApiEndpoints>();
    expectTypeOf<FamilyRecipeApiEndpoints>().toMatchTypeOf<FamilyCoreApiEndpoints>();
  });

  it("preserves support endpoint routes, payloads, and returned responses", async () => {
    const api = new EndpointHarness();
    const response = api.response;
    const transfer = {
      new_owner_user_id: 17,
      current_password: "secret",
      confirmation: "TRANSFER OWNERSHIP" as const,
    };

    await expect(api.getHouseholdOwnership()).resolves.toBe(response);
    await expect(api.transferHouseholdOwnership(transfer)).resolves.toBe(response);
    await expect(api.getBillingStatus()).resolves.toBe(response);

    expect(api.calls).toEqual([
      {
        method: "GET",
        path: "/households/me/ownership",
        query: undefined,
      },
      {
        method: "POST",
        path: "/households/me/ownership/transfer",
        body: transfer,
        query: undefined,
      },
      { method: "GET", path: "/billing", query: undefined },
    ]);
  });

  it("preserves notification transport behavior", async () => {
    const api = new EndpointHarness();
    const settings: NotificationSettingUpdate = { push_enabled: false };

    await api.listNotifications({ unread: 1, limit: 5 });
    await api.markNotificationRead(7);
    await api.markAllNotificationsRead();
    await api.getNotificationSettings();
    await api.updateNotificationSettings("chores", settings);
    await api.getPushConfig();
    await api.createPushSubscription({
      endpoint: "https://push.example/subscription",
      keys: { p256dh: "public-key", auth: "auth-secret" },
    });
    await api.disablePushSubscriptions();

    expect(api.calls).toEqual([
      {
        method: "GET",
        path: "/notifications",
        query: { unread: 1, limit: 5 },
      },
      { method: "POST_NO_CONTENT", path: "/notifications/7/read" },
      {
        method: "POST",
        path: "/notifications/read-all",
        body: {},
        query: undefined,
      },
      {
        method: "GET",
        path: "/notification-settings",
        query: undefined,
      },
      {
        method: "PUT",
        path: "/notification-settings/chores",
        body: settings,
      },
      { method: "GET", path: "/push/config", query: undefined },
      {
        method: "POST",
        path: "/push/subscriptions",
        body: {
          endpoint: "https://push.example/subscription",
          keys: { p256dh: "public-key", auth: "auth-secret" },
        },
        query: undefined,
      },
      { method: "DELETE", path: "/push/subscriptions", query: undefined },
    ]);
  });

  it("preserves core routes, query mapping, and auth lifecycle hooks", async () => {
    const api = new EndpointHarness();
    api.response = session;

    await expect(api.login({ email: "parent@example.com", password: "secret" })).resolves.toBe(
      session,
    );
    await api.logout();
    await api.listHomeschoolDayComments(2, 9);
    await api.completeParentTask(11, "2026-09-05 & later");
    await api.createSubmission(
      { for_date: "2026-09-05", chore_ids: [11] },
      { child_id: 9 },
    );

    expect(api.authSessions).toEqual([session]);
    expect(api.logoutCount).toBe(1);
    expect(api.calls).toEqual([
      {
        method: "POST",
        path: "/auth/login",
        body: { email: "parent@example.com", password: "secret" },
        query: undefined,
      },
      { method: "POST_NO_CONTENT", path: "/auth/logout" },
      {
        method: "GET",
        path: "/homeschool/day-comments",
        query: { household_id: 2, child_id: 9 },
      },
      {
        method: "POST_NO_CONTENT",
        path: "/chores/11/complete?date=2026-09-05%20%26%20later",
      },
      {
        method: "POST",
        path: "/submissions",
        body: { for_date: "2026-09-05", chore_ids: [11] },
        query: { child_id: 9 },
      },
    ]);
  });

  it("preserves recipe routes and query/payload mapping", async () => {
    const api = new EndpointHarness();
    const recipe: CreateRecipeRequest = { title: "Soup" };

    await api.listRecipes({ query: "soup", active_only: true });
    await api.importRecipeBackup([recipe]);
    await api.archiveRecipe(13, true);
    await api.scaleRecipe(13, { targetServings: 6, scaleFactor: 1.5 });

    expect(api.calls).toEqual([
      {
        method: "GET",
        path: "/recipes",
        query: { query: "soup", active_only: true },
      },
      {
        method: "POST",
        path: "/recipes/backup/import",
        body: { recipes: [recipe] },
        query: undefined,
      },
      {
        method: "PATCH",
        path: "/recipes/13/archive",
        body: { archived: true },
      },
      {
        method: "GET",
        path: "/recipes/13/scale",
        query: { target_servings: 6, scale_factor: 1.5 },
      },
    ]);
  });
});
