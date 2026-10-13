import type { BirthYearBucket } from './dates';

export type BirthBandColors = Readonly<Record<string, string>>;
export interface BirthBandAccent {
  key: string;
  label: string;
  light: string;
  dark: string;
  pattern: 'solid' | 'dashed';
}
// Six repeating accent slots, never generational ranks. Text/surfaces stay themed.
const PALETTE = [
  ['#315b4e', '#8ed7bf'],
  ['#3561a8', '#9abfff'],
  ['#855296', '#dcb0ee'],
  ['#a04c31', '#f6b393'],
  ['#766112', '#e8d27d'],
  ['#9b466b', '#f1a4cc'],
] as const;

/** Portable opaque hex only: no functions, variables, alpha or CSS syntax. */
export function normalizeBirthBandColor(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 32) return null;
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color)) {
    return '#' + color.slice(1).split('').map((digit) => digit + digit).join('');
  }
  return null;
}

export function birthBandAccent(
  bucket: BirthYearBucket,
  custom: BirthBandColors = {},
): BirthBandAccent {
  const known = bucket.kind === 'years';
  const key = known ? `years:${bucket.startYear}` : 'unknown';
  const pair = known
    ? PALETTE[Math.floor(bucket.startYear / 25) % PALETTE.length]
    : ['#68766d', '#bcb4d3'];
  const override = normalizeBirthBandColor(custom[key]);
  return {
    key,
    label: known ? `Birth band ${bucket.label}` : 'Birth year unknown',
    light: override ?? pair[0],
    dark: override ?? pair[1],
    pattern: known ? 'solid' : 'dashed',
  };
}
