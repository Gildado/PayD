/**
 * Helpers for organization (multi-tenant) branding (#1505).
 *
 * Brand values come from an org admin, so they are validated before being
 * written into CSS custom properties or an <img src>, and text placed on a
 * brand colour is chosen to keep WCAG AA contrast.
 */

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Accepts #rgb or #rrggbb. */
export function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

/** Normalise to lowercase #rrggbb, or null when invalid. */
export function normalizeHexColor(value: unknown): string | null {
  if (!isValidHexColor(value)) return null;
  let hex = value.trim().toLowerCase().slice(1);
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return `#${hex}`;
}

function relativeLuminance(hex: string): number {
  const n = normalizeHexColor(hex);
  if (!n) throw new Error(`Invalid colour: ${hex}`);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two colours (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const ON_LIGHT_TEXT = '#0b1b3a';
export const ON_DARK_TEXT = '#ffffff';

/** Text colour (white or deep navy) with the higher contrast on `background`. */
export function readableTextOn(background: string): string {
  return contrastRatio(background, ON_DARK_TEXT) >= contrastRatio(background, ON_LIGHT_TEXT)
    ? ON_DARK_TEXT
    : ON_LIGHT_TEXT;
}

/** WCAG AA for normal text. */
export const AA_CONTRAST = 4.5;

/**
 * Only https URLs and raster data:image URIs are allowed as a logo source.
 * Rejects javascript:, http: (mixed content) and data:image/svg+xml (can
 * carry script when opened directly).
 */
export function sanitizeLogoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(url)) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Trimmed org name capped at 60 chars, or null when empty. */
export function sanitizeOrgName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().slice(0, 60);
  return name || null;
}
