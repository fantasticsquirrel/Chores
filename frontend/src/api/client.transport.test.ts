import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiClientError, CSRF_HEADER_NAME } from "./client";
import type { BinaryDownload } from "@family-manager/family-api/client-core";

// Test-only wrappers: these are mechanics, not advertised feature endpoints.
class TransportClient extends ApiClient {
  upload<T>(body: FormData): Promise<T> {
    return this.postMultipart<T>("/transport-test/upload", body);
  }
  download(): Promise<BinaryDownload> {
    return this.getBinary("/transport-test/download");
  }
}
const baseUrl = "https://family.example.test/chore-api";
const session = {
  csrf_token: "session-csrf",
  user: {
    id: 11,
    household_id: 2,
    email: "parent@example.com",
    role: "PARENT",
    child_id: null,
  },
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function setup() {
  const fetchMock = vi.fn<typeof fetch>();
  const client = new TransportClient({ baseUrl, fetchImpl: fetchMock });
  return { client, fetchMock };
}
function headers(init: RequestInit | undefined) {
  return new Headers(init?.headers);
}

describe("protected multipart and binary transport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs the original FormData with session CSRF and cookies, without a JSON or multipart Content-Type", async () => {
    const { client, fetchMock } = setup();
    fetchMock
      .mockResolvedValueOnce(json(session))
      .mockResolvedValueOnce(json({ accepted: true }, 201));
    await client.login({
      email: "parent@example.com",
      password: "password123",
    });
    const body = new FormData();
    body.append(
      "file",
      new Blob(["image bytes"], { type: "image/png" }),
      "photo.png",
    );
    body.append("metadata", "staging");
    await expect(client.upload<{ accepted: boolean }>(body)).resolves.toEqual({
      accepted: true,
    });
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe(`${baseUrl}/transport-test/upload`);
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(init?.body).toBe(body);
    expect(headers(init).get(CSRF_HEADER_NAME)).toBe("session-csrf");
    expect(headers(init).get("Accept")).toBe("application/json");
    expect(headers(init).has("Content-Type")).toBe(false);
  });

  it("GETs bytes and metadata without CSRF using cookies and no-store, including after login", async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(json(session)).mockResolvedValueOnce(
      new Response(new Uint8Array([0, 255, 80, 75]), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="backup.zip"',
        },
      }),
    );
    await client.login({
      email: "parent@example.com",
      password: "password123",
    });
    const result = await client.download();
    expect(new Uint8Array(result.bytes)).toEqual(
      new Uint8Array([0, 255, 80, 75]),
    );
    expect(result.content_type).toBe("application/zip");
    expect(result.filename).toBe("backup.zip");
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe(`${baseUrl}/transport-test/download`);
    expect(init).toMatchObject({
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    expect(init?.body).toBeUndefined();
    expect(headers(init).get("Accept")).toBe("*/*");
    expect(headers(init).has(CSRF_HEADER_NAME)).toBe(false);
    expect(headers(init).has("Content-Type")).toBe(false);
  });

  it("preserves JSON bytes instead of mistaking successful JSON downloads for envelopes", async () => {
    const { client, fetchMock } = setup();
    const text = '{"portable":true}';
    fetchMock.mockResolvedValueOnce(
      new Response(text, { headers: { "Content-Type": "application/json" } }),
    );
    const result = await client.download();
    expect(new TextDecoder().decode(result.bytes)).toBe(text);
    expect(result).toMatchObject({
      content_type: "application/json",
      filename: null,
    });
  });

  it("does not expose raw JSON decoder contents when an upload returns malformed success JSON", async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(
      new Response('{"private":"/private/media/secret.zip"', {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(client.upload(new FormData())).rejects.toMatchObject({
      name: "ApiClientError",
      status: 201,
      code: null,
      detail: "Invalid server response.",
      data: undefined,
    });
  });

  it("has safe defaults when binary metadata is absent", async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1])));
    expect(await client.download()).toMatchObject({
      content_type: "application/octet-stream",
      filename: null,
    });
  });

  it("decodes extended filenames and rejects server paths", async () => {
    const { client, fetchMock } = setup();
    fetchMock
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1]), {
          headers: {
            "Content-Disposition":
              "attachment; filename*=UTF-8''famille%20%C3%A9.zip",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1]), {
          headers: {
            "Content-Disposition":
              'attachment; filename="/private/media/secret.zip"',
          },
        }),
      );
    expect((await client.download()).filename).toBe("famille é.zip");
    expect((await client.download()).filename).toBeNull();
  });

  it.each(["upload", "download", "json"] as const)(
    "preserves structured 401/403/409 errors for %s without English branching",
    async (transport) => {
      for (const [status, code] of [
        [401, "session_revoked"],
        [403, "module_denied"],
        [409, "revision_conflict"],
      ] as const) {
        const { client, fetchMock } = setup();
        const data = {
          detail: {
            code,
            message: "Action indisponible.",
            field_errors: { input: ["Review"] },
          },
        };
        fetchMock.mockResolvedValueOnce(json(data, status));
        const operation =
          transport === "upload"
            ? client.upload(new FormData())
            : transport === "download"
              ? client.download()
              : client.listChildren({ household_id: 2 });
        await expect(operation).rejects.toBeInstanceOf(ApiClientError);
        await expect(operation).rejects.toMatchObject({
          status,
          code,
          detail: "Action indisponible.",
          message: "Action indisponible.",
          data,
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
      }
    },
  );

  it.each(["upload", "download"] as const)(
    "keeps legacy string and validation-array errors for %s",
    async (transport) => {
      for (const [detail, expected] of [
        ["Not allowed", "Not allowed"],
        [[{ loc: ["body", "file"], msg: "Required" }], "body.file: Required"],
      ] as const) {
        const { client, fetchMock } = setup();
        fetchMock.mockResolvedValueOnce(json({ detail }, 422));
        const operation =
          transport === "upload"
            ? client.upload(new FormData())
            : client.download();
        await expect(operation).rejects.toMatchObject({
          status: 422,
          code: null,
          detail: expected,
        });
      }
    },
  );

  it.each([
    ["text/html", "<pre>/private/media/secret.zip</pre>"],
    ["application/json", '{"private": "/private/media/secret.zip"'],
  ])(
    "does not expose raw %s error bodies or JSON decoder errors",
    async (contentType, body) => {
      const { client, fetchMock } = setup();
      fetchMock.mockResolvedValueOnce(
        new Response(body, {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "Content-Type": contentType },
        }),
      );
      await expect(client.download()).rejects.toMatchObject({
        name: "ApiClientError",
        status: 500,
        detail: "Internal Server Error",
        code: null,
        data: undefined,
      });
    },
  );
});

describe("browser multipart session source", () => {
  afterEach(() => {
    document.cookie = "chore_tracker_csrf=; Max-Age=0; path=/";
  });
  it("uses the browser CSRF cookie without a login DTO or custom auth storage", async () => {
    document.cookie = "chore_tracker_csrf=cookie%20csrf; path=/";
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(json({ accepted: true }));
    await client.upload(new FormData());
    expect(headers(fetchMock.mock.calls[0]![1]).get(CSRF_HEADER_NAME)).toBe(
      "cookie csrf",
    );
  });
});
