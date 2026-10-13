import { describe, expect, it } from 'vitest';
import * as core from './index';

describe('shared birth-band accents', () => {
  it('keeps default accent contrast above 3 against current light/dark card surfaces', () => {
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map((offset) => {
        const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const ratio = (a: string, b: string) => {
      const x = luminance(a), y = luminance(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    for (const year of [null, '0001', '0025', '0050', '0075', '0100', '0125']) {
      const accent = core.birthBandAccent(core.birthYearPresentation(year).bucket);
      expect(ratio(accent.light, '#fffdf6')).toBeGreaterThanOrEqual(3);
      expect(ratio(accent.light, '#ffffff')).toBeGreaterThanOrEqual(3);
      expect(ratio(accent.dark, '#2c2849')).toBeGreaterThanOrEqual(3);
    }
  });
  it('exports a deterministic accent independent of generation or ordering', () => {
    expect(core).toHaveProperty('birthBandAccent');
    const a = core.birthYearPresentation('1975').bucket;
    const b = core.birthYearPresentation('1999-12-31').bucket;
    expect(core.birthBandAccent(a)).toEqual(core.birthBandAccent(b));
    expect(core.birthBandAccent(a).key).toBe('years:1975');
    expect(core.birthBandAccent(a).label).toBe('Birth band 1975–1999');
    expect(core.birthBandAccent(a).light).not.toBe(
      core.birthBandAccent(core.birthYearPresentation('2000').bucket).light,
    );
  });
  it('keeps unknown separate and maps every supported band to a finite palette', () => {
    const unknown = core.birthBandAccent(core.birthYearPresentation(null).bucket);
    expect(unknown).toMatchObject({ key: 'unknown', label: 'Birth year unknown', pattern: 'dashed' });
    const colors = new Set<string>();
    for (let year = 1; year <= 9999; year++) {
      const accent = core.birthBandAccent(core.birthYearPresentation(String(year).padStart(4, '0')).bucket);
      colors.add(accent.light);
      expect(accent.pattern).toBe('solid');
      expect(accent.light).toMatch(/^#[0-9a-f]{6}$/);
      expect(accent.dark).toMatch(/^#[0-9a-f]{6}$/);
      expect(accent.key).not.toBe('unknown');
    }
    expect(colors.size).toBe(6);
  });
  it('validates the same opaque hex subset for CSS and native; no injections or invisible colors', () => {
    expect(core).toHaveProperty('normalizeBirthBandColor');
    expect(core.normalizeBirthBandColor(' #AbC ')).toBe('#aabbcc');
    expect(core.normalizeBirthBandColor('#123456')).toBe('#123456');
    for (const value of ['', 'red', '#abcd', '#11223344', 'transparent', 'var(--text)', '#fff; background:url(x)', 'rgb(0,0,0)', null, 123]) {
      expect(core.normalizeBirthBandColor(value)).toBeNull();
    }
  });
  it('validates preferences again at rendering and does not mix custom bands or unknown', () => {
    expect(core).toHaveProperty('birthBandAccent');
    const bucket = core.birthYearPresentation('1984').bucket;
    const original = core.birthBandAccent(bucket);
    expect(core.birthBandAccent(bucket, { 'years:1975': '#fff' })).toMatchObject({ light: '#ffffff', dark: '#ffffff' });
    expect(core.birthBandAccent(bucket, { 'years:1975': 'url(evil)' })).toEqual(original);
    expect(core.birthBandAccent(core.birthYearPresentation(null).bucket, { 'years:1975': '#fff' }).key).toBe('unknown');
  });
});
