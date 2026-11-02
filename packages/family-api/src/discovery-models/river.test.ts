import { describe, expect, it } from "vitest";
import {
  RIVER_DEFAULT_INPUTS,
  RIVER_INITIAL_LEDGER,
  RIVER_SLOPE_COMPARISON,
  RIVER_VEGETATION_COMPARISON,
  applyRiverStorm,
  compareRiverTrials,
  normalizeRiverInputs,
  riverActivity,
  riverStateAtPhase,
} from "./river";

describe("bounded River Sculptor teaching model", () => {
  it("converts one hour of rainfall over one hectare and conserves water", () => {
    const result = riverActivity(RIVER_DEFAULT_INPUTS);

    expect(result.rainfallVolumeCubicMeters).toBe(400);
    expect(result.runoffCubicMeters).toBeCloseTo(232);
    expect(result.infiltrationCubicMeters).toBeCloseTo(168);
    expect(
      result.runoffCubicMeters + result.infiltrationCubicMeters,
    ).toBeCloseTo(result.rainfallVolumeCubicMeters);
    expect(result.channelCapacityExcessCubicMeters).toBeCloseTo(52);
  });

  it("isolates vegetation while holding slope, rain, area and duration fixed", () => {
    const [bare, covered] = RIVER_VEGETATION_COMPARISON.map((inputs) =>
      riverActivity(inputs),
    );

    expect(bare.runoffCubicMeters).toBe(320);
    expect(bare.soilMovedKilograms).toBeCloseTo(147.2);
    expect(bare.exportedKilograms).toBeCloseTo(72.128);
    expect(covered.runoffCubicMeters).toBe(100);
    expect(covered.soilMovedKilograms).toBeCloseTo(6.9);
    expect(covered.exportedKilograms).toBeCloseTo(2.001);
    expect(compareRiverTrials(...RIVER_VEGETATION_COMPARISON)).toEqual({
      changed: ["vegetation cover"],
      held: [
        "8% catchment slope",
        "40 mm rainfall in one hour",
        "1 hectare catchment",
        "5,000 kg starting soil",
      ],
    });
  });

  it("isolates slope: runoff stays fixed while moved and exported soil rise", () => {
    const [gentle, steep] = RIVER_SLOPE_COMPARISON.map((inputs) =>
      riverActivity(inputs),
    );

    expect(gentle.runoffCubicMeters).toBe(steep.runoffCubicMeters);
    expect(gentle.runoffCubicMeters).toBeCloseTo(232);
    expect(gentle.soilMovedKilograms).toBeCloseTo(29.0928);
    expect(gentle.exportedKilograms).toBeCloseTo(6.691344);
    expect(steep.soilMovedKilograms).toBeCloseTo(153.12);
    expect(steep.exportedKilograms).toBeCloseTo(117.9024);
    expect(compareRiverTrials(...RIVER_SLOPE_COMPARISON)).toEqual({
      changed: ["catchment slope"],
      held: [
        "40 mm rainfall in one hour",
        "40% vegetation cover",
        "1 hectare catchment",
        "5,000 kg starting soil",
      ],
    });
  });

  it("conserves the finite soil ledger across repeated storms", () => {
    let ledger = RIVER_INITIAL_LEDGER;
    for (let index = 0; index < 30; index += 1)
      ledger = applyRiverStorm(
        { ...RIVER_DEFAULT_INPUTS, rainfallMillimeters: 100 },
        ledger,
      );

    expect(ledger.soilRemainingKilograms).toBeGreaterThanOrEqual(0);
    expect(
      ledger.soilRemainingKilograms +
        ledger.depositedKilograms +
        ledger.exportedKilograms,
    ).toBeCloseTo(5_000);
    expect(ledger.stormCount).toBe(30);
  });

  it("wraps the sediment-tracer phase without changing the storm calculation", () => {
    const wrapped = riverStateAtPhase(RIVER_DEFAULT_INPUTS, 2.25);

    expect(wrapped.visualPhase).toBe(0.25);
    expect(wrapped.runoffCubicMeters).toBeCloseTo(232);
    expect(
      riverStateAtPhase(RIVER_DEFAULT_INPUTS, Number.NaN).visualPhase,
    ).toBe(0);
  });

  it("normalizes a malformed cumulative ledger before applying a storm", () => {
    const ledger = applyRiverStorm(RIVER_DEFAULT_INPUTS, {
      stormCount: 3.8,
      soilRemainingKilograms: 4_000,
      depositedKilograms: 4_000,
      exportedKilograms: 4_000,
    });

    expect(ledger.stormCount).toBe(4);
    expect(
      ledger.soilRemainingKilograms +
        ledger.depositedKilograms +
        ledger.exportedKilograms,
    ).toBeCloseTo(5_000);
  });

  it("bounds invalid inputs and available soil without producing non-finite output", () => {
    expect(
      normalizeRiverInputs({
        catchmentSlopePercent: Number.NaN,
        rainfallMillimeters: Infinity,
        vegetationCoverPercent: -9,
      }),
    ).toEqual({
      catchmentSlopePercent: 8,
      rainfallMillimeters: 40,
      vegetationCoverPercent: 0,
    });
    expect(
      normalizeRiverInputs({
        catchmentSlopePercent: 99,
        rainfallMillimeters: -1,
        vegetationCoverPercent: 900,
      }),
    ).toEqual({
      catchmentSlopePercent: 20,
      rainfallMillimeters: 0,
      vegetationCoverPercent: 100,
    });
    const result = riverActivity(RIVER_DEFAULT_INPUTS, -10);
    expect(result.availableSoilKilograms).toBe(0);
    expect(result.soilMovedKilograms).toBe(0);
    expect(Object.values(result).every(Number.isFinite)).toBe(true);
  });
});
