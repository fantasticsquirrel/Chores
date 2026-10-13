export type DatePrecision = 'year' | 'month' | 'day';
export interface PartialDateInput { value: string; precision?: DatePrecision; uncertain?: boolean }
export interface PartialDate { value: string; precision: DatePrecision; uncertain: boolean }
export type DateInput = string | PartialDateInput | null;
export interface PartialDateRange {
  start: string; end: string; startOrdinal: number; endOrdinal: number;
  precision: DatePrecision; uncertain: boolean;
}
export class PartialDateError extends Error {
  constructor(message = 'Invalid partial date') { super(message); this.name = 'PartialDateError'; }
}
const leap = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const daysInMonth = (year: number, month: number) => [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
const pad = (value: number, width = 2) => String(value).padStart(width, '0');
const dayString = (year: number, month: number, day: number) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
function ordinal(year: number, month: number, day: number): number {
  const prior = year - 1;
  let result = 365 * prior + Math.floor(prior / 4) - Math.floor(prior / 100) + Math.floor(prior / 400) + day;
  for (let m = 1; m < month; m++) result += daysInMonth(year, m);
  return result;
}
/** Derive precision from the literal value; caller-supplied precision is never authoritative. */
export function parsePartialDate(input: DateInput): PartialDate | null {
  if (input === null) return null;
  const value = typeof input === 'string' ? input : input?.value;
  if (typeof value !== 'string' || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) throw new PartialDateError();
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999 || (month !== undefined && (month < 1 || month > 12)) || (day !== undefined && (day < 1 || day > daysInMonth(year, month)))) throw new PartialDateError();
  const uncertain = typeof input === 'string' || input.uncertain === undefined ? false : input.uncertain;
  if (typeof uncertain !== 'boolean') throw new PartialDateError('Invalid partial date uncertain flag');
  return { value, precision: day !== undefined ? 'day' : month !== undefined ? 'month' : 'year', uncertain };
}
export function partialDateRange(input: DateInput): PartialDateRange | null {
  const date = parsePartialDate(input);
  if (!date) return null;
  const [year, month, day] = date.value.split('-').map(Number);
  const firstMonth = month ?? 1, lastMonth = month ?? 12;
  const firstDay = day ?? 1, lastDay = day ?? daysInMonth(year, lastMonth);
  return { start: dayString(year, firstMonth, firstDay), end: dayString(year, lastMonth, lastDay), startOrdinal: ordinal(year, firstMonth, firstDay), endOrdinal: ordinal(year, lastMonth, lastDay), precision: date.precision, uncertain: date.uncertain };
}
export interface ChronologyAssessment {
  status: 'unknown' | 'valid' | 'warning' | 'error';
  code: 'date_unknown' | 'chronology_valid' | 'chronology_uncertain' | 'chronology_overlap' | 'chronology_contradiction';
  message: string;
}
/** Birth/death, residence or episode start/end review; no manager approval is inferred. */
export function assessChronology(start: DateInput, end: DateInput): ChronologyAssessment {
  const a = partialDateRange(start), b = partialDateRange(end);
  if (!a || !b) return { status: 'unknown', code: 'date_unknown', message: 'Chronology has an unknown date.' };
  if (a.uncertain || b.uncertain) return { status: 'warning', code: 'chronology_uncertain', message: 'Uncertain chronology requires manager review.' };
  if (a.startOrdinal > b.endOrdinal) return { status: 'error', code: 'chronology_contradiction', message: 'End date is definitely before start date.' };
  if (a.endOrdinal > b.startOrdinal) return { status: 'warning', code: 'chronology_overlap', message: 'Overlapping partial dates require manager review.' };
  return { status: 'valid', code: 'chronology_valid', message: 'Recorded date ranges are ordered.' };
}
export type BirthYearBucket = { kind: 'unknown'; label: 'Birth year unknown' } | { kind: 'years'; startYear: number; endYear: number; label: string };
export interface BirthYearPresentation { label: string; bucket: BirthYearBucket }
export function birthYearPresentation(input: DateInput): BirthYearPresentation {
  const date = parsePartialDate(input);
  if (!date) return { label: 'Birth year unknown', bucket: { kind: 'unknown', label: 'Birth year unknown' } };
  const year = Number(date.value.slice(0, 4));
  const startYear = Math.max(1, Math.floor(year / 25) * 25), endYear = Math.min(9999, Math.floor(year / 25) * 25 + 24);
  return { label: `Birth year ${year}${date.uncertain ? ' (uncertain)' : ''}`, bucket: { kind: 'years', startYear, endYear, label: `${startYear}–${endYear}` } };
}
