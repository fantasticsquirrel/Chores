import { afterEach, describe, expect, it, vi } from "vitest";

describe("apiClient fetch binding regression", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("binds global fetch for the shared apiClient instance", async () => {
    const fetchMock = vi.fn(
      function (this: unknown): Promise<Response> {
        if (this !== globalThis) {
          throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
        }

        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      } as typeof fetch,
    );

    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();

    const { apiClient } = await import("./client");
    await expect(apiClient.listChildren({ household_id: 9 })).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/chore-api/children?household_id=9",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      }),
    );
  });
});
