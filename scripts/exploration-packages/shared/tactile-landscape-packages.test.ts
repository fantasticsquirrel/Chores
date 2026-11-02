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
import {
  BRIDGE_DEFAULT_INPUTS as SHARED_BRIDGE_DEFAULTS,
  BRIDGE_VISUAL_MAX_DEFLECTION_MILLIMETERS as SHARED_BRIDGE_VISUAL_MAX,
  bridgeActivity as sharedBridgeActivity,
  bridgeDeflectionVisualFraction as sharedBridgeVisualFraction,
  bridgeProfileDeflectionMillimetersAt as sharedBridgeProfileAt,
  normalizeBridgeInputs as normalizeSharedBridge,
} from "../../../packages/family-api/src/discovery-models/bridge";
import {
  BRIDGE_DEFAULT_INPUTS as PACKAGE_BRIDGE_DEFAULTS,
  BRIDGE_VISUAL_MAX_DEFLECTION_MILLIMETERS as PACKAGE_BRIDGE_VISUAL_MAX,
  bridgeActivity as packageBridgeActivity,
  bridgeDeflectionVisualFraction as packageBridgeVisualFraction,
  bridgeProfileDeflectionMillimetersAt as packageBridgeProfileAt,
  normalizeBridgeInputs as normalizePackageBridge,
} from "../bridge-builder/model";
import { createBridgeScene as createWebBridgeScene } from "../../../frontend/src/features/discovery-lab/simulations/physical-exhibits/bridgeScene";
import { createBridgeScene as createPackageBridgeScene } from "../bridge-builder/bridgeScene";
import {
  RIVER_DEFAULT_INPUTS as SHARED_RIVER_DEFAULTS,
  RIVER_INITIAL_LEDGER as SHARED_RIVER_LEDGER,
  applyRiverStorm as applySharedRiverStorm,
  normalizeRiverInputs as normalizeSharedRiver,
  riverActivity as sharedRiverActivity,
  riverStateAtPhase as sharedRiverStateAtPhase,
} from "../../../packages/family-api/src/discovery-models/river";
import {
  RIVER_DEFAULT_INPUTS as PACKAGE_RIVER_DEFAULTS,
  RIVER_INITIAL_LEDGER as PACKAGE_RIVER_LEDGER,
  applyRiverStorm as applyPackageRiverStorm,
  normalizeRiverInputs as normalizePackageRiver,
  riverActivity as packageRiverActivity,
  riverStateAtPhase as packageRiverStateAtPhase,
} from "../river-sculptor/model";
import { buildRiver as buildWebRiver } from "../../../packages/discovery-scenes/src/landscape/river";
import { buildRiver as buildPackageRiver } from "../river-sculptor/river";
import {
  CIRCUIT_DEFAULT_INPUTS as SHARED_CIRCUIT_DEFAULTS,
  CIRCUIT_SWITCH_COMPARISON as SHARED_CIRCUIT_SWITCH_COMPARISON,
  CIRCUIT_VOLTAGE_COMPARISON as SHARED_CIRCUIT_VOLTAGE_COMPARISON,
  circuitActivity as sharedCircuitActivity,
  circuitStateAtPhase as sharedCircuitStateAtPhase,
  normalizeCircuitInputs as normalizeSharedCircuit,
} from "../../../packages/family-api/src/discovery-models/circuit";
import {
  CIRCUIT_DEFAULT_INPUTS as PACKAGE_CIRCUIT_DEFAULTS,
  CIRCUIT_SWITCH_COMPARISON as PACKAGE_CIRCUIT_SWITCH_COMPARISON,
  CIRCUIT_VOLTAGE_COMPARISON as PACKAGE_CIRCUIT_VOLTAGE_COMPARISON,
  circuitActivity as packageCircuitActivity,
  circuitStateAtPhase as packageCircuitStateAtPhase,
  normalizeCircuitInputs as normalizePackageCircuit,
} from "../circuit-city/model";
import { createCircuitScene as createWebCircuitScene } from "../../../frontend/src/features/discovery-lab/simulations/physical-exhibits/circuitScene";
import { createCircuitScene as createPackageCircuitScene } from "../circuit-city/circuitScene";
import {
  POND_DEFAULT_CONDITIONS as SHARED_POND_CONDITIONS,
  POND_INITIAL_STATE as SHARED_POND_INITIAL,
  POND_NUTRIENT_COMPARISON as SHARED_POND_NUTRIENT_COMPARISON,
  POND_PREDATOR_COMPARISON as SHARED_POND_PREDATOR_COMPARISON,
  advancePondWeek as advanceSharedPond,
  normalizePondConditions as normalizeSharedPondConditions,
  normalizePondState as normalizeSharedPondState,
  pondStateAtPhase as sharedPondStateAtPhase,
  runPondTrial as runSharedPondTrial,
} from "../../../packages/family-api/src/discovery-models/pond";
import {
  POND_DEFAULT_CONDITIONS as PACKAGE_POND_CONDITIONS,
  POND_INITIAL_STATE as PACKAGE_POND_INITIAL,
  POND_NUTRIENT_COMPARISON as PACKAGE_POND_NUTRIENT_COMPARISON,
  POND_PREDATOR_COMPARISON as PACKAGE_POND_PREDATOR_COMPARISON,
  advancePondWeek as advancePackagePond,
  normalizePondConditions as normalizePackagePondConditions,
  normalizePondState as normalizePackagePondState,
  pondStateAtPhase as packagePondStateAtPhase,
  runPondTrial as runPackagePondTrial,
} from "../food-web-rescue/model";
import { buildPond as buildWebPond } from "../../../packages/discovery-scenes/src/landscape/pond";
import { buildPond as buildPackagePond } from "../food-web-rescue/pond";
import {
  addFractionParts as addSharedFractionParts,
  normalizeFraction as normalizeSharedFraction,
} from "../../../packages/family-api/src/discovery-models/fractions";
import {
  addFractionParts as addPackageFractionParts,
  normalizeFraction as normalizePackageFraction,
} from "../fraction-feast/model";
import { buildPizzaScene as buildWebPizzaScene } from "../../../frontend/src/features/discovery-lab/simulations/tactile/pizzaScene";
import { buildPizzaScene as buildPackagePizzaScene } from "../fraction-feast/pizzaScene";
import {
  patternMarkerComparison as sharedPatternMarkerComparison,
  patternVertexFit as sharedPatternVertexFit,
  regularPolygonVertices as sharedRegularPolygonVertices,
  rigidTransformPoint as sharedRigidTransformPoint,
} from "../../../packages/family-api/src/discovery-models/patterns";
import {
  patternMarkerComparison as packagePatternMarkerComparison,
  patternVertexFit as packagePatternVertexFit,
  regularPolygonVertices as packageRegularPolygonVertices,
  rigidTransformPoint as packageRigidTransformPoint,
} from "../pattern-palace/model";
import {
  CARAVAN_ROUTE_TRIAL as SHARED_CARAVAN_ROUTE_TRIAL,
  CARAVAN_SEASON_TRIAL as SHARED_CARAVAN_SEASON_TRIAL,
  calculateCaravanJourney as calculateSharedCaravanJourney,
  compareCaravanPlans as compareSharedCaravanPlans,
} from "../../../packages/family-api/src/discovery-models/caravans";
import {
  CARAVAN_ROUTE_TRIAL as PACKAGE_CARAVAN_ROUTE_TRIAL,
  CARAVAN_SEASON_TRIAL as PACKAGE_CARAVAN_SEASON_TRIAL,
  calculateCaravanJourney as calculatePackageCaravanJourney,
  compareCaravanPlans as comparePackageCaravanPlans,
} from "../caravan-crossroads/caravans";
import { buildCaravan as buildWebCaravan } from "../../../packages/discovery-scenes/src/landscape/caravan";
import { buildCaravan as buildPackageCaravan } from "../caravan-crossroads/caravan";
import {
  POLLINATOR_COMPATIBILITY_TRIAL as SHARED_POLLINATOR_COMPATIBILITY_TRIAL,
  POLLINATOR_COMPATIBILITY_TARGETS as SHARED_POLLINATOR_COMPATIBILITY_TARGETS,
  POLLINATOR_FLOWERS as SHARED_POLLINATOR_FLOWERS,
  POLLINATOR_HABITAT_TRIAL as SHARED_POLLINATOR_HABITAT_TRIAL,
  POLLINATOR_TEACHING_ASSUMPTIONS as SHARED_POLLINATOR_ASSUMPTIONS,
  calculatePollinatorVisit as calculateSharedPollinatorVisit,
  comparePollinatorRoutes as compareSharedPollinatorRoutes,
  initialPollinator as initialSharedPollinator,
  runPollinatorRoute as runSharedPollinatorRoute,
} from "../../../packages/family-api/src/discovery-models/pollinators";
import {
  POLLINATOR_COMPATIBILITY_TRIAL as PACKAGE_POLLINATOR_COMPATIBILITY_TRIAL,
  POLLINATOR_COMPATIBILITY_TARGETS as PACKAGE_POLLINATOR_COMPATIBILITY_TARGETS,
  POLLINATOR_FLOWERS as PACKAGE_POLLINATOR_FLOWERS,
  POLLINATOR_HABITAT_TRIAL as PACKAGE_POLLINATOR_HABITAT_TRIAL,
  POLLINATOR_TEACHING_ASSUMPTIONS as PACKAGE_POLLINATOR_ASSUMPTIONS,
  calculatePollinatorVisit as calculatePackagePollinatorVisit,
  comparePollinatorRoutes as comparePackagePollinatorRoutes,
  initialPollinator as initialPackagePollinator,
  runPollinatorRoute as runPackagePollinatorRoute,
} from "../pollinator-express/model";
import { buildGarden as buildWebGarden } from "../../../packages/discovery-scenes/src/landscape/garden";
import { buildGarden as buildPackageGarden } from "../pollinator-express/garden";
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
  it("pattern package gates both comparisons, resets stale evidence and matches shared geometry", () => {
    expect(packagePatternMarkerComparison()).toEqual(
      sharedPatternMarkerComparison(),
    );
    for (const [sides, copies] of [
      [3, 6],
      [4, 4],
      [5, 3],
      [5, 4],
      [12, 12],
      [2, 3],
      [4.5, 4],
    ])
      expect(packagePatternVertexFit(sides, copies)).toEqual(
        sharedPatternVertexFit(sides, copies),
      );
    for (const [sides, sideLength, startAngle] of [
      [5, 80, -90],
      [3, Number.MIN_VALUE, Number.MAX_VALUE],
      [12, 1_000, -Number.MAX_VALUE],
      [2, 80, 0],
      [13, 80, 0],
      [4.5, 80, 0],
      [4, 0, 0],
      [4, -1, 0],
      [4, 1_000.001, 0],
      [4, Number.NaN, 0],
      [4, Number.POSITIVE_INFINITY, 0],
      [4, 80, Number.NaN],
      [4, 80, Number.NEGATIVE_INFINITY],
      [4, 80, Number.POSITIVE_INFINITY],
    ]) {
      const packageVertices = packageRegularPolygonVertices(
        sides,
        sideLength,
        startAngle,
      );
      expect(packageVertices).toEqual(
        sharedRegularPolygonVertices(sides, sideLength, startAngle),
      );
      if (packageVertices) {
        expect(
          packageVertices.every(
            (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
          ),
        ).toBe(true);
        expect(packageVertices).toEqual(
          packageRegularPolygonVertices(
            sides,
            sideLength,
            ((startAngle % 360) + 360) % 360,
          ),
        );
      }
    }

    for (const point of [
      { x: -30, y: -18 },
      { x: 1e-9, y: -Number.MIN_VALUE },
      { x: Number.MAX_VALUE, y: -Number.MAX_VALUE / 2 },
      { x: Number.NaN, y: 0 },
      { x: 0, y: Number.POSITIVE_INFINITY },
    ])
      for (const rotationDegreesClockwise of [0, 90, 180, 270])
        for (const reflectAcrossVertical of [false, true]) {
          const packagePoint = packageRigidTransformPoint(point, {
            rotationDegreesClockwise,
            reflectAcrossVertical,
          });
          expect(packagePoint).toEqual(
            sharedRigidTransformPoint(point, {
              rotationDegreesClockwise,
              reflectAcrossVertical,
            }),
          );
          if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
            expect(Number.isFinite(packagePoint!.x)).toBe(true);
            expect(Number.isFinite(packagePoint!.y)).toBe(true);
            expect(
              [Math.abs(packagePoint!.x), Math.abs(packagePoint!.y)].sort(),
            ).toEqual([Math.abs(point.x), Math.abs(point.y)].sort());
          }
        }
    for (const rotationDegreesClockwise of [
      -90,
      45,
      90.5,
      360,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])
      expect(
        packageRigidTransformPoint(
          { x: 1, y: 2 },
          { rotationDegreesClockwise, reflectAcrossVertical: false },
        ),
      ).toEqual(
        sharedRigidTransformPoint(
          { x: 1, y: 2 },
          { rotationDegreesClockwise, reflectAcrossVertical: false },
        ),
      );

    const send = worker("pattern-palace");
    let frame = send();
    const textContent = (node: any): string =>
      typeof node === "string"
        ? node
        : (node?.children ?? []).map(textContent).join("");
    const textLabels = (node: any): string[] =>
      node?.tag === "text"
        ? [textContent(node)]
        : (node?.children ?? []).flatMap(textLabels);
    const scaleLabels = frame.vector.nodes.flatMap(textLabels);
    expect(scaleLabels).toEqual(expect.arrayContaining(["0°", "90°", "270°"]));
    expect(scaleLabels).not.toContain("180°");
    expect(
      frame.buttons.find((button: any) => button.id === "compareTransform")
        .disabled,
    ).toBe(true);
    expect(frame.controls).toHaveLength(0);
    send("predictReflection");
    frame = send("compareTransform");
    expect(frame.sections[0].text).toContain(
      "M moved farther right after the reflection",
    );
    send("predictOverlap");
    frame = send("compareCorners");
    expect(frame.sections[1].text).toContain("3 × 108° = 324°");
    expect(frame.sections[1].text).toContain("4 × 108° = 432°");
    expect(frame.controls).toHaveLength(3);
    frame = send("predictTurn");
    expect(frame.sections[0].text).not.toContain("M moved farther right");
    expect(frame.controls).toHaveLength(0);
    frame = send(undefined, undefined, "reset");
    expect(frame.description).toContain("Choose a prediction to begin");
  });
  it("caravan package gates controlled comparisons and matches the shared bounded model", () => {
    expect(PACKAGE_CARAVAN_SEASON_TRIAL).toEqual(SHARED_CARAVAN_SEASON_TRIAL);
    expect(PACKAGE_CARAVAN_ROUTE_TRIAL).toEqual(SHARED_CARAVAN_ROUTE_TRIAL);
    for (const input of [
      SHARED_CARAVAN_SEASON_TRIAL.baseline,
      SHARED_CARAVAN_SEASON_TRIAL.comparison,
      SHARED_CARAVAN_ROUTE_TRIAL.baseline,
      SHARED_CARAVAN_ROUTE_TRIAL.comparison,
      {
        route: "ridge",
        season: "dry",
        cargo: "pottery",
        units: 10,
        supplyDays: 20,
      },
      {
        route: "river",
        season: "wet",
        cargo: "cloth",
        units: 1,
        supplyDays: 0,
      },
      {
        route: "river",
        season: "wet",
        cargo: "grain",
        units: 0,
        supplyDays: 14,
      },
      {
        route: "river",
        season: "wet",
        cargo: "grain",
        units: 6.5,
        supplyDays: 14,
      },
      {
        route: "unknown",
        season: "wet",
        cargo: "grain",
        units: 6,
        supplyDays: 14,
      },
      ...["constructor", "toString", "__proto__"].map((route) => ({
        route,
        season: "wet",
        cargo: "grain",
        units: 6,
        supplyDays: 14,
      })),
      ...["constructor", "toString", "__proto__"].map((cargo) => ({
        route: "river",
        season: "wet",
        cargo,
        units: 6,
        supplyDays: 14,
      })),
    ] as any[])
      expect(calculatePackageCaravanJourney(input)).toEqual(
        calculateSharedCaravanJourney(input),
      );
    for (const inheritedKey of ["constructor", "toString", "__proto__"]) {
      expect(
        calculatePackageCaravanJourney({
          ...PACKAGE_CARAVAN_SEASON_TRIAL.baseline,
          route: inheritedKey,
        } as any),
      ).toBeNull();
      expect(
        calculatePackageCaravanJourney({
          ...PACKAGE_CARAVAN_SEASON_TRIAL.baseline,
          cargo: inheritedKey,
        } as any),
      ).toBeNull();
    }
    expect(
      comparePackageCaravanPlans(
        PACKAGE_CARAVAN_SEASON_TRIAL.baseline,
        PACKAGE_CARAVAN_SEASON_TRIAL.comparison,
      ),
    ).toEqual(
      compareSharedCaravanPlans(
        SHARED_CARAVAN_SEASON_TRIAL.baseline,
        SHARED_CARAVAN_SEASON_TRIAL.comparison,
      ),
    );

    const send = worker("caravan-crossroads");
    let frame = send();
    expect(frame.controls).toHaveLength(0);
    expect(
      frame.buttons.find((button: any) => button.id === "compareSeasons")
        .disabled,
    ).toBe(true);
    send("seasonMore");
    frame = send("compareSeasons");
    expect(frame.sections[0].text).toContain("Wet: 8 days · 6 of 6 delivered");
    expect(frame.sections[0].text).toContain("Dry: 14 days · 4 of 6 delivered");
    expect(frame.sections[0].text).toContain("Changed: season");
    send("routeOasis");
    frame = send("compareRoutes");
    expect(frame.sections[1].text).toContain(
      "Mountain: 9 days · 5 of 6 delivered",
    );
    expect(frame.sections[1].text).toContain(
      "Oasis: 12 days · 6 of 6 delivered",
    );
    expect(frame.sections[1].text).toContain("Changed: route");
    expect(frame.controls.map((control: any) => control.id)).toEqual([
      "route",
      "season",
      "cargo",
      "units",
      "supplyDays",
    ]);
    frame = send("seasonSame");
    expect(frame.sections[0].text).not.toContain("Wet: 8 days");
    expect(frame.controls).toHaveLength(0);
    frame = send(undefined, undefined, "reset");
    expect(frame.description).toContain("Choose a prediction to begin");

    const sceneState = {
      kind: "caravan" as const,
      route: "oasis" as const,
      season: "dry" as const,
      cargo: "pottery" as const,
      units: 6,
      supplies: 12,
      days: 12,
      load: 66,
    };
    const webScene = buildWebCaravan(sceneState);
    const packageScene = buildPackageCaravan(sceneState);
    const signature = (built: typeof webScene) => {
      const objects: unknown[] = [];
      built.group.traverse((object) => {
        const rendered = object as typeof object & {
          geometry?: {
            type: string;
            attributes?: { position?: { count: number } };
          };
          material?: { color?: { getHexString(): string } };
        };
        objects.push({
          type: object.type,
          name: object.name,
          position: object.position.toArray(),
          quaternion: object.quaternion.toArray(),
          scale: object.scale.toArray(),
          geometry: rendered.geometry?.type,
          vertices: rendered.geometry?.attributes?.position?.count,
          color: rendered.material?.color?.getHexString(),
        });
      });
      return { objects, labels: built.labels };
    };
    expect(signature(packageScene)).toEqual(signature(webScene));
    expect(webScene.labels.map((label) => label.text)).toEqual(
      expect.arrayContaining([
        "Mountain Pass",
        "River Road exchange",
        "Oasis Trail exchange",
      ]),
    );
    webScene.group.clear();
    packageScene.group.clear();
  });
  it("sound gates comparisons, separates pitch from amplitude and preserves opt-in audio/animation", () => {
    const send = worker("sound-playground");
    const initial = send();
    expect(initial.vector.description).toContain(
      "Modeled string midpoint displacement over 10 milliseconds: amplitude 3 millimeters and 2.36 cycles.",
    );
    expect(initial.vector.description).toContain(
      "No acoustic radiation is calculated.",
    );
    expect(initial.vector.description).not.toMatch(/pressure/i);
    expect(initial.vector.nodes.at(-1).children[0]).toBe(
      "String midpoint displacement · ±3 mm · 2.36 cycles in 10 ms",
    );
    expect(initial.footnote).toContain(
      "trace is modeled string midpoint displacement in mm over 10 ms",
    );
    expect(initial.footnote).not.toMatch(/pressure trace|air pressure/i);
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
    const moving = send(undefined, undefined, "step", { dt: 0.5 });
    expect(
      moving.controls.find((control: any) => control.id === "phase").value,
    ).toBeGreaterThan(0);
    expect(send("phase", 90).animate).toBe(false);
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
            attributes?: {
              position?: { count: number; array?: ArrayLike<number> };
            };
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
  it("bridge package gates controlled evidence and labels the brace index honestly", () => {
    const send = worker("bridge-builder");
    const initial = send();
    expect(initial.controls).toHaveLength(0);
    expect(
      initial.buttons.find((button: any) => button.id === "comparePosition")
        .disabled,
    ).toBe(true);
    send("positionLeft");
    let compared = send("comparePosition");
    expect(compared.sections[0].text).toContain("matches your prediction");
    expect(compared.sections[0].text).toContain(
      "Center: left 6.0 kN · right 6.0 kN · peak moment 30.0 kN·m · deflection at load 2.50 mm",
    );
    expect(compared.sections[0].text).toContain("Changed: load position");
    send("loadBothDouble");
    compared = send("compareLoad");
    expect(compared.sections[1].text).toContain("matches your prediction");
    expect(compared.sections[1].text).toContain(
      "8 kN: 20.0 kN·m and 1.67 mm · 16 kN: 40.0 kN·m and 3.33 mm",
    );
    expect(compared.controls.map((control: any) => control.id)).toEqual([
      "position",
      "load",
      "rigidity",
      "brace0",
      "brace1",
      "brace2",
      "brace3",
      "phase",
    ]);
    const left = compared.description.match(/Left reaction ([\d.]+) kN/)?.[1];
    const moment = compared.description.match(/peak moment ([\d.]+) kN·m/)?.[1];
    const braced = send("brace1", 1);
    expect(braced.description).toContain(`Left reaction ${left} kN`);
    expect(braced.description).toContain(`peak moment ${moment} kN·m`);
    expect(braced.footnote).toContain(
      "invented comparison index, not a capacity or safety rating",
    );
    expect(send("play").animate).toBe(true);
    expect(
      send(undefined, undefined, "reset").buttons.find(
        (button: any) => button.id === "comparePosition",
      ).disabled,
    ).toBe(true);
  });

  it("bridge package keeps one deflection scale so 16 kN renders twice the 8 kN profile depth", () => {
    const send = worker("bridge-builder");
    send();
    send("positionLeft");
    send("comparePosition");
    send("loadBothDouble");
    send("compareLoad");
    const profileDepth = (output: any) => {
      const points = output.vector.nodes
        .find((node: any) => node.tag === "polyline")
        .attrs.points.split(" ")
        .map((point: string) => Number(point.split(",")[1]));
      return Math.max(...points) - 28;
    };

    const light = send("showLoadLight");
    const heavy = send("showLoadHeavy");
    const lightDepth = profileDepth(light);
    const heavyDepth = profileDepth(heavy);

    expect(lightDepth).toBeGreaterThan(0);
    expect(heavyDepth).toBeCloseTo(lightDepth * 2, 5);
    expect(heavy.vector.description).toMatch(
      /fixed deflection scale across every state.*0–12\.5 millimeters/i,
    );
  });

  it("bridge package model exactly mirrors shared boundaries and outputs", () => {
    expect(PACKAGE_BRIDGE_DEFAULTS).toEqual(SHARED_BRIDGE_DEFAULTS);
    expect(PACKAGE_BRIDGE_VISUAL_MAX).toBe(SHARED_BRIDGE_VISUAL_MAX);
    for (const inputs of [
      SHARED_BRIDGE_DEFAULTS,
      {
        pointLoadKilonewtons: 30,
        loadPositionPercent: 5,
        flexuralRigidityMeganewtonMetersSquared: 250,
        braces: [true, false, true, false],
      },
      {
        pointLoadKilonewtons: Number.NaN,
        loadPositionPercent: Infinity,
        flexuralRigidityMeganewtonMetersSquared: -10,
        braces: [true],
      },
    ]) {
      expect(normalizePackageBridge(inputs)).toEqual(
        normalizeSharedBridge(inputs),
      );
      expect(packageBridgeActivity(inputs)).toEqual(
        sharedBridgeActivity(inputs),
      );
    }
    for (const value of [0, 1.67, 3.33, 12.5, 99, Number.NaN])
      expect(packageBridgeVisualFraction(value)).toBe(
        sharedBridgeVisualFraction(value),
      );
    for (const position of [0, 2.5, 5, 7.5, 10])
      expect(packageBridgeProfileAt(20, 1.024, position)).toBe(
        sharedBridgeProfileAt(20, 1.024, position),
      );
  });
  it("bridge package and web preserve the same dimensional scene geometry", () => {
    const activity = sharedBridgeActivity(SHARED_BRIDGE_DEFAULTS);
    const state = {
      kind: "bridge" as const,
      material: "timber" as const,
      braces: activity.inputs.braces,
      load: activity.inputs.pointLoadKilonewtons,
      position: activity.inputs.loadPositionPercent,
      utilization: activity.braceReferenceUseIndex,
      leftReaction: activity.leftReactionKilonewtons,
      rightReaction: activity.rightReactionKilonewtons,
      progress: 0.25,
      deflectionMillimeters: activity.deflectionAtLoadMillimeters,
    };
    const web = createWebBridgeScene(state);
    const packaged = createPackageBridgeScene(state);
    const signature = (scene: typeof web) => {
      const objects: unknown[] = [];
      scene.group.traverse((object) => {
        const mesh = object as typeof object & {
          geometry?: {
            type: string;
            attributes?: {
              position?: { count: number; array?: ArrayLike<number> };
            };
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
          authoredPositions:
            object.name === "bridge-deflection-profile"
              ? Array.from(mesh.geometry?.attributes?.position?.array ?? [])
              : undefined,
          color: mesh.material?.color?.getHexString(),
          emissive: mesh.material?.emissive?.getHexString(),
          visible: object.visible,
        });
      });
      return { objects, labels: scene.labels?.(), view: scene.view };
    };
    expect(signature(packaged)).toEqual(signature(web));
    const nextActivity = sharedBridgeActivity({
      pointLoadKilonewtons: 24,
      loadPositionPercent: 25,
      flexuralRigidityMeganewtonMetersSquared: 150,
      braces: [true, false, true, false],
    });
    const next = {
      ...state,
      braces: nextActivity.inputs.braces,
      load: nextActivity.inputs.pointLoadKilonewtons,
      position: nextActivity.inputs.loadPositionPercent,
      utilization: nextActivity.braceReferenceUseIndex,
      leftReaction: nextActivity.leftReactionKilonewtons,
      rightReaction: nextActivity.rightReactionKilonewtons,
      progress: 0.63,
      deflectionMillimeters: nextActivity.deflectionAtLoadMillimeters,
    };
    web.update(next);
    packaged.update(next);
    expect(signature(packaged)).toEqual(signature(web));
    web.dispose();
    packaged.dispose();
  });
  it("river package mirrors the shared bounded model", () => {
    for (const inputs of [
      SHARED_RIVER_DEFAULTS,
      {
        catchmentSlopePercent: 0,
        rainfallMillimeters: 0,
        vegetationCoverPercent: 100,
      },
      {
        catchmentSlopePercent: 20,
        rainfallMillimeters: 100,
        vegetationCoverPercent: 0,
      },
      {
        catchmentSlopePercent: Number.NaN,
        rainfallMillimeters: Infinity,
        vegetationCoverPercent: -5,
      },
    ]) {
      expect(normalizePackageRiver(inputs)).toEqual(
        normalizeSharedRiver(inputs),
      );
      expect(packageRiverActivity(inputs)).toEqual(sharedRiverActivity(inputs));
    }
    expect(PACKAGE_RIVER_DEFAULTS).toEqual(SHARED_RIVER_DEFAULTS);
    expect(PACKAGE_RIVER_LEDGER).toEqual(SHARED_RIVER_LEDGER);
    expect(packageRiverStateAtPhase(PACKAGE_RIVER_DEFAULTS, 2.25)).toEqual(
      sharedRiverStateAtPhase(SHARED_RIVER_DEFAULTS, 2.25),
    );
    expect(
      applyPackageRiverStorm(PACKAGE_RIVER_DEFAULTS, PACKAGE_RIVER_LEDGER),
    ).toEqual(
      applySharedRiverStorm(SHARED_RIVER_DEFAULTS, SHARED_RIVER_LEDGER),
    );
  });
  it("river package and web preserve the same dimensional scene geometry", () => {
    const activity = sharedRiverStateAtPhase(SHARED_RIVER_DEFAULTS, 0.35);
    const state = {
      kind: "river" as const,
      slope: activity.catchmentSlopePercent,
      rain: activity.rainfallMillimeters,
      vegetation: activity.vegetationCoverPercent,
      runoff: activity.runoffCubicMeters,
      infiltration: activity.infiltrationCubicMeters,
      eroded: activity.soilMovedKilograms,
      flood: activity.channelCapacityExcessCubicMeters,
      deposited: 48,
      exported: 22,
      soil: 4930,
      phase: activity.visualPhase,
    };
    const web = buildWebRiver(state);
    const packaged = buildPackageRiver(state);
    const signature = (built: typeof web) => {
      const objects: unknown[] = [];
      built.group.traverse((object) => {
        const mesh = object as typeof object & {
          geometry?: {
            type: string;
            attributes?: { position?: { count: number } };
          };
          material?: { color?: { getHexString(): string } };
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
        });
      });
      return { objects, labels: built.labels };
    };
    expect(signature(packaged)).toEqual(signature(web));
    web.group.clear();
    packaged.group.clear();
  });
  it("river gates comparisons, conserves soil and restore preserves controls", () => {
    const send = worker("river-sculptor");
    const initial = send();
    expect(initial.controls).toHaveLength(0);
    expect(
      initial.buttons.find((button: any) => button.id === "compareVegetation")
        .disabled,
    ).toBe(true);
    send("vegetationBoth");
    let o: any = send("compareVegetation");
    expect(
      o.buttons.find((button: any) => button.id === "compareVegetation")
        .disabled,
    ).toBe(true);
    expect(o.sections[0].text).toContain("matches your prediction");
    expect(o.sections[0].text).toContain("Bare: runoff 320.0 m³");
    send("slopeSoil");
    o = send("compareSlope");
    expect(
      o.buttons.find((button: any) => button.id === "compareSlope").disabled,
    ).toBe(true);
    expect(o.sections[1].text).toContain("matches your prediction");
    expect(o.sections[1].text).toContain("20% slope: runoff 232.0 m³");
    expect(o.controls).toHaveLength(4);
    send("rain", 100);
    send("vegetation", 0);
    for (let n = 0; n < 20; n++) o = send("storm");
    expect(o.description).toContain("Total 5000.0 kg");
    o = send("restore");
    expect(o.description).toContain("Soil remaining 5000.0");
    expect(o.controls.find((c: any) => c.id === "rain").value).toBe(100);
    expect(send("play").animate).toBe(true);
    expect(send("phase", 90).animate).toBe(false);
  }, 30000);
  it("circuit package exactly mirrors the shared bounded ideal-resistor model", () => {
    expect(PACKAGE_CIRCUIT_DEFAULTS).toEqual(SHARED_CIRCUIT_DEFAULTS);
    expect(PACKAGE_CIRCUIT_SWITCH_COMPARISON).toEqual(
      SHARED_CIRCUIT_SWITCH_COMPARISON,
    );
    expect(PACKAGE_CIRCUIT_VOLTAGE_COMPARISON).toEqual(
      SHARED_CIRCUIT_VOLTAGE_COMPARISON,
    );
    for (const inputs of [
      SHARED_CIRCUIT_DEFAULTS,
      ...SHARED_CIRCUIT_SWITCH_COMPARISON,
      ...SHARED_CIRCUIT_VOLTAGE_COMPARISON,
      {
        mode: "parallel" as const,
        sourceVoltageVolts: Number.NaN,
        switches: [true, false] as unknown as readonly [
          boolean,
          boolean,
          boolean,
        ],
      },
    ]) {
      expect(normalizePackageCircuit(inputs)).toEqual(
        normalizeSharedCircuit(inputs),
      );
      expect(packageCircuitActivity(inputs)).toEqual(
        sharedCircuitActivity(inputs),
      );
    }
    expect(packageCircuitStateAtPhase(PACKAGE_CIRCUIT_DEFAULTS, 2.25)).toEqual(
      sharedCircuitStateAtPhase(SHARED_CIRCUIT_DEFAULTS, 2.25),
    );
  });
  it("circuit package and web preserve identical dimensional scene geometry", () => {
    const activity = sharedCircuitStateAtPhase(
      SHARED_CIRCUIT_VOLTAGE_COMPARISON[1],
      0.35,
    );
    const state = {
      kind: "circuit" as const,
      mode: activity.mode,
      switches: [...activity.switches],
      power: activity.housePowerWatts,
      current: activity.houseCurrentAmperes,
      voltage: activity.sourceVoltageVolts,
      phase: activity.visualPhase,
    };
    const web = createWebCircuitScene(state);
    const packaged = createPackageCircuitScene(state);
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
            emissiveIntensity?: number;
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
          emissiveIntensity: mesh.material?.emissiveIntensity,
        });
      });
      return { objects, labels: scene.labels?.(), view: scene.view };
    };
    expect(signature(packaged)).toEqual(signature(web));
    const next = { ...state, phase: 0.75 };
    web.update(next);
    packaged.update(next);
    expect(signature(packaged)).toEqual(signature(web));
    web.dispose();
    packaged.dispose();
  });
  it("circuit gates two fair comparisons and exposes charge and energy evidence", () => {
    const send = worker("circuit-city");
    const initial = send();
    expect(initial.controls).toHaveLength(0);
    expect(
      initial.buttons.find((button: any) => button.id === "comparePath")
        .disabled,
    ).toBe(true);
    send("pathSeriesOff");
    let output = send("comparePath");
    expect(output.sections[0].text).toContain("matches your prediction");
    expect(output.sections[0].text).toContain(
      "Series: 0.00 A source current · houses 0.0, 0.0, 0.0 W",
    );
    send("voltageQuadratic");
    output = send("compareVoltage");
    expect(output.sections[1].text).toContain("matches your prediction");
    expect(output.sections[1].text).toContain(
      "6 V: each house 0.50 A · 3.0 W · 30.0 J in 10 s",
    );
    expect(output.controls.map((control: any) => control.id)).toEqual([
      "mode",
      "voltage",
      "switch0",
      "switch1",
      "switch2",
      "phase",
    ]);
    expect(output.description).toContain(
      "Charge in 10 s: 30.0 C leaves the source and 30.0 C returns",
    );
    expect(output.description).toContain(
      "Energy in 10 s: 360.0 J supplied = 360.0 J transferred",
    );
    expect(send("play").animate).toBe(true);
    expect(send("phase", 90).animate).toBe(false);
    expect(send(undefined, undefined, "reset").controls).toHaveLength(0);
  }, 30000);
  it("food-web package exactly mirrors shared bounded model and comparisons", () => {
    expect(PACKAGE_POND_INITIAL).toEqual(SHARED_POND_INITIAL);
    expect(PACKAGE_POND_CONDITIONS).toEqual(SHARED_POND_CONDITIONS);
    expect(PACKAGE_POND_PREDATOR_COMPARISON).toEqual(
      SHARED_POND_PREDATOR_COMPARISON,
    );
    expect(PACKAGE_POND_NUTRIENT_COMPARISON).toEqual(
      SHARED_POND_NUTRIENT_COMPARISON,
    );
    for (const state of [
      SHARED_POND_INITIAL,
      { algae: 0, zooplankton: 0, fish: 0, oxygen: 0, detritus: 0 },
      {
        algae: 999,
        zooplankton: -1,
        fish: 40,
        oxygen: Infinity,
        detritus: Number.NaN,
      },
    ]) {
      expect(normalizePackagePondState(state)).toEqual(
        normalizeSharedPondState(state),
      );
      expect(advancePackagePond(state, { nutrients: 77, drought: 44 })).toEqual(
        advanceSharedPond(state, { nutrients: 77, drought: 44 }),
      );
    }
    const malformed = { nutrients: Number.NaN, drought: Infinity };
    expect(normalizePackagePondConditions(malformed)).toEqual(
      normalizeSharedPondConditions(malformed),
    );
    for (const scenario of [
      ...SHARED_POND_PREDATOR_COMPARISON,
      ...SHARED_POND_NUTRIENT_COMPARISON,
    ])
      expect(runPackagePondTrial(scenario)).toEqual(
        runSharedPondTrial(scenario),
      );
    expect(
      packagePondStateAtPhase(
        PACKAGE_POND_INITIAL,
        PACKAGE_POND_CONDITIONS,
        2.25,
      ),
    ).toEqual(
      sharedPondStateAtPhase(SHARED_POND_INITIAL, SHARED_POND_CONDITIONS, 2.25),
    );
  });
  it("food-web package and web preserve identical dimensional pond geometry", () => {
    const visual = sharedPondStateAtPhase(
      SHARED_POND_INITIAL,
      SHARED_POND_CONDITIONS,
      0.42,
    );
    const state = { kind: "pond" as const, ...visual };
    const web = buildWebPond(state);
    const packaged = buildPackagePond(state);
    const signature = (built: typeof web) => {
      const objects: unknown[] = [];
      built.group.traverse((object) => {
        const mesh = object as typeof object & {
          geometry?: {
            type: string;
            attributes?: { position?: { count: number } };
          };
          material?: {
            color?: { getHexString(): string };
            emissive?: { getHexString(): string };
            emissiveIntensity?: number;
          };
        };
        objects.push({
          type: object.type,
          name: object.name,
          position: object.position.toArray(),
          quaternion: object.quaternion.toArray(),
          scale: object.scale.toArray(),
          geometry: mesh.geometry?.type,
          vertices: mesh.geometry?.attributes?.position?.count,
          color: mesh.material?.color?.getHexString(),
          emissive: mesh.material?.emissive?.getHexString(),
          emissiveIntensity: mesh.material?.emissiveIntensity,
        });
      });
      return { objects, labels: built.labels };
    };
    expect(signature(packaged)).toEqual(signature(web));
    web.group.clear();
    packaged.group.clear();
  });
  it("food-web package gates two fair comparisons and supports static or opt-in flow markers", () => {
    const send = worker("food-web-rescue");
    const initial = send();
    expect(initial.controls).toHaveLength(0);
    expect(
      initial.buttons.find((button: any) => button.id === "comparePredator")
        .disabled,
    ).toBe(true);
    send("predatorCascade");
    let output = send("comparePredator");
    expect(output.sections[0].text).toContain("matches your prediction");
    expect(output.sections[0].text).toContain(
      "Fish absent: algae 10.6 · zooplankton 56.6",
    );
    expect(output.sections[0].text).toContain("Changed: fish presence");
    send("nutrientFishLower");
    output = send("compareNutrients");
    expect(output.sections[1].text).toContain("matches your prediction");
    expect(output.sections[1].text).toContain("High nutrients: algae 40.9");
    expect(output.sections[1].text).toContain("oxygen 45.7");
    expect(output.controls.map((control: any) => control.id)).toEqual([
      "nutrients",
      "drought",
      "algae",
      "zooplankton",
      "fish",
      "phase",
    ]);
    expect(send("play").animate).toBe(true);
    expect(send("phase", 70).animate).toBe(false);
    expect(send("fish", 0).description).toContain("fish 0.0");
    expect(send("advanceWeek").description).toContain("model week 9");
    expect(send(undefined, undefined, "reset").controls).toHaveLength(0);
  }, 30000);
  it("fraction package mirrors shared exact bounded arithmetic", () => {
    for (const [numerator, denominator] of [
      [0, 1],
      [2, -4],
      [-2, -4],
      [96, 96],
      [97, 2],
      [1, 0],
      [Number.NaN, 2],
      [1, Number.POSITIVE_INFINITY],
    ])
      expect(normalizePackageFraction(numerator, denominator)).toEqual(
        normalizeSharedFraction(numerator, denominator),
      );
    for (const values of [
      [2, 3, 3, 4],
      [1, 6, 1, 3],
      [0, 2, 0, 12],
      [-3, 2, 0, 1],
      [-1, 2, 0, 1],
      [96, 96, 48, 96],
      [1, 95, 1, 96],
      [1, 0, 1, 2],
    ] as const)
      expect(addPackageFractionParts(...values)).toEqual(
        addSharedFractionParts(...values),
      );

    for (const values of [
      [-3, 2, 0, 1],
      [-3, 2, 1, 4],
      [1, 2, -3, 2],
      [-1, 2, 0, 1],
    ] as const) {
      const addition = addPackageFractionParts(...values)!;
      expect(
        addition.wholeCount +
          addition.remainder.numerator / addition.remainder.denominator,
      ).toBe(addition.sum.numerator / addition.sum.denominator);
      expect(Object.is(addition.wholeCount, -0)).toBe(false);
      expect(Object.is(addition.remainder.numerator, -0)).toBe(false);
    }
  });
  it("fraction package and web preserve identical dimensional pizza geometry", () => {
    const plates = [
      { n: 2, d: 3, slices: [0, 1] },
      { n: 3, d: 4, slices: [0, 1, 2] },
    ];
    const web = buildWebPizzaScene(plates, 0, false);
    const packaged = buildPackagePizzaScene(plates, 0, false);
    const signature = (group: typeof web) => {
      const objects: unknown[] = [];
      group.traverse((object) => {
        const mesh = object as typeof object & {
          geometry?: {
            type: string;
            attributes?: {
              position?: { count: number; array?: ArrayLike<number> };
            };
            index?: { array?: ArrayLike<number> } | null;
          };
          material?: {
            color?: { getHexString(): string };
            roughness?: number;
            metalness?: number;
          };
        };
        objects.push({
          type: object.type,
          position: object.position.toArray(),
          quaternion: object.quaternion.toArray(),
          scale: object.scale.toArray(),
          slice: object.userData.slice,
          plate: object.userData.plate,
          cutBoundary: object.userData.cutBoundary,
          geometry: mesh.geometry?.type,
          vertices: mesh.geometry?.attributes?.position?.count,
          positions: Array.from(
            mesh.geometry?.attributes?.position?.array ?? [],
          ),
          indices: Array.from(mesh.geometry?.index?.array ?? []),
          color: mesh.material?.color?.getHexString(),
          roughness: mesh.material?.roughness,
          metalness: mesh.material?.metalness,
        });
      });
      return objects;
    };
    expect(signature(packaged)).toEqual(signature(web));
    web.clear();
    packaged.clear();
  });
  it("fractions preserve sparse slices under splitting and show sums beyond one", () => {
    const send = worker("fraction-feast");
    const initial = send();
    expect(initial.controls).toHaveLength(0);
    expect(
      initial.buttons.find((button: any) => button.id === "compareEquivalent")
        .disabled,
    ).toBe(true);
    send("equivalentSame");
    let output = send("compareEquivalent");
    expect(output.sections[0].text).toContain("1/2 = 2/4");
    expect(output.sections[0].text).toContain(
      "Changed: piece count · piece size",
    );
    send("additionAbove");
    output = send("compareAddition");
    expect(output.sections[1].text).toContain("2/3 = 8/12");
    expect(output.sections[1].text).toContain("17/12 = 1 whole and 5/12");
    expect(output.controls).not.toHaveLength(0);

    output = send("equivalentMore");
    expect(output.controls).toHaveLength(0);
    expect(output.sections[0].text).not.toContain("1/2 = 2/4");
    send("equivalentSame");
    output = send("compareEquivalent");
    expect(output.controls).not.toHaveLength(0);

    send("showEquivalentBefore");
    send("slice", 2);
    send("toggleSlice");
    expect(send("split").description).toContain("Plate A 4/4");
    send("showAdditionParts");
    const o = send("combine");
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
  it("pollinator package mirrors the bounded model and gates controlled evidence", () => {
    expect(PACKAGE_POLLINATOR_FLOWERS).toEqual(SHARED_POLLINATOR_FLOWERS);
    expect(PACKAGE_POLLINATOR_COMPATIBILITY_TARGETS).toEqual(
      SHARED_POLLINATOR_COMPATIBILITY_TARGETS,
    );
    expect(PACKAGE_POLLINATOR_ASSUMPTIONS).toEqual(
      SHARED_POLLINATOR_ASSUMPTIONS,
    );
    expect(PACKAGE_POLLINATOR_COMPATIBILITY_TRIAL).toEqual(
      SHARED_POLLINATOR_COMPATIBILITY_TRIAL,
    );
    expect(PACKAGE_POLLINATOR_HABITAT_TRIAL).toEqual(
      SHARED_POLLINATOR_HABITAT_TRIAL,
    );
    expect(
      comparePackagePollinatorRoutes(
        PACKAGE_POLLINATOR_COMPATIBILITY_TRIAL.baseline,
        PACKAGE_POLLINATOR_COMPATIBILITY_TRIAL.comparison,
      ),
    ).toEqual(
      compareSharedPollinatorRoutes(
        SHARED_POLLINATOR_COMPATIBILITY_TRIAL.baseline,
        SHARED_POLLINATOR_COMPATIBILITY_TRIAL.comparison,
      ),
    );
    expect(
      comparePackagePollinatorRoutes(
        PACKAGE_POLLINATOR_HABITAT_TRIAL.baseline,
        PACKAGE_POLLINATOR_HABITAT_TRIAL.comparison,
      ),
    ).toEqual(
      compareSharedPollinatorRoutes(
        SHARED_POLLINATOR_HABITAT_TRIAL.baseline,
        SHARED_POLLINATOR_HABITAT_TRIAL.comparison,
      ),
    );
    expect(initialPackagePollinator()).toEqual(initialSharedPollinator());
    const initial = initialSharedPollinator();
    const malformedStates = [
      ...[
        undefined,
        7,
        {},
        { species: "gold" },
        { species: "gold", sourceId: "c" },
      ].map((pollen) => ({ ...initial, pollen })),
      {
        ...initial,
        x: Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        path: [{ x: Number.MAX_VALUE, y: Number.MAX_VALUE }],
      },
      { ...initial, x: 140, y: 250 },
      { ...initial, visits: Number.MAX_SAFE_INTEGER },
      { ...initial, visits: Number.MAX_SAFE_INTEGER + 1 },
    ];
    const visitInputs = [
      { state: initial, flowerId: "a", reach: 170, habitat: false },
      { state: initial, flowerId: "bridge-a", reach: 170, habitat: false },
      { state: initial, flowerId: "d", reach: 170, habitat: false },
      ...["constructor", "toString", "__proto__"].map((flowerId) => ({
        state: initial,
        flowerId,
        reach: 170,
        habitat: false,
      })),
      ...malformedStates.map((state) => ({
        state,
        flowerId: "a",
        reach: 170,
        habitat: false,
      })),
    ];
    for (const input of visitInputs) {
      expect(() => calculatePackagePollinatorVisit(input as any)).not.toThrow();
      expect(calculatePackagePollinatorVisit(input as any)).toEqual(
        calculateSharedPollinatorVisit(input as any),
      );
    }
    for (const length of [23, 24, 25]) {
      const route = {
        reach: 170,
        habitat: false,
        flowerIds: Array.from({ length }, () => "a"),
      };
      expect(runPackagePollinatorRoute(route)).toEqual(
        runSharedPollinatorRoute(route),
      );
    }
    const gardenState = {
      kind: "garden" as const,
      x: 230,
      y: 195,
      reach: 170,
      habitat: true,
      pollen: "violet" as const,
      trialSpecies: "violet" as const,
      received: [1],
      path: [
        { x: 70, y: 320 },
        { x: 140, y: 250 },
        { x: 230, y: 195 },
      ],
    };
    const webGarden = buildWebGarden(gardenState);
    const packageGarden = buildPackageGarden(gardenState);
    const gardenSignature = (built: typeof webGarden) => {
      const objects: unknown[] = [];
      built.group.traverse((object) => {
        const rendered = object as typeof object & {
          geometry?: {
            type: string;
            attributes?: { position?: { count: number } };
          };
          material?: { color?: { getHexString(): string } };
        };
        objects.push({
          type: object.type,
          name: object.name,
          position: object.position.toArray(),
          quaternion: object.quaternion.toArray(),
          scale: object.scale.toArray(),
          geometry: rendered.geometry?.type,
          vertices: rendered.geometry?.attributes?.position?.count,
          color: rendered.material?.color?.getHexString(),
        });
      });
      return { objects, labels: built.labels };
    };
    expect(gardenSignature(packageGarden)).toEqual(gardenSignature(webGarden));
    const evidenceColors: string[] = [];
    webGarden.group.traverse((object) => {
      const rendered = object as typeof object & {
        material?: { color?: { getHexString(): string } };
      };
      const color = rendered.material?.color?.getHexString();
      if (color) evidenceColors.push(color);
    });
    expect(evidenceColors).toContain("162c29");
    expect(evidenceColors).toContain("fff0a8");
    expect(evidenceColors).toContain("142826");
    expect(evidenceColors).toContain("f7f5d4");
    expect(webGarden.labels.map((label) => label.text)).toContain(
      "Trial flower · Violet type ✓",
    );
    webGarden.group.clear();
    packageGarden.group.clear();

    const send = worker("pollinator-express");
    let frame = send();
    expect(frame.controls).toHaveLength(0);
    expect(
      frame.buttons.find((button: any) => button.id === "compareFlowers")
        .disabled,
    ).toBe(true);
    send("predictGold");
    frame = send("compareFlowers");
    expect(frame.sections[0].text).toContain(
      "Gold 1 → fixed Gold trial flower: 2 visits · 1 compatible transfer",
    );
    expect(frame.sections[0].text).toContain(
      "Gold 1 → fixed Violet trial flower: 2 visits · 0 compatible transfers",
    );
    send("predictWith");
    frame = send("compareHabitat");
    expect(frame.sections[1].text).toContain("Without habitat: Gold 3 blocked");
    expect(frame.sections[1].text).toContain("With habitat: Gold 3 reached");
    expect(frame.sections[1].text).toContain(
      "Changed: one bridge habitat patch containing a Gold and a Violet flower",
    );
    expect(frame.sections[1].text).toContain(
      "The fixed planned route uses the Gold bridge stop",
    );
    expect(frame.controls.map((control: any) => control.id)).toEqual([
      "reach",
      "habitat",
    ]);
    frame = send("predictViolet");
    expect(frame.sections[0].text).not.toContain(
      "Gold 1 → fixed Gold trial flower: 2 visits",
    );
    expect(frame.controls).toHaveLength(0);
    expect(send(undefined, undefined, "reset").description).toContain(
      "Choose a prediction to begin",
    );
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
    send("equivalentSame");
    send("compareEquivalent");
    send("additionAbove");
    send("compareAddition");
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
  it("fractions: stale slice is clamped and changed predictions relock exploration", () => {
    const send = worker("fraction-feast");
    send();
    send("equivalentSame");
    send("compareEquivalent");
    send("additionAbove");
    send("compareAddition");
    send("denominator", 7);
    send("slice", 24);
    send("denominator", 0);
    send("numerator", 2);
    expect(send("toggleSlice").description).toContain("Plate A 1/2");
    const stale = send("equivalentMore");
    expect(stale.controls).toHaveLength(0);
    expect(stale.vector).toBeUndefined();
    expect(send("combine").vector).toBeUndefined();
    send("equivalentSame");
    const restored = send("compareEquivalent");
    expect(restored.controls).not.toHaveLength(0);
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
