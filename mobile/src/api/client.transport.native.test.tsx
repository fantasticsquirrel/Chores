import { describe, expect, it, jest } from "@jest/globals";
import { ApiClient, CSRF_HEADER_NAME } from "./client";

class TransportClient extends ApiClient {
  upload<T>(body: FormData): Promise<T> {
    return this.postMultipart<T>("/transport-test/upload", body);
  }
}

type NativeFile = { uri: string; name: string; type: string };
type NativeForm = {
  append(name: string, value: string | NativeFile): void;
  getParts(): Array<
    NativeFile & { fieldName: string; headers: Record<string, string> }
  >;
};

// Execute the installed RN implementation through jest-expo's Flow transform.
// Only fetch is mocked; URI/name/MIME handling is not a mirrored polyfill.
const NativeFormData = jest.requireActual<{ default: new () => NativeForm }>(
  "react-native/Libraries/Network/FormData",
).default;

describe("native FormData transport", () => {
  it("passes RN file parts directly to fetch with session cookies/CSRF and no Content-Type override", async () => {
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          csrf_token: "native-csrf",
          user: {
            id: 11,
            household_id: 2,
            email: "parent@example.com",
            role: "PARENT",
            child_id: null,
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ accepted: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new TransportClient({
      baseUrl: "https://family.example.test/chore-api",
      fetchImpl: fetchMock,
    });
    await client.login({
      email: "parent@example.com",
      password: "password123",
    });
    const body = new NativeFormData();
    const file = {
      uri: "file:///transient-picker/photo.png",
      name: "photo.png",
      type: "image/png",
    };
    body.append("file", file);
    await expect(
      client.upload<{ accepted: boolean }>(body as unknown as FormData),
    ).resolves.toEqual({ accepted: true });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(
      "https://family.example.test/chore-api/transport-test/upload",
    );
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    expect(init?.body).toBe(body);
    const sentHeaders = new Headers(init?.headers);
    expect(sentHeaders.get(CSRF_HEADER_NAME)).toBe("native-csrf");
    expect(sentHeaders.has("Content-Type")).toBe(false);
    expect(body.getParts()).toEqual([
      {
        ...file,
        fieldName: "file",
        headers: {
          "content-disposition": 'form-data; name="file"; filename="photo.png"',
          "content-type": "image/png",
        },
      },
    ]);
  });
});
