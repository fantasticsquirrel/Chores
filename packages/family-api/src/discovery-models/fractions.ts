export const MAX_FRACTION_COMPONENT = 96;

export type Fraction = { numerator: number; denominator: number };
export type FractionAddition = {
  left: Fraction;
  right: Fraction;
  commonDenominator: number;
  leftCommonNumerator: number;
  rightCommonNumerator: number;
  commonSumNumerator: number;
  sum: Fraction;
  wholeCount: number;
  remainder: Fraction;
};

const integerWithinBound = (value: number, allowZero = true) =>
  Number.isSafeInteger(value) &&
  Math.abs(value) <= MAX_FRACTION_COMPONENT &&
  (allowZero || value !== 0);

const greatestCommonDivisor = (left: number, right: number) => {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
};

function signedParts(numerator: number, denominator: number): Fraction | null {
  if (!integerWithinBound(numerator) || !integerWithinBound(denominator, false))
    return null;
  return denominator < 0
    ? { numerator: -numerator, denominator: -denominator }
    : { numerator, denominator };
}

/**
 * Normalizes a bounded exact rational. Invalid, non-integer, or unbounded input
 * returns null instead of allowing NaN/Infinity into a learning state.
 */
export function normalizeFraction(
  numerator: number,
  denominator: number,
): Fraction | null {
  const parts = signedParts(numerator, denominator);
  if (!parts) return null;
  if (parts.numerator === 0) return { numerator: 0, denominator: 1 };
  const divisor = greatestCommonDivisor(parts.numerator, parts.denominator);
  return {
    numerator: parts.numerator / divisor,
    denominator: parts.denominator / divisor,
  };
}

export function equivalentFractions(
  leftNumerator: number,
  leftDenominator: number,
  rightNumerator: number,
  rightDenominator: number,
): boolean | null {
  const left = signedParts(leftNumerator, leftDenominator);
  const right = signedParts(rightNumerator, rightDenominator);
  return left && right
    ? left.numerator * right.denominator === right.numerator * left.denominator
    : null;
}

/** Splits every equal piece by the same whole-number factor. */
export function splitFractionParts(
  numerator: number,
  denominator: number,
  factor: number,
) {
  const before = signedParts(numerator, denominator);
  if (
    !before ||
    before.numerator < 0 ||
    before.numerator > before.denominator ||
    !Number.isSafeInteger(factor) ||
    factor < 1 ||
    before.numerator * factor > MAX_FRACTION_COMPONENT ||
    before.denominator * factor > MAX_FRACTION_COMPONENT
  )
    return null;
  const after = {
    numerator: before.numerator * factor,
    denominator: before.denominator * factor,
  };
  return {
    before,
    after,
    normalized: normalizeFraction(after.numerator, after.denominator)!,
    factor,
  };
}

/** Adds bounded rational parts using their least common denominator. */
export function addFractionParts(
  leftNumerator: number,
  leftDenominator: number,
  rightNumerator: number,
  rightDenominator: number,
): FractionAddition | null {
  const left = signedParts(leftNumerator, leftDenominator);
  const right = signedParts(rightNumerator, rightDenominator);
  if (!left || !right) return null;
  const commonDivisor = greatestCommonDivisor(
    left.denominator,
    right.denominator,
  );
  const commonDenominator =
    (left.denominator / commonDivisor) * right.denominator;
  const leftCommonNumerator =
    left.numerator * (commonDenominator / left.denominator);
  const rightCommonNumerator =
    right.numerator * (commonDenominator / right.denominator);
  const commonSumNumerator = leftCommonNumerator + rightCommonNumerator;
  if (
    !Number.isSafeInteger(commonDenominator) ||
    !Number.isSafeInteger(commonSumNumerator)
  )
    return null;
  const sum = normalizeFraction(commonSumNumerator, commonDenominator);
  if (!sum) return null;
  const wholeCount = Math.trunc(commonSumNumerator / commonDenominator);
  const remainderNumerator = Math.abs(
    commonSumNumerator - wholeCount * commonDenominator,
  );
  return {
    left,
    right,
    commonDenominator,
    leftCommonNumerator,
    rightCommonNumerator,
    commonSumNumerator,
    sum,
    wholeCount,
    remainder: normalizeFraction(remainderNumerator, commonDenominator) ?? {
      numerator: 0,
      denominator: 1,
    },
  };
}

export const FRACTION_EQUIVALENCE_TRIAL = {
  before: { numerator: 1, denominator: 2 },
  after: { numerator: 2, denominator: 4 },
  changed: ["piece count", "piece size"],
  held: ["whole area", "selected amount"],
} as const;

export const FRACTION_ADDITION_TRIAL = {
  left: { numerator: 2, denominator: 3 },
  right: { numerator: 3, denominator: 4 },
  changed: ["portion being joined"],
  held: ["whole area", "equal partitions within each whole"],
  addition: addFractionParts(2, 3, 3, 4)!,
} as const;
