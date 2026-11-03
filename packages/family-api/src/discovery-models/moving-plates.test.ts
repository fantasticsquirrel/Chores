import { describe, expect, it } from "vitest";
import {
  advanceFaultLoading,
  defaultPlateState,
  FAULT_SLIP_LIMIT,
  movingPlatesBoundary,
  movingPlatesTrials,
  normalizePlate,
  plateResult,
} from "./moving-plates";

describe("bounded Moving Plates teaching model", () => {
  it("converts plate rate and geologic time into relative motion", () => {
    const result = plateResult(defaultPlateState);
    expect(defaultPlateState.rateCmPerYear).toBe(4);
    expect(defaultPlateState.elapsedMillionYears).toBe(2);
    expect(result.relativeMotionKm).toBe(80);
    expect(
      plateResult({
        ...defaultPlateState,
        rateCmPerYear: 1,
        elapsedMillionYears: 1,
      }).relativeMotionKm,
    ).toBe(10);
  });

  it("distinguishes what the three boundary examples do to lithosphere", () => {
    const apart = plateResult(defaultPlateState);
    const together = plateResult({
      ...defaultPlateState,
      boundary: "convergent",
    });
    const sideways = plateResult({
      ...defaultPlateState,
      boundary: "transform",
    });
    expect(apart.feature).toMatch(/mid-ocean ridge/i);
    expect(apart.crustChange).toMatch(/new oceanic crust/i);
    expect(together.feature).toMatch(/trench.*subduction/i);
    expect(together.crustChange).toMatch(/oceanic lithosphere.*beneath/i);
    expect(sideways.feature).toMatch(/transform fault/i);
    expect(sideways.crustChange).toMatch(/neither creates nor destroys/i);
    expect(new Set([apart.motion, together.motion, sideways.motion]).size).toBe(
      3,
    );
  });

  it("loads a locked transform fault, then releases the invented index on one slip", () => {
    const start = {
      ...defaultPlateState,
      boundary: "transform" as const,
      loadingStep: 0,
      slips: 0,
    };
    const before = advanceFaultLoading(start, 4);
    const after = advanceFaultLoading(before);
    expect(plateResult(before).elasticLoadingPercent).toBe(80);
    expect(before.slips).toBe(0);
    expect(plateResult(after).elasticLoadingPercent).toBe(0);
    expect(after.slips).toBe(1);
    expect(plateResult(after).markerOffsetSteps).toBe(1);
    expect(advanceFaultLoading(defaultPlateState)).toEqual(defaultPlateState);
  });

  it("stops loading at the explicit illustrated-slip limit", () => {
    const atLimit = {
      ...defaultPlateState,
      boundary: "transform" as const,
      loadingStep: 0,
      slips: FAULT_SLIP_LIMIT,
    };
    expect(advanceFaultLoading(atLimit, 20)).toEqual(atLimit);
    expect(plateResult(atLimit).summary).toMatch(/reached.*20-slip limit/i);
  });

  it("bounds public inputs and keeps the two guided comparisons fair", () => {
    expect(
      normalizePlate({
        boundary: "invalid" as never,
        rateCmPerYear: Number.POSITIVE_INFINITY,
        elapsedMillionYears: -50,
        loadingStep: 99,
        slips: 2.9,
      }),
    ).toEqual({
      boundary: "divergent",
      rateCmPerYear: 4,
      elapsedMillionYears: 0,
      loadingStep: 4,
      slips: 2,
    });

    const [direction, slip] = movingPlatesTrials;
    expect(plateResult(direction.before).relativeMotionKm).toBe(
      plateResult(direction.after).relativeMotionKm,
    );
    expect(direction.before.rateCmPerYear).toBe(direction.after.rateCmPerYear);
    expect(direction.before.elapsedMillionYears).toBe(
      direction.after.elapsedMillionYears,
    );
    expect(slip.after).toEqual(advanceFaultLoading(slip.before));
    expect(slip.before.loadingStep).toBe(4);
  });

  it("states the scale, material and earthquake-prediction limits", () => {
    expect(movingPlatesBoundary).toMatch(/centimetres per year/i);
    expect(movingPlatesBoundary).toMatch(/million years/i);
    expect(movingPlatesBoundary).toMatch(/asthenosphere.*solid rock/i);
    expect(movingPlatesBoundary).toMatch(/cannot predict.*earthquake/i);
  });
});
