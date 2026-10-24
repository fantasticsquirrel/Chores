import { describe, expect, it } from "vitest";
import {
  addFractions,
  simplifyFraction,
  vertexFit,
  transformPoint,
} from "@family-manager/family-api/discovery-models/math-life";
import { caravanJourney } from "@family-manager/family-api/discovery-models/math-life";
import {
  initialPollinator,
  visitFlower,
} from "@family-manager/family-api/discovery-models/math-life";
import {
  probabilities,
  sampleOutcomes,
  fairnessDistance,
} from "@family-manager/family-api/discovery-models/math-life";

describe("fraction and pattern models", () => {
  it("compares amounts using equal wholes and adds unlike denominators", () => {
    expect(simplifyFraction(6, 8)).toEqual({ numerator: 3, denominator: 4 });
    expect(addFractions(1, 2, 2, 4)).toEqual({ numerator: 1, denominator: 1 });
    expect(addFractions(2, 3, 3, 4)).toEqual({
      numerator: 17,
      denominator: 12,
    });
    expect(simplifyFraction(0, 8)).toEqual({ numerator: 0, denominator: 1 });
  });
  it("measures genuine gaps and overlaps at a tessellation vertex", () => {
    expect(vertexFit(3, 6)).toEqual({ angle: 60, gap: 0, overlap: 0 });
    expect(vertexFit(4, 4).gap).toBe(0);
    expect(vertexFit(6, 3).gap).toBe(0);
    expect(vertexFit(5, 3).gap).toBe(36);
    expect(vertexFit(5, 4).overlap).toBe(72);
  });
  it("reflects before rotating a motif", () => {
    const result = transformPoint(2, 1, 90, true);
    expect(result.x).toBeCloseTo(-1);
    expect(result.y).toBeCloseTo(-2);
  });
});

describe("caravan constraints", () => {
  it("accounts for route, season, packing and limited supplies", () => {
    const dry = caravanJourney("river", "dry", "grain", 6, 12);
    const wet = caravanJourney("river", "wet", "grain", 6, 12);
    expect(dry.days).toBeGreaterThan(wet.days);
    expect(dry.spoiled).toBeGreaterThan(wet.spoiled);
    expect(caravanJourney("ridge", "wet", "pottery", 10, 20).overCapacity).toBe(
      true,
    );
    expect(
      caravanJourney("oasis", "dry", "cloth", 4, 1).shortfall,
    ).toBeGreaterThan(0);
  });
});

describe("pollination is not the same as a visit", () => {
  it("requires pollen from a different compatible flower", () => {
    const first = visitFlower(initialPollinator(), "a", 200, true);
    expect(first.visits).toBe(1);
    expect(first.transfers).toBe(0);
    const again = visitFlower(first, "a", 200, true);
    expect(again.transfers).toBe(0);
    const compatible = visitFlower(first, "b", 200, true);
    expect(compatible.transfers).toBe(1);
    const different = visitFlower(first, "c", 200, true);
    expect(different.transfers).toBe(0);
  });
  it("makes stepping-stone habitat necessary for crossing a gap", () => {
    const start = visitFlower(initialPollinator(), "a", 170, false);
    const left = visitFlower(start, "b", 170, false);
    expect(visitFlower(left, "d", 170, false).visits).toBe(left.visits);
    expect(visitFlower(left, "bridge-a", 170, false).visits).toBe(left.visits);
    expect(visitFlower(left, "bridge-a", 170, true).visits).toBe(
      left.visits + 1,
    );
  });
});

describe("weighted probability experiments", () => {
  it("normalizes weights including impossible outcomes", () => {
    expect(probabilities([1, 1, 2, 0])).toEqual([0.25, 0.25, 0.5, 0]);
    expect(probabilities([0, 0])).toEqual([0, 0]);
  });
  it("samples cumulative probabilities at exact boundaries", () => {
    expect(sampleOutcomes([1, 3, 0], 10, () => 0.1)).toEqual([10, 0, 0]);
    expect(sampleOutcomes([1, 3, 0], 10000, () => 0.25)).toEqual([0, 10000, 0]);
    expect(sampleOutcomes([0, 0], 10)).toEqual([0, 0]);
  });
  it("reports the largest percentage-point sampling gap", () => {
    expect(fairnessDistance([50, 50], [1, 1])).toBe(0);
    expect(fairnessDistance([70, 30], [1, 1])).toBeCloseTo(20);
  });
});
