import { describe, expect, it } from "vitest";
import {
  defaultHeatState,
  heatHouseTrials,
  heatResult,
  normalizeHeat,
} from "./heat-house";

describe("Heat House steady transfer and elapsed energy", () => {
  it("keeps power constant while transferred energy grows with elapsed time", () => {
    const twoHours = heatResult({ ...defaultHeatState, elapsedHours: 2 });
    const eightHours = heatResult({ ...defaultHeatState, elapsedHours: 8 });

    expect(eightHours.totalWatts).toBeCloseTo(twoHours.totalWatts);
    expect(eightHours.totalEnergyJ).toBeCloseTo(twoHours.totalEnergyJ * 4);
    expect(eightHours.totalEnergyKWh).toBeCloseTo(
      (eightHours.totalWatts * 8) / 1000,
    );
    expect(eightHours.elapsedSeconds).toBe(8 * 60 * 60);
  });

  it("changes only wall transfer when only added wall insulation changes", () => {
    const bare = heatResult({ ...defaultHeatState, insulationCm: 0 });
    const insulated = heatResult({ ...defaultHeatState, insulationCm: 10 });

    expect(insulated.wallWatts).toBeLessThan(bare.wallWatts);
    expect(insulated.windowWatts).toBe(bare.windowWatts);
    expect(insulated.wallU).toBeLessThan(bare.wallU);
    expect(insulated.windowU).toBe(bare.windowU);
  });

  it("replaces opaque wall with window while preserving envelope area", () => {
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

    expect(small.wallAreaM2 + small.windowAreaM2).toBe(60);
    expect(large.wallAreaM2 + large.windowAreaM2).toBe(60);
    expect(large.totalWatts).toBeGreaterThan(small.totalWatts);
  });

  it("has no net transfer at equal temperatures and reverses signed energy", () => {
    const equal = heatResult({ ...defaultHeatState, outsideC: 20 });
    const entering = heatResult({ ...defaultHeatState, outsideC: 25 });

    expect(equal.totalWatts).toBe(0);
    expect(equal.totalEnergyJ).toBe(0);
    expect(equal.direction).toBe("balanced");
    expect(entering.totalWatts).toBeLessThan(0);
    expect(entering.totalEnergyJ).toBeLessThan(0);
    expect(entering.direction).toBe("inward");
  });

  it("bounds every teaching input and keeps all model outputs finite", () => {
    const normalized = normalizeHeat({
      ...defaultHeatState,
      insulationCm: -1,
      windowM2: 99,
      insideC: Number.NaN,
      outsideC: Number.POSITIVE_INFINITY,
      elapsedHours: 99,
    });

    expect(normalized).toEqual({
      ...defaultHeatState,
      insulationCm: 0,
      windowM2: 18,
      elapsedHours: 24,
    });
    expect(
      Object.values(heatResult(normalized))
        .filter((value): value is number => typeof value === "number")
        .every(Number.isFinite),
    ).toBe(true);
  });

  it("defines two prediction-first trials that each change exactly one input", () => {
    expect(heatHouseTrials).toHaveLength(2);
    for (const trial of heatHouseTrials) {
      const changedKeys = Object.keys(trial.before).filter(
        (key) =>
          trial.before[key as keyof typeof trial.before] !==
          trial.after[key as keyof typeof trial.after],
      );
      expect(changedKeys).toHaveLength(1);
      expect(trial.choices).toContain(trial.correctChoice);
      expect(trial.evidence).toMatch(/W/);
      expect(trial.evidence).toMatch(/kWh/);
      expect(trial.held).toContain("6 h elapsed time");
    }
  });
});
