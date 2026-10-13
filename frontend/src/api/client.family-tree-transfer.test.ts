// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, CSRF_HEADER_NAME } from "./client";
const baseUrl = "https://family.example.test/chore-api";
const job = {
  id: 7,
  kind: "import",
  state: "canceled",
  expected_graph_revision: 3,
  expires_at: "2026-10-14T00:00:00Z",
  summary: {},
};
describe("browser staging cancellation and real File multipart", () => {
  afterEach(() => {
    document.cookie = "chore_tracker_csrf=; Max-Age=0; path=/";
  });
  it("returns cancellation JSON without any revision/body/query, preserving cookie CSRF and signal", async () => {
    document.cookie = "chore_tracker_csrf=cookie%20csrf; path=/";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(job), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = new ApiClient({ baseUrl, fetchImpl: fetchMock });
    const controller = new AbortController();
    await expect(
      client.cancelFamilyTreeImport(7, { signal: controller.signal }),
    ).resolves.toEqual(job);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${baseUrl}/family-tree/imports/7`);
    expect(init).toMatchObject({
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get(CSRF_HEADER_NAME)).toBe(
      "cookie csrf",
    );
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
  });
  it("passes original selected File/caption through FormData without serialization or changing auth", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('{"id":7}', {
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = new ApiClient({ baseUrl, fetchImpl: fetchMock });
    const file = new File(["selected bytes"], "original.png", {
      type: "image/png",
    });
    const form = new FormData();
    form.append("file", file);
    form.append("caption", "Original caption");
    const controller = new AbortController();
    await client.uploadFamilyTreeMedia(form, { signal: controller.signal });
    expect(fetchMock.mock.calls[0]![1]?.body).toBe(form);
    expect(form.get("file")).toBe(file);
    expect(form.get("caption")).toBe("Original caption");
    expect(
      new Headers(fetchMock.mock.calls[0]![1]?.headers).has("Content-Type"),
    ).toBe(false);
  });
  it.each([200, 204])(
    "rejects missing/non-JSON staging cancellation success %s without exposing raw content",
    async (status) => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(
            status === 204 ? null : "<html>/private/staging/key</html>",
            { status, headers: { "Content-Type": "text/html" } },
          ),
        );
      const client = new ApiClient({ baseUrl, fetchImpl: fetchMock });
      await expect(client.cancelFamilyTreeImport(7)).rejects.toMatchObject({
        detail: "Invalid server response.",
        data: undefined,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
});
