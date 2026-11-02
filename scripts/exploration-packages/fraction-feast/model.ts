export const MAX_FRACTION_COMPONENT = 96;
export type Fraction = { numerator: number; denominator: number };

const boundedInteger = (value: number, allowZero = true) =>
  Number.isSafeInteger(value) &&
  Math.abs(value) <= MAX_FRACTION_COMPONENT &&
  (allowZero || value !== 0);
const gcd = (left: number, right: number) => {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
};
const reduceSafeFraction = (
  numerator: number,
  denominator: number,
): Fraction | null => {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    denominator === 0
  )
    return null;
  if (numerator === 0) return { numerator: 0, denominator: 1 };
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: (numerator / divisor) * sign,
    denominator: Math.abs(denominator / divisor),
  };
};
const parts = (numerator: number, denominator: number): Fraction | null => {
  if (!boundedInteger(numerator) || !boundedInteger(denominator, false))
    return null;
  return denominator < 0
    ? { numerator: -numerator, denominator: -denominator }
    : { numerator, denominator };
};

export function normalizeFraction(numerator: number, denominator: number) {
  const value = parts(numerator, denominator);
  if (!value) return null;
  return reduceSafeFraction(value.numerator, value.denominator);
}

export function addFractionParts(
  leftNumerator: number,
  leftDenominator: number,
  rightNumerator: number,
  rightDenominator: number,
) {
  const left = parts(leftNumerator, leftDenominator);
  const right = parts(rightNumerator, rightDenominator);
  if (!left || !right) return null;
  const commonDenominator =
    (left.denominator / gcd(left.denominator, right.denominator)) *
    right.denominator;
  const leftCommonNumerator =
    left.numerator * (commonDenominator / left.denominator);
  const rightCommonNumerator =
    right.numerator * (commonDenominator / right.denominator);
  const commonSumNumerator = leftCommonNumerator + rightCommonNumerator;
  if (
    !Number.isSafeInteger(commonDenominator) ||
    !Number.isSafeInteger(leftCommonNumerator) ||
    !Number.isSafeInteger(rightCommonNumerator) ||
    !Number.isSafeInteger(commonSumNumerator)
  )
    return null;
  const sum = reduceSafeFraction(commonSumNumerator, commonDenominator);
  if (!sum) return null;
  const truncatedWhole = Math.trunc(commonSumNumerator / commonDenominator);
  const wholeCount = truncatedWhole === 0 ? 0 : truncatedWhole;
  const signedRemainder = commonSumNumerator - wholeCount * commonDenominator;
  const remainder = reduceSafeFraction(
    signedRemainder === 0 ? 0 : signedRemainder,
    commonDenominator,
  )!;
  return {
    left,
    right,
    commonDenominator,
    leftCommonNumerator,
    rightCommonNumerator,
    commonSumNumerator,
    sum,
    wholeCount,
    remainder,
  };
}

export function simplifyFraction(numerator: number, denominator: number) {
  const result = normalizeFraction(numerator, denominator);
  if (!result) throw new RangeError("Invalid bounded fraction.");
  return result;
}

export function addFractions(a: number, b: number, c: number, d: number) {
  const result = addFractionParts(a, b, c, d);
  if (!result) throw new RangeError("Invalid bounded fraction addition.");
  return result.sum;
}
