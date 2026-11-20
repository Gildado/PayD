import { describe, expect, it } from 'vitest';
import {
  AA_CONTRAST,
  contrastRatio,
  isValidHexColor,
  normalizeHexColor,
  readableTextOn,
  sanitizeLogoUrl,
  sanitizeOrgName,
} from '../brand';

describe('hex colours', () => {
  it('validates and normalises #rgb / #rrggbb', () => {
    expect(isValidHexColor('#0a2540')).toBe(true);
    expect(isValidHexColor('#FFF')).toBe(true);
    expect(isValidHexColor('red')).toBe(false);
    expect(isValidHexColor('#12345')).toBe(false);
    expect(isValidHexColor('#0a2540; background:url(x)')).toBe(false);
    expect(normalizeHexColor('#AbC')).toBe('#aabbcc');
    expect(normalizeHexColor('nope')).toBeNull();
  });
});

describe('contrast', () => {
  it('matches known WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('picks readable text for dark and light brand colours', () => {
    expect(readableTextOn('#0a2540')).toBe('#ffffff');
    expect(readableTextOn('#fde047')).toBe('#0b1b3a');
    for (const bg of ['#0a2540', '#fde047', '#14b8a6', '#ff0055', '#777777']) {
      expect(contrastRatio(bg, readableTextOn(bg))).toBeGreaterThanOrEqual(AA_CONTRAST - 0.5);
    }
  });
});

describe('sanitizeLogoUrl', () => {
  it('allows https and raster data URIs', () => {
    expect(sanitizeLogoUrl('https://cdn.acme.com/logo.png')).toBe('https://cdn.acme.com/logo.png');
    expect(sanitizeLogoUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('rejects unsafe or invalid sources', () => {
    expect(sanitizeLogoUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeLogoUrl('http://acme.com/logo.png')).toBeNull();
    expect(sanitizeLogoUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(sanitizeLogoUrl('not a url')).toBeNull();
    expect(sanitizeLogoUrl('')).toBeNull();
  });
});

describe('sanitizeOrgName', () => {
  it('trims, caps length and rejects empty', () => {
    expect(sanitizeOrgName('  Acme  ')).toBe('Acme');
    expect(sanitizeOrgName('x'.repeat(80))).toHaveLength(60);
    expect(sanitizeOrgName('   ')).toBeNull();
  });
});
