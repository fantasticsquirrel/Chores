import { afterEach, describe, expect, it, vi } from "vitest";

describe("OpsApiClient CSRF session compatibility", () => {
  it("preserves HTTP conflict status so owner intent cannot be replayed against stale state", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: "State changed" }), {
            status: 409,
          }),
        ),
    );
    const { opsApi } = await import("./client");
    await expect(
      opsApi.setGlobalModule("chores", {
        enabled: false,
        expected_enabled: true,
        reason: "Maintenance",
      }),
    ).rejects.toMatchObject({ status: 409, message: "State changed" });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("uses the csrf_token returned by auth/me after a page reload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              id: 1,
              email: "owner@example.com",
              role: "PLATFORM_OWNER",
              mfa_required: true,
              mfa_verified: true,
            },
            csrf_token: "reload-csrf",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { opsApi } = await import("./client");

    await opsApi.getCurrentOpsSession();
    await opsApi.logout();

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/ops-api/auth/logout",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Ops-CSRF-Token": "reload-csrf" }),
      }),
    );
  });
});
