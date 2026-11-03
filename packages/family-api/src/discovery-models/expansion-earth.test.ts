import { describe, expect, it } from "vitest";
import {
  advancePlate,
  initialMagnetic,
  initialPlate,
  magneticFieldAt,
  magneticResult,
  normalizeMagnetic,
  normalizePlate,
  plateResult,
} from "./expansion-earth";

describe("plate boundary teaching model", () => {
  it("builds and releases the transform loading index", () => {
    const start = {
      ...initialPlate,
      boundary: "transform" as const,
      loadingStep: 0,
    };
    const before = advancePlate(start, 4),
      after = advancePlate(before);
    expect(plateResult(before).elasticLoadingPercent).toBe(80);
    expect(plateResult(after).elasticLoadingPercent).toBe(0);
    expect(after.slips).toBe(1);
  });
  it("does not pretend to predict earthquakes at the other boundaries", () => {
    expect(advancePlate(initialPlate, 10).slips).toBe(0);
    expect(
      plateResult({ ...initialPlate, boundary: "convergent" }).feature,
    ).toContain("subduction");
  });
  it("bounds repeated steps and handles nonfinite inputs", () => {
    let state = { ...initialPlate, boundary: "transform" as const };
    for (let i = 0; i < 500; i++) state = advancePlate(state);
    expect(state.slips).toBe(20);
    expect(
      normalizePlate({
        ...state,
        rateCmPerYear: NaN,
        elapsedMillionYears: Infinity,
      }).rateCmPerYear,
    ).toBe(4);
    expect(advancePlate(initialPlate, -2)).toEqual(initialPlate);
  });
});
describe("magnet field and compass", () => {
  it("distinguishes facing opposite and like poles", () => {
    expect(magneticResult(initialMagnetic).interaction).toBe("attract");
    expect(
      magneticResult({ ...initialMagnetic, flipped: true }).interaction,
    ).toBe("repel");
    expect(magneticFieldAt(initialMagnetic, 0, 0).x).toBeGreaterThan(0);
  });
  it("has a null midway between identical facing poles and never invents a direction there", () => {
    expect(
      magneticResult({
        ...initialMagnetic,
        flipped: true,
        probeX: 0,
        probeZ: 0,
      }).direction,
    ).toBeNull();
  });
  it("weakens the relative interaction with distance and excludes probes inside bars", () => {
    expect(
      magneticResult({ ...initialMagnetic, gap: 4 }).interactionIndex,
    ).toBeLessThan(magneticResult(initialMagnetic).interactionIndex);
    expect(
      magneticResult({ ...initialMagnetic, probeX: -2, probeZ: 0 })
        .insideMagnet,
    ).toBe(true);
    expect(normalizeMagnetic({ ...initialMagnetic, gap: -20 }).gap).toBe(0.5);
    expect(
      Number.isFinite(magneticFieldAt(initialMagnetic, -1, 0).strength),
    ).toBe(true);
  });
});
