/// <reference types="node" />
import { readFileSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { parseScene } from "../bridge";
describe("independent castle package", () => {
  it("accepts the rich worker output through the real boundary", () => {
    const path = "docs/examples/discovery-packages/castle-defenses/castle.js";
    const code = readFileSync(existsSync(path) ? path : `../${path}`, "utf8");
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
    self.onmessage({
      data: {
        type: "reset",
        values: {},
        time: 0,
        dt: 0,
        width: 800,
        height: 480,
      },
    });
    const parsed = parseScene(output, "3d");
    expect(parsed).not.toBeNull();
    expect(parsed?.scene3d).toBeDefined();
    expect(parsed?.animate).toBe(false);
  });
});
