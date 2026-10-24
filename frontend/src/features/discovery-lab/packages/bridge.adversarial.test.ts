import { describe, expect, it } from "vitest";
import { parseScene } from "./bridge";

describe("independent package drawing attacks", () => {
  it("rejects unsafe paint URLs, unsupported types, and non-finite geometry", () => {
    for (const shape of [
      { kind: "image", x: 0, y: 0, href: "https://attacker.invalid" },
      { kind: "circle", x: 0, y: 0, r: 2, fill: "url(#foreign)" },
      { kind: "rect", x: 0, y: 0, width: Infinity, height: 2 },
      { kind: "line", x: 0, y: 0, x2: 1, y2: 2, width: -1 },
      { kind: "text", x: 0, y: 0, text: "x".repeat(201) },
    ])
      expect(parseScene({ description: "attack", shapes: [shape] })).toBeNull();
  });
  it("rejects oversized arrays, cyclic data and duplicate controls", () => {
    expect(
      parseScene({
        description: "attack",
        shapes: Array(257).fill({ kind: "circle", x: 0, y: 0, r: 1 }),
      }),
    ).toBeNull();
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(parseScene(cyclic)).toBeNull();
    const control = {
      id: "mass",
      label: "Mass",
      min: 0,
      max: 10,
      step: 1,
      value: 1,
    };
    expect(
      parseScene({
        description: "attack",
        shapes: [],
        controls: [control, control],
      }),
    ).toBeNull();
  });
  it("rejects invalid primitive containers instead of throwing", () => {
    for (const value of [
      undefined,
      null,
      42,
      true,
      [],
      { description: "x", shapes: [null] },
      { description: "x", shapes: [], controls: [null] },
    ])
      expect(parseScene(value)).toBeNull();
  });
});
