import { describe, expect, it } from "vitest";
import {
  sceneStateScript,
  validSceneState,
  type OfflineSceneState,
} from "@family-manager/discovery-scenes/protocol";
import {
  defaultMachineState,
  defaultHeatState,
  defaultPressureState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import {
  initialPlate,
  initialCloud,
  initialMagnetic,
  advancePlate,
} from "@family-manager/family-api/discovery-models/expansion-earth";
import {
  defaultCellExplorerState,
  defaultShapeSlicerState,
  defaultAdaptationIslandState,
  nextIslandGeneration,
} from "@family-manager/family-api/discovery-models/expansion-life-geometry";
const states: OfflineSceneState[] = [
  { kind: "machine-workshop", ...defaultMachineState },
  { kind: "heat-house", ...defaultHeatState },
  { kind: "pressure-tank", ...defaultPressureState },
  { kind: "moving-plates", ...initialPlate },
  { kind: "cloud-rain-lab", ...initialCloud },
  { kind: "magnetic-fields", ...initialMagnetic },
  { kind: "cell-explorer", ...defaultCellExplorerState },
  { kind: "shape-slicer", ...defaultShapeSlicerState },
  { kind: "adaptation-island", ...defaultAdaptationIslandState },
];
describe("bounded nine-topic offline expansion protocol", () => {
  it.each(states)(
    "accepts public $kind state and rejects private or executable extras",
    (state) => {
      expect(validSceneState(state)).toBe(true);
      expect(sceneStateScript(state)).not.toBeNull();
      for (const key of [
        "url",
        "childId",
        "auth",
        "token",
        "script",
        "html",
        "command",
      ])
        expect(validSceneState({ ...state, [key]: "private-value" })).toBe(
          false,
        );
      for (const [key, value] of Object.entries(state)) {
        const missing = { ...state } as Record<string, unknown>;
        delete missing[key];
        expect(validSceneState(missing)).toBe(false);
        if (typeof value === "number")
          for (const bad of [
            NaN,
            Infinity,
            -Infinity,
            1e100,
            -1e100,
            "12",
            null,
          ])
            expect(validSceneState({ ...state, [key]: bad })).toBe(false);
        if (typeof value === "string")
          expect(
            validSceneState({ ...state, [key]: "https://example.com" }),
          ).toBe(false);
        if (typeof value === "boolean")
          expect(validSceneState({ ...state, [key]: 1 })).toBe(false);
      }
    },
  );
  it("accepts boundary states and fractional expected population proportions", () => {
    for (const state of [
      { ...states[0], advantage: 1, liftM: 0, loadKg: 10 },
      { ...states[0], advantage: 4, liftM: 1, loadKg: 100 },
      { ...states[1], insulationCm: 0, windowM2: 18, outsideC: -5 },
      { ...states[2], depthM: 0.2, outletM: 2.5 },
      {
        ...states[3],
        ...advancePlate({ ...initialPlate, boundary: "transform" }, 20),
      },
      {
        ...states[4],
        temperatureC: 20,
        vaporGPerKg: 14,
        upliftM: 0,
        dropletGrowth: 100,
      },
      { ...states[5], gap: 0.5, probeX: -6, probeZ: 4 },
      { ...states[6], inside: 20, outside: 0 },
      { ...states[7], tilt: 90, turn: 90, offset: -1.75 },
      {
        kind: "adaptation-island",
        ...nextIslandGeneration(defaultAdaptationIslandState),
      },
    ])
      expect(validSceneState(state)).toBe(true);
  });
  it("rejects fractional machine ratios, invalid populations and unknown kinds", () => {
    for (const state of [
      { ...states[0], advantage: 1.5 },
      { ...states[3], slips: 0.5 },
      { ...states[8], generation: 1.5 },
      { ...states[8], darkCount: 90, lightCount: 90 },
      { kind: "dig-through-time" },
    ])
      expect(validSceneState(state)).toBe(false);
  });
});
