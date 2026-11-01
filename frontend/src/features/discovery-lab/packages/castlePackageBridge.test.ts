import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { parseScene } from "./bridge";

describe("Castle rich-package bridge", () => {
  it("accepts the default prediction-gated Castle scene", () => {
    let output: unknown;
    const context = vm.createContext({
      self: {
        postMessage: (value: unknown) => {
          output = JSON.parse(JSON.stringify(value));
        },
      },
    });
    vm.runInContext(
      readFileSync(
        path.resolve(
          process.cwd(),
          "../docs/examples/discovery-packages/castle-defenses/castle.js",
        ),
        "utf8",
      ),
      context,
      { timeout: 500 },
    );
    Object.assign(context, {
      input: {
        type: "reset",
        values: {},
        time: 0,
        dt: 0,
        width: 800,
        height: 480,
      },
    });
    vm.runInContext("self.onmessage({data:input})", context, { timeout: 500 });

    expect(parseScene(output, "3d")).not.toBeNull();
  });
});
