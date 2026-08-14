import { describe, expect, it, vi } from "vitest";

import { ApiClient } from "./client";

describe("password reset API client contract", () => {
  it("posts reset request and opaque-token confirmation without putting the token in a URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            detail: "If an eligible account exists for that address, reset instructions will arrive shortly.",
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ detail: "Try signing in. If you cannot sign in, request a new reset link." }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        ),
      );
    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    const token = "v1.reset-row-id.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO";

    await expect(client.requestPasswordReset({ email: "parent@example.com" })).resolves.toMatchObject({
      detail: expect.stringContaining("eligible account"),
    });
    await expect(
      client.confirmPasswordReset({ token, new_password: "a sufficiently long parent password" }),
    ).resolves.toEqual({ detail: "Try signing in. If you cannot sign in, request a new reset link." });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/chore-api/auth/password-reset/request",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "parent@example.com" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/chore-api/auth/password-reset/confirm",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ token, new_password: "a sufficiently long parent password" }),
      }),
    );
    const requestUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestUrls.join("\n")).not.toContain(token);
  });
});
