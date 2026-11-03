import { describe, expect, it } from "vitest";
import {
  ATMOSPHERIC_PRESSURE_PA,
  PRESSURE_SENSOR_AREA_M2,
  defaultPressureState,
  normalizePressure,
  pressureResult,
  pressureTankTrials,
} from "./pressure-tank";

describe("Pressure Tank hydrostatic and ideal outlet model", () => {
  it("keeps gauge, absolute pressure, sensor net force and area dimensionally consistent", () => {
    const result = pressureResult(defaultPressureState);

    expect(result.gaugePressurePa).toBeCloseTo(14_715);
    expect(result.absolutePressurePa).toBeCloseTo(
      ATMOSPHERIC_PRESSURE_PA + result.gaugePressurePa,
    );
    expect(result.sensorNetForceN).toBeCloseTo(
      result.gaugePressurePa * PRESSURE_SENSOR_AREA_M2,
    );
    expect(result.sensorAreaCm2).toBe(100);
  });

  it("triples gauge pressure and sensor net force while speed grows by square root of three", () => {
    const low = pressureResult({ ...defaultPressureState, depthM: 1 });
    const high = pressureResult({ ...defaultPressureState, depthM: 2 });

    expect(high.headM).toBeCloseTo(low.headM * 3);
    expect(high.gaugePressurePa).toBeCloseTo(low.gaugePressurePa * 3);
    expect(high.sensorNetForceN).toBeCloseTo(low.sensorNetForceN * 3);
    expect(high.jetSpeedMps).toBeCloseTo(low.jetSpeedMps * Math.sqrt(3));
  });

  it("changes volume, but not equal-head pressure, force or speed, when shape changes", () => {
    const narrow = pressureResult(defaultPressureState);
    const wide = pressureResult({ ...defaultPressureState, shape: "wide" });
    const tapered = pressureResult({
      ...defaultPressureState,
      shape: "tapered",
      depthM: 3,
    });

    expect(wide.volumeLiters).toBeGreaterThan(narrow.volumeLiters);
    expect(wide.gaugePressurePa).toBe(narrow.gaugePressurePa);
    expect(wide.sensorNetForceN).toBe(narrow.sensorNetForceN);
    expect(wide.jetSpeedMps).toBe(narrow.jetSpeedMps);
    expect(tapered.volumeLiters).toBeCloseTo(5_320);
  });

  it("removes the ideal jet at or above the surface and locates the range maximum", () => {
    for (const outletM of [2, 2.5]) {
      const dry = pressureResult({
        ...defaultPressureState,
        depthM: 2,
        outletM,
      });
      expect(dry.headM).toBe(0);
      expect(dry.gaugePressurePa).toBe(0);
      expect(dry.jetSpeedMps).toBe(0);
      expect(dry.rangeM).toBe(0);
      expect(dry.outletSubmerged).toBe(false);
    }

    const high = pressureResult({ ...defaultPressureState, outletM: 0.5 });
    const halfway = pressureResult({ ...defaultPressureState, outletM: 1 });
    const low = pressureResult({ ...defaultPressureState, outletM: 1.5 });
    expect(halfway.rangeM).toBeGreaterThan(high.rangeM);
    expect(halfway.rangeM).toBeGreaterThan(low.rangeM);
    expect(high.rangeM).toBeCloseTo(low.rangeM);
  });

  it("bounds every teaching input and keeps all numerical outputs finite", () => {
    expect(
      normalizePressure({
        depthM: Number.NEGATIVE_INFINITY,
        outletM: Number.POSITIVE_INFINITY,
        shape: "unexpected" as "narrow",
      }),
    ).toEqual(defaultPressureState);
    const bounded = normalizePressure({
      depthM: -2,
      outletM: 99,
      shape: "wide",
    });
    expect(bounded).toEqual({ depthM: 0.2, outletM: 2.5, shape: "wide" });
    expect(
      Object.values(pressureResult(bounded))
        .filter((value): value is number => typeof value === "number")
        .every(Number.isFinite),
    ).toBe(true);
  });

  it("defines two prediction-first trials that each change exactly one input", () => {
    expect(pressureTankTrials).toHaveLength(2);
    for (const trial of pressureTankTrials) {
      const changedKeys = Object.keys(trial.before).filter(
        (key) =>
          trial.before[key as keyof typeof trial.before] !==
          trial.after[key as keyof typeof trial.after],
      );
      expect(changedKeys).toHaveLength(1);
      expect(trial.choices).toContain(trial.correctChoice);
      expect(trial.evidence).toMatch(/kPa/);
      expect(trial.evidence).toMatch(/m\/s/);
      expect(trial.held).toContain("100 cm² pressure sensor area");
    }
  });
});
