const FRACTIONS: Array<[number, string]> = [
  [0.125, "1/8"],
  [0.25, "1/4"],
  [1 / 3, "1/3"],
  [0.5, "1/2"],
  [2 / 3, "2/3"],
  [0.75, "3/4"],
];

export function formatQuantity(value: number | null): string {
  if (value === null) return "";
  const whole = Math.trunc(value);
  const remainder = Math.abs(value - whole);
  const match = FRACTIONS.find(([fraction]) => Math.abs(remainder - fraction) < 0.02);
  if (match !== undefined) {
    if (whole === 0) return match[1];
    return `${whole} ${match[1]}`;
  }
  if (Number.isInteger(value)) return value.toString();
  return Number(value.toFixed(2)).toString();
}
