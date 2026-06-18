import { describe, expect, it } from "vitest";

import { ApiClientError } from "../api";
import { formatApiError, isUnauthorizedError } from "./errors";

describe("formatApiError", () => {
  it("returns API error details", () => {
    expect(
      formatApiError(
        new ApiClientError(503, "Service unavailable", {
          detail: "Service unavailable",
        }),
      ),
    ).toBe("Service unavailable");
  });

  it("returns non-empty Error messages", () => {
    expect(formatApiError(new Error("Network failed"))).toBe("Network failed");
  });

  it("falls back for empty Error messages", () => {
    expect(formatApiError(new Error(""))).toBe("Request failed.");
  });

  it("falls back for unknown errors", () => {
    expect(formatApiError({ reason: "opaque" })).toBe("Request failed.");
  });
});

describe("isUnauthorizedError", () => {
  it("detects 401 API errors without treating other errors as unauthorized", () => {
    expect(isUnauthorizedError(new ApiClientError(401, "Nope", {}))).toBe(true);
    expect(isUnauthorizedError(new ApiClientError(403, "Forbidden", {}))).toBe(false);
    expect(isUnauthorizedError(new Error("Nope"))).toBe(false);
  });
});
