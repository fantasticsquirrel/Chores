import { describe, expect, it } from "vitest";
import {
  advancePlate,
  cloudResult,
  initialCloud,
  initialMagnetic,
  initialPlate,
  magneticFieldAt,
  magneticResult,
  normalizeCloud,
  normalizeMagnetic,
  normalizePlate,
  plateResult,
} from "./expansion-earth";

describe("plate boundary teaching model", () => {
  it("builds and releases transform stress rather than retaining a monotone score", () => {
    const start = {
      ...initialPlate,
      boundary: "transform" as const,
      movement: 0,
    };
    const before = advancePlate(start, 4),
      after = advancePlate(before);
    expect(before.stress).toBe(48);
    expect(after.stress).toBe(12);
    expect(after.slips).toBe(1);
    expect(after.movement).toBeGreaterThan(before.movement);
  });
  it("does not pretend to predict earthquakes at the other boundaries", () => {
    expect(advancePlate(initialPlate, 10).slips).toBe(0);
    expect(
      plateResult({ ...initialPlate, boundary: "convergent" }).terrain,
    ).toContain("subduction");
  });
  it("bounds repeated steps and handles nonfinite inputs", () => {
    let state = { ...initialPlate, boundary: "transform" as const };
    for (let i = 0; i < 500; i++) state = advancePlate(state);
    expect(state.movement).toBe(100);
    expect(state.slips).toBe(20);
    expect(
      normalizePlate({ ...state, movement: NaN, stress: Infinity }).movement,
    ).toBe(20);
    expect(advancePlate(initialPlate, -2)).toEqual(initialPlate);
  });
});
describe("cloud formation and rain are distinct", () => {
  it("can show clear air, cloud without rain and rain at identical vapor and temperature", () => {
    expect(cloudResult({ ...initialCloud, upliftM: 0 }).cloud).toBe(false);
    expect(cloudResult(initialCloud).cloud).toBe(true);
    expect(cloudResult(initialCloud).rain).toBe(false);
    expect(cloudResult({ ...initialCloud, dropletGrowth: 90 }).rain).toBe(true);
  });
  it("more vapor lowers condensation height; warming at fixed vapor raises it", () => {
    expect(
      cloudResult({ ...initialCloud, vaporGPerKg: 14 }).condensationHeightM,
    ).toBeLessThan(cloudResult(initialCloud).condensationHeightM);
    expect(
      cloudResult({ ...initialCloud, temperatureC: 32 }).condensationHeightM,
    ).toBeGreaterThan(cloudResult(initialCloud).condensationHeightM);
    expect(
      cloudResult({
        ...initialCloud,
        vaporGPerKg: 2,
        upliftM: 3000,
        dropletGrowth: 100,
      }).rain,
    ).toBe(false);
  });
  it("handles exact saturation and bounded extremes", () => {
    const atGround = cloudResult({
      temperatureC: 20,
      vaporGPerKg: 14,
      upliftM: 0,
      dropletGrowth: 0,
    });
    expect(atGround.condensationHeightM).toBeGreaterThan(0);
    expect(atGround.cloud).toBe(false);
    expect(
      normalizeCloud({ ...initialCloud, upliftM: Infinity, temperatureC: -100 })
        .temperatureC,
    ).toBe(20);
    for (const temperatureC of [20, 35])
      for (const vaporGPerKg of [2, 14]) {
        const result = cloudResult({
          temperatureC,
          vaporGPerKg,
          upliftM: 3000,
          dropletGrowth: 100,
        });
        expect(Number.isFinite(result.parcelTemperatureC)).toBe(true);
        expect(result.parcelTemperatureC).toBeGreaterThan(0);
        expect(result.rainIndex).toBeGreaterThanOrEqual(0);
        expect(result.rainIndex).toBeLessThanOrEqual(100);
      }
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
