import { describe, expect, expectTypeOf, it } from "vitest";

import type { RequestQuery } from "./client-core";
import { FamilyCoreApiEndpoints, familyApiRoutes } from "./endpoints/index";
import type {
  PasswordResetConfirmRequest,
  PasswordResetConfirmResponse,
  PasswordResetRequest,
  PasswordResetRequestResponse,
} from "./models/index";

class PasswordResetHarness extends FamilyCoreApiEndpoints {
  readonly postCalls: Array<{ path: string; body: unknown }> = [];

  protected get<TResponse>(
    _path: string,
    _query?: RequestQuery,
  ): Promise<TResponse> {
    return Promise.reject(new Error("not implemented"));
  }

  protected post<TResponse, TBody>(
    path: string,
    body: TBody,
    _query?: RequestQuery,
  ): Promise<TResponse> {
    this.postCalls.push({ path, body });
    return Promise.resolve({ detail: "accepted" } as TResponse);
  }

  protected put<TResponse, TBody>(
    _path: string,
    _body: TBody,
  ): Promise<TResponse> {
    return Promise.reject(new Error("not implemented"));
  }

  protected patch<TResponse, TBody>(
    _path: string,
    _body: TBody,
  ): Promise<TResponse> {
    return Promise.reject(new Error("not implemented"));
  }

  protected delete(_path: string, _query?: RequestQuery): Promise<void> {
    return Promise.reject(new Error("not implemented"));
  }

  protected postNoContent(_path: string): Promise<void> {
    return Promise.reject(new Error("not implemented"));
  }

  protected postNoContentWithBody<TBody>(
    _path: string,
    _body: TBody,
  ): Promise<void> {
    return Promise.reject(new Error("not implemented"));
  }
}

describe("password reset shared API contract", () => {
  it("keeps the public reset routes under the deployed chore API prefix", () => {
    expect(`/chore-api${familyApiRoutes.passwordResetRequest}`).toBe(
      "/chore-api/auth/password-reset/request",
    );
    expect(`/chore-api${familyApiRoutes.passwordResetConfirm}`).toBe(
      "/chore-api/auth/password-reset/confirm",
    );
  });

  it("uses one opaque token, never a client-controlled reset row identifier", () => {
    expectTypeOf<PasswordResetRequest>().toEqualTypeOf<{ email: string }>();
    expectTypeOf<PasswordResetRequestResponse>().toEqualTypeOf<{
      detail: string;
    }>();
    expectTypeOf<PasswordResetConfirmRequest>().toEqualTypeOf<{
      token: string;
      new_password: string;
    }>();
    expectTypeOf<PasswordResetConfirmResponse>().toEqualTypeOf<{
      detail: string;
    }>();
  });

  it("uses the shared POST transport for reset request and confirmation", async () => {
    const api = new PasswordResetHarness();
    const requestPayload: PasswordResetRequest = {
      email: "parent@example.com",
    };
    const confirmPayload: PasswordResetConfirmRequest = {
      token:
        "v1.random-row-id.a-valid-looking-opaque-proof-value-which-is-long",
      new_password: "a sufficiently long parent password",
    };

    await expect(api.requestPasswordReset(requestPayload)).resolves.toEqual({
      detail: "accepted",
    });
    await expect(api.confirmPasswordReset(confirmPayload)).resolves.toEqual({
      detail: "accepted",
    });
    expect(api.postCalls).toEqual([
      { path: "/auth/password-reset/request", body: requestPayload },
      { path: "/auth/password-reset/confirm", body: confirmPayload },
    ]);
  });
});
