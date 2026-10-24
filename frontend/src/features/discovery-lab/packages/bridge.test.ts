/// <reference types="node" />
import { readFileSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { parseScene, sandboxDocument } from "./bridge";
describe("package worker boundary", () => {
  it("accepts bounded primitives and controls", () =>
    expect(
      parseScene({
        description: "Two masses move",
        shapes: [{ kind: "circle", x: 10, y: 20, r: 5, fill: "#abc" }],
        controls: [
          { id: "mass", label: "Mass", min: 1, max: 10, step: 1, value: 2 },
        ],
      }),
    ).not.toBeNull());
  it("rejects URLs, HTML primitives, unbounded numbers and excess messages", () => {
    for (const shape of [
      { kind: "image", url: "https://example.com" },
      { kind: "circle", x: Infinity, y: 2, r: 3 },
      { kind: "circle", x: 1, y: 2, r: 3, fill: "url(https://example.com)" },
    ])
      expect(parseScene({ description: "x", shapes: [shape] })).toBeNull();
    expect(
      parseScene({ description: "x".repeat(100001), shapes: [] }),
    ).toBeNull();
  });
  it("uses a hashed trusted bootstrap and no same-origin or unsafe script allowance", async () => {
    const html = await sandboxDocument("capability");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("worker-src blob:");
    expect(html).toContain("script-src 'sha256-");
    expect(html).not.toContain("unsafe-eval");
    expect(html).not.toContain("unsafe-inline");
  });
});

it("renders the shipped pendulum worker at control boundaries", () => {
  const relative =
    "docs/examples/discovery-packages/pendulum-period/pendulum.js";
  const code = readFileSync(
    existsSync(relative) ? relative : `../${relative}`,
    "utf8",
  );
  let output: unknown;
  const self = {
    onmessage: (event: unknown) => {
      void event;
    },
    postMessage: (value: unknown) => {
      output = value;
    },
  };
  runInNewContext(code, { self });
  for (const values of [
    {},
    { length: 0.5, mass: 0.5, time: 0 },
    { length: 2, mass: 2, time: 10 },
  ]) {
    self.onmessage({ data: { type: "step", values } });
    expect(parseScene(output)).not.toBeNull();
    expect(parseScene(output)?.animate).toBe(false);
  }
});

it("rejects inherited or prototype control identifiers", () => {
  for (const id of ["constructor", "toString", "__proto__", "prototype"])
    expect(
      parseScene({
        description: "x",
        shapes: [],
        controls: [{ id, label: "Input", min: 0, max: 1, step: 1, value: 0 }],
      }),
    ).toBeNull();
});

it("accepts an explicit animation opt-out but rejects nonboolean hints", () => {
  expect(
    parseScene({
      description: "Static experiment",
      shapes: [],
      controls: [],
      animate: false,
    })?.animate,
  ).toBe(false);
  for (const animate of ["false", 0, null, {}])
    expect(
      parseScene({ description: "x", shapes: [], controls: [], animate }),
    ).toBeNull();
});

it("requires nonblank accessible descriptions and control labels", () => {
  for (const description of ["", " \n "])
    expect(parseScene({ description, shapes: [], controls: [] })).toBeNull();
  for (const label of ["", "  "]) {
    expect(
      parseScene({
        description: "Evidence",
        shapes: [],
        controls: [{ id: "x", label, min: 0, max: 1, step: 1, value: 0 }],
      }),
    ).toBeNull();
    expect(
      parseScene({
        description: "Evidence",
        shapes: [],
        controls: [],
        buttons: [{ id: "step", label }],
      }),
    ).toBeNull();
  }
});
