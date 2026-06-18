import { describe, expect, it } from "vitest";

import {
  buildUrl,
  extractErrorDetail,
  normalizeBaseUrl,
  requiresCsrfToken,
} from "./client-core";

describe("shared API client mechanics", () => {
  it("normalizes browser-relative base URLs", () => {
    expect(normalizeBaseUrl("", "/chore-api", { allowRelative: true })).toBe(
      "/chore-api",
    );
    expect(normalizeBaseUrl("chore-api/", "/chore-api", { allowRelative: true })).toBe(
      "/chore-api",
    );
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
    expect(buildUrl("http://api.test/chore-api", "children", { child_id: 2 })).toBe(
      "http://api.test/chore-api/children?child_id=2",
    );
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
