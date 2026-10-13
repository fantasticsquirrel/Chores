import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { ApiClient, CSRF_HEADER_NAME } from "./client";

// Execute the installed React Native implementation, not a browser substitute.
const require = createRequire(new URL("../../package.json", import.meta.url));
const babel = require("@babel/core") as {
  transformSync(source: string, options: object): { code: string };
};
const rn = require.resolve("react-native/Libraries/Network/FormData.js");
const module = {
  exports: {} as {
    default: new () => {
      append(
        key: string,
        value: string | { uri: string; name: string; type: string },
      ): void;
      getParts(): unknown[];
    };
  },
};
const transformed = babel.transformSync(readFileSync(rn, "utf8"), {
  babelrc: false,
  configFile: false,
  plugins: [
    require.resolve("@babel/plugin-transform-flow-strip-types"),
    require.resolve("@babel/plugin-transform-modules-commonjs"),
  ],
});
runInNewContext(transformed.code, { module, exports: module.exports });
const ActualRNFormData = module.exports.default;
const baseUrl = "https://family.example.test/chore-api";
function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });
}
describe("native FT3 URI multipart and no-body response DELETE", () => {
  it("passes the real RN FormData/URI/name/type/caption/revision parts and signals unchanged", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ csrf_token: "session-csrf" }))
      .mockImplementation(() => Promise.resolve(json({ id: 7 })));
    const client = new ApiClient({ baseUrl, fetchImpl: fetchMock });
    await client.login({
      email: "parent@example.test",
      password: "test-password",
    });
    const generation = client.authenticationGeneration;
    const controller = new AbortController();
    const media = new ActualRNFormData();
    media.append("file", {
      uri: "file:///selected/photo.png",
      name: "photo.png",
      type: "image/png",
    });
    media.append("caption", "Original caption");
    const imp = new ActualRNFormData();
    imp.append("file", {
      uri: "content://selected/tree.zip",
      name: "tree.zip",
      type: "application/zip",
    });
    imp.append("expected_graph_revision", "3");
    await client.uploadFamilyTreeMedia(media as unknown as FormData, {
      signal: controller.signal,
    });
    await client.stageFamilyTreeImport(imp as unknown as FormData, {
      signal: controller.signal,
    });
    expect(media.getParts()).toEqual([
      expect.objectContaining({
        uri: "file:///selected/photo.png",
        name: "photo.png",
        type: "image/png",
        fieldName: "file",
      }),
      expect.objectContaining({
        string: "Original caption",
        fieldName: "caption",
      }),
    ]);
    expect(imp.getParts()).toEqual([
      expect.objectContaining({
        uri: "content://selected/tree.zip",
        name: "tree.zip",
        type: "application/zip",
        fieldName: "file",
      }),
      expect.objectContaining({
        string: "3",
        fieldName: "expected_graph_revision",
      }),
    ]);
    for (const [index, body] of [
      [1, media],
      [2, imp],
    ] as const) {
      const init = fetchMock.mock.calls[index]![1];
      expect(init?.body).toBe(body);
      expect(init?.signal).toBe(controller.signal);
      expect(init).toMatchObject({ credentials: "include", cache: "no-store" });
      expect(new Headers(init?.headers).get(CSRF_HEADER_NAME)).toBe(
        "session-csrf",
      );
      expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
    }
    expect(client.authenticationGeneration).toBe(generation);
  });
  it("returns staging cancellation JSON, clears its CSRF after auth reset, and never changes auth generation", async () => {
    const job = {
      id: 7,
      kind: "import",
      state: "canceled",
      expected_graph_revision: 3,
      expires_at: "2026-10-14T00:00:00Z",
      summary: {},
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ csrf_token: "session-csrf" }))
      .mockImplementation(() => Promise.resolve(json(job)));
    const client = new ApiClient({ baseUrl, fetchImpl: fetchMock });
    await client.login({
      email: "parent@example.test",
      password: "test-password",
    });
    const generation = client.authenticationGeneration;
    await expect(client.cancelFamilyTreeImport(7)).resolves.toEqual(job);
    expect(client.authenticationGeneration).toBe(generation);
    expect(
      new Headers(fetchMock.mock.calls[1]![1]?.headers).get(CSRF_HEADER_NAME),
    ).toBe("session-csrf");
    client.clearAuthentication();
    await client.cancelFamilyTreeImport(7);
    expect(
      new Headers(fetchMock.mock.calls[2]![1]?.headers).has(CSRF_HEADER_NAME),
    ).toBe(false);
    expect(fetchMock.mock.calls[2]![1]?.body).toBeUndefined();
    expect(fetchMock.mock.calls[2]![0]).toBe(
      `${baseUrl}/family-tree/imports/7`,
    );
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
