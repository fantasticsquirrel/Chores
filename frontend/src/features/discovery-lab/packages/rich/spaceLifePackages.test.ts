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
  it("gravity gates both comparisons and keeps weight distinct from fall time", () => {
    const run = worker("gravity");
    const a = run();
    const b = run("mass", 20);
    expect(a.description.match(/fall time [\d.]+ s/g)).toEqual(
      b.description.match(/fall time [\d.]+ s/g),
    );
    expect(b.description).toContain("196.2 N");
    expect(a.buttons.map(({ id }) => id)).not.toContain("compareMass");
    expect(run("compareMass").sections[0].text).toContain("Predict first");
    expect(run("compareWorld").sections[1].text).toContain(
      "Complete the mass comparison first",
    );
    const predictedMass = run("massHeavy");
    expect(predictedMass.buttons.map(({ id }) => id)).toContain("compareMass");
    expect(run("compareMass").sections[0].text).toContain(
      "differs from your prediction",
    );
    expect(run("showMass").buttons.map(({ id }) => id)).not.toContain(
      "compareWorld",
    );
    const predictedWorld = run("worldMoonLonger");
    expect(predictedWorld.buttons.map(({ id }) => id)).toContain(
      "compareWorld",
    );
    expect(run("compareWorld").sections[1].text).toContain(
      "matches your prediction",
    );
  });
  it("solar gates both comparisons and keeps one diameter scale", () => {
    const run = worker("solar-system");
    expect(run().buttons.map(({ id }) => id)).not.toContain("compareOrbit");
    expect(run("compareOrbit").sections[0].text).toContain("Predict first");
    const predictedOrbit = run("orbitNeptune");
    expect(predictedOrbit.buttons.map(({ id }) => id)).toContain(
      "compareOrbit",
    );
    expect(run("compareOrbit").sections[0].text).toContain(
      "differs from your prediction",
    );
    expect(run("diameter11").buttons.map(({ id }) => id)).toContain(
      "compareDiameter",
    );
    const diameter = run("compareDiameter");
    expect(diameter.description).toContain("11.21 Earth diameters");
    expect(diameter.sections[1].text).toContain("matches your prediction");
  });
  it("moon gates both comparisons and preserves phase boundaries", () => {
    const run = worker("moon-phases");
    expect(run().buttons.map(({ id }) => id)).not.toContain("runQuarter");
    expect(run().controls).toHaveLength(0);
    expect(run("runQuarter").sections[0].text).toContain("Predict first");
    const quarterPrediction = run("quarter25");
    expect(quarterPrediction.buttons.map(({ id }) => id)).toContain(
      "runQuarter",
    );
    expect(run("runQuarter").sections[0].text).toContain(
      "differs from your prediction",
    );
    const oppositePrediction = run("oppositeSame");
    expect(oppositePrediction.buttons.map(({ id }) => id)).toContain(
      "runOpposite",
    );
    const opposite = run("runOpposite");
    expect(opposite.sections[1].text).toContain("matches your prediction");
    expect(opposite.sections[1].text).toContain(
      "First quarter 50%; last quarter 50%",
    );
    expect(opposite.controls).toHaveLength(1);
    for (const [angle, percent] of [
      [0, 0],
      [90, 50],
      [180, 100],
      [270, 50],
    ])
      expect(run("angle", angle).description).toContain(`${percent}%`);
    expect(JSON.stringify(opposite.vector)).toContain("radialGradient");
  });
  it("leaf challenges preserve gates, ties, and a complete comparison", () => {
    const run = worker("photosynthesis");
    expect(run().buttons.map(({ id }) => id)).not.toContain("lightLevels");
    run("lightLevels");
    expect(run("runLight").sections[1].text).toContain(
      "Complete the zero-water comparison first",
    );
    expect(run("runZero").sections[0].text).not.toContain("Light 30 →");
    run("zeroRises");
    expect(run("runZero").sections[0].text).toContain(
      "does not match your prediction",
    );
    run("zeroStays");
    const zeroCorrect = run("runZero");
    expect(zeroCorrect.sections[0].text).toContain(
      "Light 30 → index 0; light 100 → index 0",
    );
    expect(zeroCorrect.buttons.map(({ id }) => id)).toContain("lightLevels");
    run("lightKeepsRising");
    expect(run("runLight").sections[1].text).toContain(
      "does not match your prediction",
    );
    run("lightLevels");
    expect(run("runLight").sections[1].text).toContain(
      "Light 15 → index 37; light 35 → index 67; light 100 → index 67",
    );
    run("save");
    const changed = run("carbon", 0).description;
    expect(changed).toContain(
      "Trial A: light 100, water 35, carbon dioxide 80",
    );
    expect(changed).toContain("Changed: carbon dioxide");
    expect(changed).toContain("Toy activity index 0 / 100");
    const invalidated = run("zeroRises");
    expect(invalidated.buttons.map(({ id }) => id)).not.toContain(
      "lightLevels",
    );
    expect(invalidated.sections[1].text).toContain(
      "Complete the zero-water comparison first",
    );
  });
  it("optics preserves both guided comparisons, boundaries, and detailed diagram", () => {
    const run = worker("reflection-refraction");
    expect(run().buttons.map(({ id }) => id)).not.toContain("runDirection");
    expect(run().buttons.map(({ id }) => id)).not.toContain("runCritical");
    expect(run("n1", 1).description).toContain("No reflection");
    const selectedCritical = run("criticalRemains");
    expect(selectedCritical.buttons.map(({ id }) => id)).toContain(
      "runCritical",
    );
    const critical = run("runCritical");
    expect(critical.sections[0].text).toContain("differs from your prediction");
    expect(critical.buttons.map(({ id }) => id)).toContain("directionOpposite");
    expect(critical.buttons.map(({ id }) => id)).toContain("showCritical40");
    expect(run("showCritical40").description).toContain(
      "Refraction angle 74.6°",
    );
    run("directionOpposite");
    const direction = run("runDirection");
    expect(direction.sections[1].text).toContain(
      "Air → glass: 19.5°; glass → air: 48.6°",
    );
    expect(direction.sections[1].text).toContain("matches your prediction");
    expect(direction.buttons.map(({ id }) => id)).toContain(
      "showDirectionAirGlass",
    );
    expect(run("showDirectionAirGlass").description).toContain(
      "Refraction angle 19.5°",
    );
    run("n1", 1);
    run("n2", 1.5);
    expect(run("angle", 80).description).not.toContain(
      "Total internal reflection",
    );
    expect(JSON.stringify(direction.vector)).toContain("pattern");
  });
});
