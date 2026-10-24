import { describe, expect, it } from "vitest";
import {
  defaultMachineState,
  defaultHeatState,
  defaultPressureState,
  machineResult,
  heatResult,
  pressureResult,
  normalizeMachine,
  normalizeHeat,
  normalizePressure,
} from "./expansion-mechanics";

describe("ideal machine work", () => {
  it("exchanges force for distance without creating work", () => {
    const direct = machineResult({ ...defaultMachineState, advantage: 1 });
    const four = machineResult({ ...defaultMachineState, advantage: 4 });
    expect(four.inputForceN).toBeCloseTo(direct.inputForceN / 4);
    expect(four.inputDistanceM).toBeCloseTo(direct.inputDistanceM * 4);
    expect(four.inputWorkJ).toBeCloseTo(four.outputWorkJ);
    expect(four.outputWorkJ).toBeCloseTo(direct.outputWorkJ);
  });
  it("models gear torque and turns with equal crank and drum radii", () => {
    const one = machineResult({
      ...defaultMachineState,
      mode: "gears",
      advantage: 1,
    });
    const four = machineResult({
      ...defaultMachineState,
      mode: "gears",
      advantage: 4,
    });
    expect(four.crankTurns).toBeCloseTo(one.crankTurns * 4);
    expect(four.inputTorqueNm).toBeCloseTo(one.inputTorqueNm / 4);
    expect(four.outputTorqueNm).toBeCloseTo(one.outputTorqueNm);
  });
  it("bounds invalid state, and zero lift requires zero work, not zero balancing force", () => {
    expect(
      normalizeMachine({
        mode: "pulley",
        advantage: 0,
        loadKg: -4,
        liftM: Infinity,
      }),
    ).toEqual({ mode: "pulley", advantage: 1, loadKg: 10, liftM: 0.5 });
    const still = machineResult({ ...defaultMachineState, liftM: 0 });
    expect(still.outputWorkJ).toBe(0);
    expect(still.inputForceN).toBeGreaterThan(0);
  });
});

describe("steady wall and window heat transfer", () => {
  it("reduces wall transfer but not window transfer when only insulation changes", () => {
    const bare = heatResult({ ...defaultHeatState, insulationCm: 0 });
    const insulated = heatResult({ ...defaultHeatState, insulationCm: 10 });
    expect(insulated.wallWatts).toBeLessThan(bare.wallWatts);
    expect(insulated.windowWatts).toBe(bare.windowWatts);
  });
  it("replaces wall area with window area, preserves total area and doubles transfer for double difference", () => {
    const small = heatResult({
      ...defaultHeatState,
      insulationCm: 10,
      windowM2: 2,
    });
    const large = heatResult({
      ...defaultHeatState,
      insulationCm: 10,
      windowM2: 18,
    });
    expect(large.totalWatts).toBeGreaterThan(small.totalWatts);
    expect(large.wallAreaM2 + large.windowAreaM2).toBe(60);
    const warm = heatResult({ ...defaultHeatState, insideC: 20, outsideC: 10 });
    const cold = heatResult({ ...defaultHeatState, insideC: 20, outsideC: 0 });
    expect(cold.totalWatts).toBeCloseTo(warm.totalWatts * 2);
  });
  it("has zero net flow at equal temperatures and reverses when outside is warmer", () => {
    const equal = heatResult({ ...defaultHeatState, outsideC: 20 });
    expect(equal.totalWatts).toBe(0);
    const warm = heatResult({ ...defaultHeatState, outsideC: 25 });
    expect(warm.totalWatts).toBeLessThan(0);
    expect(warm.wallWatts).toBeLessThan(0);
    expect(warm.windowWatts).toBeLessThan(0);
  });
  it("normalizes non-finite and out-of-bounds input to finite outputs", () => {
    expect(
      normalizeHeat({
        ...defaultHeatState,
        insulationCm: -1,
        windowM2: 99,
        insideC: NaN,
      }).windowM2,
    ).toBe(18);
    expect(
      heatResult({ ...defaultHeatState, insulationCm: Infinity }).totalWatts,
    ).toBeGreaterThan(0);
  });
});

describe("hydrostatic tank", () => {
  it("depends on vertical head, not tank shape or volume", () => {
    const narrow = pressureResult(defaultPressureState);
    const wide = pressureResult({ ...defaultPressureState, shape: "wide" });
    expect(wide.pressurePa).toBe(narrow.pressurePa);
    expect(wide.jetSpeedMps).toBe(narrow.jetSpeedMps);
    expect(wide.volumeLiters).toBeGreaterThan(narrow.volumeLiters);
  });
  it("has no outward jet above or exactly on the free surface", () => {
    for (const outletM of [2, 2.5]) {
      const dry = pressureResult({
        ...defaultPressureState,
        depthM: 2,
        outletM,
      });
      expect(dry.headM).toBe(0);
      expect(dry.pressurePa).toBe(0);
      expect(dry.rangeM).toBe(0);
    }
  });
  it("triples pressure but multiplies speed by sqrt(3) when head triples", () => {
    const low = pressureResult({ ...defaultPressureState, depthM: 1 });
    const high = pressureResult({ ...defaultPressureState, depthM: 2 });
    expect(high.pressurePa).toBeCloseTo(low.pressurePa * 3);
    expect(high.jetSpeedMps).toBeCloseTo(low.jetSpeedMps * Math.sqrt(3));
  });
  it("normalizes all bounds and has a finite tapered volume", () => {
    expect(
      normalizePressure({
        ...defaultPressureState,
        depthM: -4,
        outletM: Infinity,
      }),
    ).toEqual({ ...defaultPressureState, depthM: 0.2 });
    const tapered = pressureResult({
      ...defaultPressureState,
      shape: "tapered",
      depthM: 3,
    });
    expect(tapered.volumeLiters).toBeCloseTo(5320);
  });
});
