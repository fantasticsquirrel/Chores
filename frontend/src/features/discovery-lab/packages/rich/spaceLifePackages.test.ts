// @vitest-environment node
/// <reference types="node" />
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, it, expect } from "vitest";
import { parseScene } from "../bridge";
const root = existsSync("scripts/exploration-packages")
  ? process.cwd()
  : resolve(process.cwd(), "..");
const topics = [
  "orbital-mechanics",
  "gravity",
  "solar-system",
  "moon-phases",
  "photosynthesis",
  "reflection-refraction",
];
type Output = {
  description: string;
  controls: { id: string; value: number; min: number; max: number }[];
  buttons: { id: string; label: string }[];
  scene3d?: { textures: { asset: string }[]; nodes: unknown[] };
  vector?: unknown;
  animate: boolean;
  sections: { text: string }[];
};
const codes = new Map<string, string>();
beforeAll(async () => {
  for (const topic of topics) {
    const r = await build({
      entryPoints: [
        resolve(root, `scripts/exploration-packages/${topic}/worker.ts`),
      ],
      bundle: true,
      write: false,
      format: "iife",
      minify: true,
    });
    codes.set(topic, r.outputFiles[0].text);
  }
}, 30000);
function worker(topic: string) {
  let output: Output;
  const self = {
    postMessage: (v: Output) => {
      const raw = v as Output & {
        scene3d?: Output["scene3d"] & { reuseResources?: boolean };
      };
      if (raw.scene3d?.reuseResources) {
        const { reuseResources, ...rest } = raw.scene3d;
        void reuseResources;
        output = { ...raw, scene3d: { ...output.scene3d, ...rest } } as Output;
      } else output = v;
    },
    onmessage: (_event: unknown) => {
      void _event;
    },
  };
  runInNewContext(codes.get(topic)!, { self });
  const send = (
    control?: string,
    value?: number,
    type = control ? "control" : "reset",
  ) => {
    self.onmessage({
      data: {
        type,
        control,
        dt: 0.05,
        width: 390,
        height: 480,
        values: control
          ? {
              ...Object.fromEntries(
                output.controls.map((c) => [c.id, c.value]),
              ),
              ...(value === undefined ? {} : { [control]: value }),
            }
          : {},
      },
    });
    return output;
  };
  return send;
}
describe("complete space and life worker packages", () => {
  for (const topic of topics)
    it(`${topic}: bounded parser accepts all controls and retains offline model`, () => {
      const run = worker(topic);
      let output = run();
      const assets = new Set(
        output.scene3d?.textures.map((t) => t.asset) ?? [],
      );
      expect(parseScene(output, "rich", assets), topic).not.toBeNull();
      for (const control of output.controls) {
        for (const value of [control.min, control.max]) {
          run();
          output = run(control.id, value);
          expect(
            parseScene(output, "rich", assets),
            `${topic}:${control.id}=${value}`,
          ).not.toBeNull();
        }
      }
      for (const button of run().buttons) {
        run();
        output = run(button.id);
        expect(
          parseScene(output, "rich", assets),
          `${topic}:${button.id}`,
        ).not.toBeNull();
      }
      expect(
        readFileSync(
          resolve(root, `scripts/exploration-packages/${topic}/worker.ts`),
          "utf8",
        ),
      ).not.toMatch(/frontend|mobile|fetch\(|document\./);
    }, 30000);
  it("orbit preserves collision/escape/mass baseline", () => {
    const run = worker("orbital-mechanics");
    run();
    expect(run("test").description).toContain("planet collision");
    expect(run("preset142").description).toContain("escape path");
    expect(run("mass", 2).description).toContain("Escape threshold 2.000");
  });
  it("gravity mass affects weight but not landing time", () => {
    const run = worker("gravity");
    const a = run();
    const b = run("mass", 20);
    expect(a.description.match(/fall time [\d.]+ s/g)).toEqual(
      b.description.match(/fall time [\d.]+ s/g),
    );
    expect(b.description).toContain("196.2 N");
    expect(run("test").sections[1].text).toContain("same acceleration");
  });
  it("solar keeps eight shortcuts and common diameter scale", () => {
    const run = worker("solar-system");
    expect(run().buttons.filter((b) => b.id.startsWith("planet"))).toHaveLength(
      8,
    );
    run("planet4");
    expect(run("mode", 1).description).toContain("11.21 Earth diameters");
    expect(run("test").sections[1].text).toContain("1/165");
  });
  it("moon quarter/full/new values and opposite quarters preserve full inset", () => {
    const run = worker("moon-phases");
    run();
    for (const [angle, percent] of [
      [0, 0],
      [90, 50],
      [180, 100],
      [270, 50],
    ])
      expect(run("angle", angle).description).toContain(`${percent}%`);
    expect(JSON.stringify(run("angle", 90).vector)).toContain("radialGradient");
  });
  it("leaf zero resources and saved comparison remain causal", () => {
    const run = worker("photosynthesis");
    run();
    run("save");
    expect(run("water", 0).description).toContain("Relative activity 0 / 100");
    expect(run("light", 100).description).toContain(
      "Relative activity 0 / 100",
    );
    expect(run("carbon", 0).description).toContain("Saved trial");
  });
  it("optics equal index and critical-angle TIR preserve detailed diagram", () => {
    const run = worker("reflection-refraction");
    run();
    expect(run("n2", 1).description).toContain("No reflection");
    expect(run("test").description).toContain("Total internal reflection");
    expect(JSON.stringify(run().vector)).toContain("pattern");
  });
});
