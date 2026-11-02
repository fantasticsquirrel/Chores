import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
import { readdirSync } from "node:fs";
import { describe, it, expect, beforeAll } from "vitest";
import {
  parseScene,
  type Scene,
} from "../../../frontend/src/features/discovery-lab/packages/bridge";
import {
  SOUND_DEFAULT_INPUTS as SHARED_SOUND_DEFAULTS,
  normalizeSoundInputs as normalizeSharedSound,
  soundActivity as sharedSoundActivity,
} from "../../../packages/family-api/src/discovery-models/sound";
import {
  SOUND_DEFAULT_INPUTS as PACKAGE_SOUND_DEFAULTS,
  normalizeSoundInputs as normalizePackageSound,
  soundActivity as packageSoundActivity,
} from "../sound-playground/model";
import { createSoundScene as createWebSoundScene } from "../../../frontend/src/features/discovery-lab/simulations/physical-exhibits/soundScene";
import { createSoundScene as createPackageSoundScene } from "../sound-playground/soundScene";
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
  it("sound gates comparisons, separates pitch from amplitude and preserves opt-in audio/animation", () => {
    const send = worker("sound-playground");
    const initial = send();
    expect(initial.controls).toHaveLength(0);
    expect(initial.audio).toHaveLength(0);
    expect(
      initial.buttons.find((button: any) => button.id === "compareLength")
        .disabled,
    ).toBe(true);
    send("lengthHalf");
    let compared = send("compareLength");
    expect(compared.description).toContain("Fundamental 117.9 Hz");
    expect(compared.sections[0].text).toContain("matches your prediction");
    compared = send("lengthSame");
    expect(compared.sections[0].text).not.toContain("matches your prediction");
    expect(compared.controls).toHaveLength(0);
    send("lengthHalf");
    send("compareLength");
    send("amplitudeDouble");
    compared = send("compareAmplitude");
    const unlockedFrequency = compared.audio[0].frequency;
    expect(compared.sections[1].text).toContain("differs from your prediction");
    expect(compared.sections[1].text).toContain("index 9 → 36");
    compared = send("amplitudeSame");
    expect(compared.sections[1].text).not.toContain(
      "differs from your prediction",
    );
    expect(compared.controls).toHaveLength(0);
    compared = send("compareAmplitude");
    expect(compared.sections[1].text).toContain(
      "Held: 60 cm length · 80 N tension · 1 g/m linear density",
    );
    expect(
      send("phase", 90).controls.find((c: any) => c.id === "phase").value,
    ).toBe(90);
    expect(
      send("showAmplitudeSmall").controls.find((c: any) => c.id === "phase")
        .value,
    ).toBe(0);
    send("phase", 90);
    expect(
      send("showAmplitudeLarge").controls.find((c: any) => c.id === "phase")
        .value,
    ).toBe(0);
    const amplitude = send("amplitude", 6);
    expect(amplitude.description).toContain("index 36");
    expect(amplitude.audio[0].frequency).toBe(unlockedFrequency);
    expect(send("length", 120).audio[0].frequency).toBeCloseTo(
      amplitude.audio[0].frequency / 2,
    );
    expect(amplitude.audio[0].gain).toBeLessThanOrEqual(0.018);
    expect(send("play").animate).toBe(true);
    expect(
      send(undefined, undefined, "step", { dt: 0.05 }).controls.find(
        (c: any) => c.id === "phase",
      ).value,
    ).toBeGreaterThan(0);
    const relocked = send("lengthSame");
    expect(relocked.animate).toBe(false);
    expect(relocked.audio).toHaveLength(0);
    expect(relocked.controls).toHaveLength(0);
    expect(send(undefined, undefined, "reset").animate).toBe(false);
  });

  it("sound package model exactly mirrors shared boundaries and outputs", () => {
    expect(PACKAGE_SOUND_DEFAULTS).toEqual(SHARED_SOUND_DEFAULTS);
    for (const inputs of [
      SHARED_SOUND_DEFAULTS,
      { lengthCm: 120, tensionN: 20, amplitudeMm: 0 },
      { lengthCm: -10, tensionN: 999, amplitudeMm: 99 },
      { lengthCm: Number.NaN, tensionN: Infinity, amplitudeMm: -2 },
    ]) {
      expect(normalizePackageSound(inputs)).toEqual(
        normalizeSharedSound(inputs),
      );
      expect(packageSoundActivity(inputs)).toEqual(sharedSoundActivity(inputs));
    }
  });
  it("sound package and web preserve the same dimensional scene geometry", () => {
    const state = {
      kind: "sound" as const,
      length: 60,
      tension: 80,
      amplitude: 3,
      progress: 0.25,
    };
    const web = createWebSoundScene(state);
    const packaged = createPackageSoundScene(state);
    const signature = (scene: typeof web) => {
      const objects: unknown[] = [];
      scene.group.traverse((object) => {
        const mesh = object as typeof object & {
          geometry?: {
            type: string;
            attributes?: { position?: { count: number } };
          };
          material?: {
            color?: { getHexString(): string };
            emissive?: { getHexString(): string };
          };
        };
        objects.push({
          type: object.type,
          name: object.name,
          position: object.position.toArray(),
          rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
          scale: object.scale.toArray(),
          geometry: mesh.geometry?.type,
          vertices: mesh.geometry?.attributes?.position?.count,
          color: mesh.material?.color?.getHexString(),
          emissive: mesh.material?.emissive?.getHexString(),
          visible: object.visible,
        });
      });
      return { objects, labels: scene.labels?.(), view: scene.view };
    };
    expect(signature(packaged)).toEqual(signature(web));
    const next = { ...state, length: 120, amplitude: 6, progress: 0.63 };
    web.update(next);
    packaged.update(next);
    expect(signature(packaged)).toEqual(signature(web));
    web.dispose();
    packaged.dispose();
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
  it("chance vector evidence pairs observed bars with expected marks", () => {
    const send = worker("chance-carnival");
    send();
    const output = send("one");
    const expectedMarks = output.vector?.nodes.filter(
      (node: any) =>
        node.tag === "rect" &&
        node.attrs.fill === "#173f38" &&
        node.attrs.width === 4,
    );
    expect(expectedMarks).toHaveLength(4);
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
    send("lengthHalf");
    send("compareLength");
    send("amplitudeSame");
    send("compareAmplitude");
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
