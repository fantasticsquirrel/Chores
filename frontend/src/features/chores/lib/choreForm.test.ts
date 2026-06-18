import { describe, expect, it } from "vitest";

import { parseOptionalPositiveInteger } from "./choreForm";

describe("parseOptionalPositiveInteger", () => {
  it("returns null for blank values", () => {
    expect(parseOptionalPositiveInteger("", "Window")).toBeNull();
    expect(parseOptionalPositiveInteger("   ", "Window")).toBeNull();
  });

  it("parses positive whole numbers", () => {
    expect(parseOptionalPositiveInteger("7", "Window")).toBe(7);
    expect(parseOptionalPositiveInteger(" 12 ", "Window")).toBe(12);
  });

  it("rejects zero, negative, and non-numeric values", () => {
    expect(() => parseOptionalPositiveInteger("0", "Window")).toThrow(
      "Window must be a positive whole number.",
    );
    expect(() => parseOptionalPositiveInteger("-2", "Window")).toThrow(
      "Window must be a positive whole number.",
    );
    expect(() => parseOptionalPositiveInteger("abc", "Window")).toThrow(
      "Window must be a positive whole number.",
    );
  });
});
