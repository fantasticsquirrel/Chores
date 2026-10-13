import { describe, expect, it, vi } from "vitest";
import { ApiClient as WebClient } from "../../../../frontend/src/api/client";
import { ApiClient as NativeClient } from "../../../../mobile/src/api/client";

for (const [platform, Client] of [
  ["web", WebClient],
  ["native", NativeClient],
] as const) {
  describe(`${platform} authoritative module discovery cancellation`, () => {
    it("forwards per-call options without moving the signal into the query", async () => {
      const controller = new AbortController();
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ modules: [] }), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      const client = new Client({
        baseUrl: "https://example.test/chore-api",
        fetchImpl: fetchMock,
      });
      await client.getMyModules({ signal: controller.signal });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(String(url)).toBe("https://example.test/chore-api/modules/me");
      expect(init?.signal).toBe(controller.signal);
      expect(init?.credentials).toBe("include");
      expect(init?.body).toBeUndefined();
    });

    it("aborts the underlying discovery fetch without an automatic retry", async () => {
      const controller = new AbortController();
      const fetchMock = vi.fn<typeof fetch>().mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }),
      );
      const client = new Client({ fetchImpl: fetchMock });
      const pending = client.getMyModules({ signal: controller.signal });
      expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
      const rejected = expect(pending).rejects.toMatchObject({
        name: "AbortError",
      });
      controller.abort();
      await rejected;
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
}
