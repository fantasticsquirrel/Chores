import { describe, expect, it } from "vitest";
import {
  FRACTION_ADDITION_TRIAL,
  FRACTION_EQUIVALENCE_TRIAL,
  MAX_FRACTION_COMPONENT,
  addFractionParts,
  equivalentFractions,
  normalizeFraction,
  splitFractionParts,
} from "./fractions";

describe("exact bounded fraction model", () => {
  it("normalizes signs and zero without losing exactness", () => {
    expect(normalizeFraction(2, -4)).toEqual({ numerator: -1, denominator: 2 });
    expect(normalizeFraction(-2, -4)).toEqual({ numerator: 1, denominator: 2 });
    expect(normalizeFraction(0, -8)).toEqual({ numerator: 0, denominator: 1 });
    expect(normalizeFraction(1, 1)).toEqual({ numerator: 1, denominator: 1 });
  });

  it.each([
    [1, 0],
    [1.5, 2],
    [Number.NaN, 2],
    [1, Number.POSITIVE_INFINITY],
    [MAX_FRACTION_COMPONENT + 1, 2],
    [1, MAX_FRACTION_COMPONENT + 1],
  ])(
    "rejects invalid or out-of-range input %s/%s",
    (numerator, denominator) => {
      expect(normalizeFraction(numerator, denominator)).toBeNull();
    },
  );

  it("distinguishes more pieces from more amount", () => {
    expect(equivalentFractions(1, 2, 2, 4)).toBe(true);
    expect(equivalentFractions(0, 2, 0, 12)).toBe(true);
    expect(equivalentFractions(1, 2, 1, 4)).toBe(false);
    expect(equivalentFractions(1, 2, 2, 0)).toBeNull();
  });

  it("preserves a portion when every equal piece is split", () => {
    expect(splitFractionParts(2, 4, 2)).toEqual({
      before: { numerator: 2, denominator: 4 },
      after: { numerator: 4, denominator: 8 },
      normalized: { numerator: 1, denominator: 2 },
      factor: 2,
    });
    expect(splitFractionParts(1, 2, 0)).toBeNull();
    expect(splitFractionParts(1, 2, 49)).toBeNull();
  });

  it("uses the least common denominator and reports an improper sum coherently", () => {
    expect(addFractionParts(2, 3, 3, 4)).toEqual({
      left: { numerator: 2, denominator: 3 },
      right: { numerator: 3, denominator: 4 },
      commonDenominator: 12,
      leftCommonNumerator: 8,
      rightCommonNumerator: 9,
      commonSumNumerator: 17,
      sum: { numerator: 17, denominator: 12 },
      wholeCount: 1,
      remainder: { numerator: 5, denominator: 12 },
    });
    expect(addFractionParts(1, 6, 1, 3)?.commonDenominator).toBe(6);
    expect(addFractionParts(1, 0, 1, 3)).toBeNull();
  });

  it("defines two fixed fair comparisons", () => {
    expect(FRACTION_EQUIVALENCE_TRIAL.changed).toEqual([
      "piece count",
      "piece size",
    ]);
    expect(FRACTION_EQUIVALENCE_TRIAL.held).toContain("whole area");
    expect(FRACTION_ADDITION_TRIAL.addition.commonSumNumerator).toBe(17);
    expect(FRACTION_ADDITION_TRIAL.addition.wholeCount).toBe(1);
  });
});
