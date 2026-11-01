import { describe, expect, it } from "vitest";
import {
  comparePhotosynthesisInputs,
  photosynthesisActivity,
  PHOTOSYNTHESIS_LIGHT_STEPS,
  PHOTOSYNTHESIS_ZERO_WATER,
} from "./photosynthesis";

describe("photosynthesis teaching model", () => {
  it.each([
    ["light", "light"],
    ["water", "water"],
    ["carbonDioxide", "carbon dioxide"],
  ] as const)("makes missing %s a zero boundary", (field, resource) => {
    const result = photosynthesisActivity({
      light: 80,
      water: 80,
      carbonDioxide: 80,
      [field]: 0,
    });

    expect(result.activityIndex).toBe(0);
    expect(result.limitingResources).toEqual([resource]);
  });

  it("normalizes out-of-range and non-finite settings", () => {
    const result = photosynthesisActivity({
      light: -20,
      water: 140,
      carbonDioxide: Number.NaN,
    });

    expect(result.inputs).toEqual({
      light: 0,
      water: 100,
      carbonDioxide: 0,
    });
    expect(result.activityIndex).toBe(0);
    expect(result.limitingResources).toEqual(["light", "carbon dioxide"]);
  });

  it("reports two- and three-way limiting ties", () => {
    expect(
      photosynthesisActivity({
        light: 35,
        water: 35,
        carbonDioxide: 80,
      }).limitingResources,
    ).toEqual(["light", "water"]);
    expect(
      photosynthesisActivity({
        light: 50,
        water: 50,
        carbonDioxide: 50,
      }).limitingResources,
    ).toEqual(["light", "water", "carbon dioxide"]);
  });

  it("uses a saturating index and plateaus when another input limits", () => {
    const low = photosynthesisActivity({
      light: 15,
      water: 35,
      carbonDioxide: 80,
    });
    const equal = photosynthesisActivity({
      light: 35,
      water: 35,
      carbonDioxide: 80,
    });
    const high = photosynthesisActivity({
      light: 100,
      water: 35,
      carbonDioxide: 80,
    });

    expect(low.activityIndex).toBeLessThan(equal.activityIndex);
    expect(Math.round(low.activityIndex)).toBe(37);
    expect(Math.round(equal.activityIndex)).toBe(67);
    expect(high.activityIndex).toBeCloseTo(equal.activityIndex);
    expect(high.activityIndex).toBeLessThan(100);
  });

  it("keeps the guided comparisons controlled", () => {
    expect(PHOTOSYNTHESIS_ZERO_WATER.low.water).toBe(0);
    expect(PHOTOSYNTHESIS_ZERO_WATER.high.water).toBe(0);
    expect(PHOTOSYNTHESIS_ZERO_WATER.low.carbonDioxide).toBe(80);
    expect(PHOTOSYNTHESIS_ZERO_WATER.high.carbonDioxide).toBe(80);
    expect(PHOTOSYNTHESIS_LIGHT_STEPS.map((step) => step.water)).toEqual([
      35, 35, 35,
    ]);
    expect(
      PHOTOSYNTHESIS_LIGHT_STEPS.map((step) => step.carbonDioxide),
    ).toEqual([80, 80, 80]);
  });

  it("identifies the changed variable and held constants", () => {
    const baseline = { light: 70, water: 60, carbonDioxide: 80 };
    expect(
      comparePhotosynthesisInputs(baseline, {
        ...baseline,
        light: 90,
      }),
    ).toEqual({
      changed: ["light"],
      held: ["water", "carbon dioxide"],
      controlled: true,
    });
    expect(
      comparePhotosynthesisInputs(baseline, {
        ...baseline,
        light: 90,
        water: 20,
      }).controlled,
    ).toBe(false);
  });
});
