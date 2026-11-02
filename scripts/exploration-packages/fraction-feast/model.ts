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
  if (value.numerator === 0) return { numerator: 0, denominator: 1 };
  const divisor = gcd(value.numerator, value.denominator);
  return {
    numerator: value.numerator / divisor,
    denominator: value.denominator / divisor,
  };
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
  const sum = normalizeFraction(commonSumNumerator, commonDenominator);
  if (!sum) return null;
  const wholeCount = Math.trunc(commonSumNumerator / commonDenominator);
  const remainder = normalizeFraction(
    Math.abs(commonSumNumerator - wholeCount * commonDenominator),
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
