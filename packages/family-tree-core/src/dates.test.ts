import { describe, it, expect } from 'vitest';
import { parsePartialDate, partialDateRange, assessChronology, birthYearPresentation } from './index';

describe('Gregorian partial dates', () => {
  it.each([
    ['0001', 'year', '0001-01-01', '0001-12-31'],
    ['1984', 'year', '1984-01-01', '1984-12-31'],
    ['2000-02', 'month', '2000-02-01', '2000-02-29'],
    ['1900-02', 'month', '1900-02-01', '1900-02-28'],
    ['2024-02-29', 'day', '2024-02-29', '2024-02-29'],
    ['9999', 'year', '9999-01-01', '9999-12-31'],
  ])('retains %s as a range, not a fabricated timestamp', (value, precision, start, end) => {
    const date = parsePartialDate({ value, precision: 'day', uncertain: true });
    expect(date).toEqual({ value, precision, uncertain: true });
    expect(partialDateRange(date)).toMatchObject({ start, end, uncertain: true, precision });
  });
  it.each(['0000', '10000', '24', '1984-2', '1900-02-29', '2023-02-29', '2024-04-31', '2024-00', '2024-13', '2024-01-00', '2024-01-32', '2024-01-01T00:00:00Z', ' 1984', '1984 '])('rejects invalid value %s', value => {
    expect(() => parsePartialDate(value)).toThrow(/Invalid partial date/);
  });
  it('does not coerce malformed uncertainty or nonstrings', () => {
    expect(() => parsePartialDate({ value: '1984', uncertain: 'false' } as never)).toThrow(/uncertain/);
    expect(() => parsePartialDate(1984 as never)).toThrow(/Invalid partial date/);
  });
  it('keeps null unknown and Gregorian year 1 distinct from year 1901', () => {
    expect(parsePartialDate(null)).toBeNull();
    expect(partialDateRange(null)).toBeNull();
    expect(partialDateRange('0001-01-01')?.startOrdinal).toBe(1);
    expect(partialDateRange('0001-01-02')?.startOrdinal).toBe(2);
  });
  it('classifies definite contradictions, uncertainty and overlapping partial ranges without rounding', () => {
    expect(assessChronology('2001', '2000').status).toBe('error');
    expect(assessChronology({ value: '2001', uncertain: true }, '2000').status).toBe('warning');
    expect(assessChronology('2000', '2000-02').status).toBe('warning');
    expect(assessChronology('2000-01-01', '2000-01-01').status).toBe('valid');
    expect(assessChronology('2000', '2001').status).toBe('valid');
    expect(assessChronology(null, '2000').status).toBe('unknown');
  });
  it('uses a distinct unknown bucket and labels uncertainty, independent of graph generation', () => {
    expect(birthYearPresentation(null)).toEqual({ label: 'Birth year unknown', bucket: { kind: 'unknown', label: 'Birth year unknown' } });
    expect(birthYearPresentation({ value: '1984-02', uncertain: true })).toEqual({ label: 'Birth year 1984 (uncertain)', bucket: { kind: 'years', startYear: 1975, endYear: 1999, label: '1975–1999' } });
    expect(birthYearPresentation('0001').bucket).toMatchObject({ startYear: 1, endYear: 24 });
    expect(birthYearPresentation('9999').bucket).toMatchObject({ startYear: 9975, endYear: 9999 });
  });
});
