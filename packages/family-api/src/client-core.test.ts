import { describe, expect, it } from "vitest";

import {
  FamilyApiClientCore,
  buildUrl,
  extractDomainError,
  extractDownloadFilename,
  extractErrorDetail,
  normalizeBaseUrl,
  requiresCsrfToken,
} from "./client-core";

// Existing JSON-only subclasses must not need new transport overrides.
class JsonOnlyClient extends FamilyApiClientCore {
  protected get<T>(): Promise<T> {
    return Promise.reject(new Error("unused"));
  }
  protected post<T>(): Promise<T> {
    return Promise.reject(new Error("unused"));
  }
  protected put<T>(): Promise<T> {
    return Promise.reject(new Error("unused"));
  }
  protected patch<T>(): Promise<T> {
    return Promise.reject(new Error("unused"));
  }
  protected delete(): Promise<void> {
    return Promise.reject(new Error("unused"));
  }
  protected postNoContent(): Promise<void> {
    return Promise.reject(new Error("unused"));
  }
  protected postNoContentWithBody(): Promise<void> {
    return Promise.reject(new Error("unused"));
  }
  upload(body: FormData) {
    return this.postMultipart<unknown>("/test/upload", body);
  }
  download() {
    return this.getBinary("/test/download");
  }
  cancel() {
    return this.deleteWithResponse<unknown>("/test/cancel");
  }
  remove() {
    return this.deleteWithBody<unknown, { expected_graph_revision: number }>(
      "/test/delete",
      { expected_graph_revision: 0 },
    );
  }
}

describe("shared API client mechanics", () => {
  it("extracts structured domain errors without interpreting English messages", () => {
    const detail = {
      code: "revision_conflict",
      message: "Révision périmée.",
      field_errors: { expected_graph_revision: ["Refresh before saving"] },
    };
    expect(extractDomainError({ detail })).toEqual(detail);
    expect(extractErrorDetail({ detail }, "Conflict")).toBe(detail.message);
    expect(
      extractDomainError({
        detail: { code: "another_code", message: detail.message },
      }),
    ).toEqual({ code: "another_code", message: detail.message });
  });

  it.each([
    null,
    {},
    { detail: "Denied" },
    { detail: [] },
    { detail: { code: 409, message: "Conflict" } },
    { detail: { code: "", message: "Conflict" } },
    { detail: { code: "revision_conflict", message: " " } },
    { detail: { code: "revision_conflict" } },
  ])(
    "does not infer a domain error from malformed or legacy envelopes: %j",
    (data) => {
      expect(extractDomainError(data)).toBeNull();
    },
  );

  it("preserves mixed legacy validation and fallback behavior", () => {
    expect(
      extractErrorDetail(
        {
          detail: [
            "Invalid",
            { loc: ["body", 0, "name"], msg: "Required" },
            null,
          ],
        },
        "Bad Request",
      ),
    ).toBe("Invalid body.0.name: Required");
    expect(
      extractErrorDetail({ detail: { code: "conflict" } }, "Conflict"),
    ).toBe("Conflict");
    expect(extractErrorDetail({ detail: " " }, "")).toBe("Request failed");
  });

  it.each([
    ['attachment; filename="family backup.zip"', "family backup.zip"],
    ["inline; filename=photo.png", "photo.png"],
    [
      "attachment; filename=old.zip; filename*=UTF-8''famille%20%C3%A9.zip",
      "famille é.zip",
    ],
    ["attachment; filename*=UTF-8''bad%ZZ", null],
    ['attachment; filename="/private/uploads/secret.zip"', null],
    ['attachment; filename="..\\secret.zip"', null],
    ["attachment; filename*=UTF-8''bad%0Aname.zip", null],
    ["attachment", null],
    [null, null],
  ])(
    "extracts only safe presentation filenames from %j",
    (header, expected) => {
      expect(extractDownloadFilename(header)).toBe(expected);
    },
  );

  it("rejects unsupported transports explicitly on JSON-only subclasses", async () => {
    const client = new JsonOnlyClient();
    await expect(client.upload(new FormData())).rejects.toThrow(
      "Multipart transport is not supported.",
    );
    await expect(client.download()).rejects.toThrow(
      "Binary transport is not supported.",
    );
    await expect(client.cancel()).rejects.toThrow(
      "Response DELETE transport is not supported.",
    );
    await expect(client.remove()).rejects.toThrow(
      "JSON DELETE transport is not supported.",
    );
  });
  it("normalizes browser-relative base URLs", () => {
    expect(normalizeBaseUrl("", "/chore-api", { allowRelative: true })).toBe(
      "/chore-api",
    );
    expect(
      normalizeBaseUrl("chore-api/", "/chore-api", { allowRelative: true }),
    ).toBe("/chore-api");
  });

  it("normalizes absolute mobile base URLs", () => {
    expect(
      normalizeBaseUrl("http://10.0.2.2:8000/chore-api/", "http://fallback", {
        allowRelative: false,
      }),
    ).toBe("http://10.0.2.2:8000/chore-api");
  });

  it("builds relative and absolute URLs with query params", () => {
    expect(
      buildUrl("/chore-api", "/children", {
        household_id: 1,
        active_only: false,
        omitted: undefined,
        empty: null,
      }),
    ).toBe("/chore-api/children?household_id=1&active_only=false");
    expect(
      buildUrl("http://api.test/chore-api", "children", { child_id: 2 }),
    ).toBe("http://api.test/chore-api/children?child_id=2");
  });

  it("requires CSRF only for unsafe methods", () => {
    expect(requiresCsrfToken("GET")).toBe(false);
    expect(requiresCsrfToken("HEAD")).toBe(false);
    expect(requiresCsrfToken("OPTIONS")).toBe(false);
    expect(requiresCsrfToken("POST")).toBe(true);
    expect(requiresCsrfToken("PATCH")).toBe(true);
  });

  it("formats backend and pydantic validation errors", () => {
    expect(extractErrorDetail({ detail: "Nope" }, "fallback")).toBe("Nope");
    expect(
      extractErrorDetail(
        { detail: [{ loc: ["body", "name"], msg: "Field required" }] },
        "fallback",
      ),
    ).toBe("body.name: Field required");
    expect(extractErrorDetail({}, "fallback")).toBe("fallback");
  });
});
