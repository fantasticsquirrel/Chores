import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
import { readdirSync } from "node:fs";
import { describe, it, expect, beforeAll } from "vitest";
import {
  parseScene,
  type Scene,
} from "../../../frontend/src/features/discovery-lab/packages/bridge";
const ids = [
  "sound-playground",
  "bridge-builder",
  "river-sculptor",
  "circuit-city",
  "food-web-rescue",
  "fraction-feast",
  "pattern-palace",
  "caravan-crossroads",
  "pollinator-express",
  "chance-carnival",
];
const code = new Map<string, string>();
beforeAll(() => {
  for (const id of ids)
    code.set(
      id,
      buildSync({
        entryPoints: [`scripts/exploration-packages/${id}/worker.ts`],
        bundle: true,
        minify: true,
        format: "iife",
        write: false,
      }).outputFiles[0].text,
    );
}, 30000);
function worker(id: string) {
  let output: any;
  let previous: Scene | null = null;
  const assets = new Set<string>();
  try {
    for (const f of readdirSync(`scripts/exploration-packages/${id}/assets`))
      assets.add("assets/" + f);
  } catch {}
  const context: any = {
    structuredClone,
    console,
    postMessage: (x: any) => {
      output = x;
    },
  };
  context.self = context;
  runInNewContext(code.get(id)!, context);
  return (
    control?: string,
    value?: number,
    type = control ? "control" : "reset",
    extra: any = {},
  ) => {
    context.onmessage({
      data: {
        type,
        control,
        values: control ? { [control]: value ?? 1 } : {},
        ...extra,
      },
    });
    const parsed = parseScene(output, "rich", assets, previous);
    expect(
      parsed,
      `${id} ${control ?? type}: bytes=${JSON.stringify(output).length}`,
    ).not.toBeNull();
    previous = parsed;
    return { ...output, scene3d: parsed?.rich3d };
  };
}
describe("ten independently authored rich explorations", () => {
  for (const id of ids) {
    it(`${id}: initial, every control endpoint, every action and reset validate`, () => {
      const send = worker(id);
      const initial = send();
      expect(initial.sections.length).toBeGreaterThanOrEqual(3);
      expect(initial.footnote.length).toBeGreaterThan(50);
      for (const c of initial.controls) {
        send(c.id, c.min);
        send(c.id, c.max);
        send(undefined, undefined, "reset");
      }
      for (const b of initial.buttons) {
        send(b.id);
        send(undefined, undefined, "reset");
      }
      const reset = send();
      expect(reset.description).toBe(initial.description);
    }, 30000);
  }
  it("sound separates pitch from amplitude and preserves audio/animation", () => {
    const send = worker("sound-playground");
    const initial = send();
    const amplitude = send("amplitude", 6);
    expect(amplitude.description).toContain("36.0");
    expect(amplitude.audio[0].frequency).toBe(initial.audio[0].frequency);
    expect(send("length", 120).audio[0].frequency).toBeCloseTo(
      initial.audio[0].frequency / 2,
    );
    expect(send("play").animate).toBe(true);
    expect(
      send(undefined, undefined, "step", { dt: 0.05 }).controls.find(
        (c: any) => c.id === "phase",
      ).value,
    ).toBeGreaterThan(0);
    expect(send(undefined, undefined, "reset").animate).toBe(false);
  });
  it("river soil is conserved through repeated storms and restore preserves controls", () => {
    const send = worker("river-sculptor");
    send();
    send("rain", 100);
    send("vegetation", 0);
    let o: any;
    for (let n = 0; n < 20; n++) o = send("storm");
    expect(o.description).toContain("Total 5000.0 kg");
    o = send("restore");
    expect(o.description).toContain("Soil remaining 5000.0");
    expect(o.controls.find((c: any) => c.id === "rain").value).toBe(100);
  }, 30000);
  it("fractions preserve sparse slices under splitting and show sums beyond one", () => {
    const send = worker("fraction-feast");
    send();
    send("slice", 2);
    send("toggleSlice");
    expect(send("split").description).toContain("Plate A 4/4");
    send("trialSum");
    send("predictDifferent");
    send("baseline");
    const o = send("compare");
    expect(o.description).toContain("Sum 17/12");
    expect(o.vector).toBeTruthy();
  }, 30000);
  it("chance counts are actual samples and zero weights cannot draw", () => {
    const send = worker("chance-carnival");
    send();
    const sample = send("one");
    expect(sample.description).toContain("1 trials");
    for (let n = 0; n < 4; n++) {
      send("selected", n);
      send("weight", 0);
    }
    const o = send("run");
    expect(o.description).toContain("no possible draw");
    expect(o.description).toContain("0 trials");
  }, 30000);
  it("pollinator reach and pollen remain distinct", () => {
    const send = worker("pollinator-express");
    send();
    send("flower_a");
    expect(send("flower_c").description).toContain("0 compatible");
    send(undefined, undefined, "reset");
    send("flower_a");
    expect(send("flower_b").description).toContain("1 compatible");
    expect(send("flower_d").description).toContain("1 compatible");
    expect(send("habitat", 1).description).toContain("0 visits");
  }, 30000);
  for (const id of ids)
    it(`${id}: combined minimum and maximum controls validate`, () => {
      const send = worker(id);
      for (const edge of ["min", "max"] as const) {
        let output = send();
        for (const id of output.controls.map((c: any) => c.id)) {
          const control = output.controls.find((c: any) => c.id === id);
          output = send(id, control[edge]);
        }
        expect(output.description).toBeTruthy();
      }
    }, 60000);
  it("fractions: every pair of denominators with both full plates remains supported", () => {
    const send = worker("fraction-feast");
    send();
    const denominators = [2, 3, 4, 6, 8, 12, 16, 24];
    for (let a = 0; a < denominators.length; a++) {
      send("active", 0);
      send("denominator", a);
      send("numerator", denominators[a]);
      for (let b = 0; b < denominators.length; b++) {
        send("active", 1);
        send("denominator", b);
        const output = send("numerator", denominators[b]);
        expect(output.description).toContain(
          `Plate A ${denominators[a]}/${denominators[a]}; plate B ${denominators[b]}/${denominators[b]}`,
        );
      }
    }
  }, 120000);
  it("fractions: stale slice cannot exceed the new whole and comparison needs a baseline", () => {
    const send = worker("fraction-feast");
    send();
    send("denominator", 7);
    send("slice", 24);
    send("denominator", 0);
    send("numerator", 2);
    expect(send("toggleSlice").description).toContain("Plate A 1/2");
    send("trialSum");
    send("predictDifferent");
    expect(send("compare").vector).toBeUndefined();
    send("baseline");
    expect(send("compare").description).toContain("Sum 17/12");
  });
  it("chance: comparison without baseline cannot manufacture a misleading sample", () => {
    const send = worker("chance-carnival");
    send();
    send("predictNo");
    expect(send("compare").description).toContain("0 trials");
    send("baseline");
    expect(send("compare").description).toContain("1000 trials");
    expect(send("compare").description).toContain("1000 trials");
  });
  it("sound ruler drag stays captured without repeatedly plucking", () => {
    const send = worker("sound-playground");
    send();
    const ray = (phase: string, x: number, z: number) =>
      send(undefined, undefined, "pointer", {
        pointer: { phase, rayOrigin: [x, 10, z], rayDirection: [0, -1, 0] },
      });
    ray("down", 0, 1.2);
    const moved = ray("move", 3, 0);
    expect(moved.controls.find((c: any) => c.id === "length").value).toBe(94);
    expect(moved.animate).toBe(false);
    ray("up", 3, 0);
    const plucked = ray("down", -2, 0);
    expect(plucked.animate).toBe(true);
    const stepped = send(undefined, undefined, "step", { dt: 0.1 });
    const phase = stepped.controls.find((c: any) => c.id === "phase").value;
    expect(
      ray("move", -1, 0).controls.find((c: any) => c.id === "phase").value,
    ).toBe(phase);
  });
});
