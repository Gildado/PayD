import React, { useId, useState } from 'react';
import { Palette, RotateCcw } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import {
  AA_CONTRAST,
  contrastRatio,
  isValidHexColor,
  normalizeHexColor,
  readableTextOn,
  sanitizeLogoUrl,
  sanitizeOrgName,
} from '../utils/brand';

const DEFAULT_PRIMARY = '#0a2540';
const DEFAULT_ACCENT = '#14b8a6';

/**
 * Organization branding (#1505): logo, name, primary and accent colour.
 * Values are validated, previewed live, and applied app-wide via
 * ThemeProvider's --brand-* tokens in both light and dark mode.
 */
export const BrandingSettings: React.FC = () => {
  const { brandConfig, setBrandConfig, resetBrandConfig } = useTheme();
  const ids = { name: useId(), logo: useId(), primary: useId(), accent: useId(), err: useId() };

  const [orgName, setOrgName] = useState(brandConfig.orgName ?? '');
  const [logoUrl, setLogoUrl] = useState(brandConfig.logoUrl ?? '');
  const [primary, setPrimary] = useState(brandConfig.primaryColor ?? DEFAULT_PRIMARY);
  const [accent, setAccent] = useState(brandConfig.accentColor ?? DEFAULT_ACCENT);
  const [saved, setSaved] = useState(false);

  const logoInvalid = logoUrl.trim() !== '' && sanitizeLogoUrl(logoUrl) === null;
  const primaryInvalid = !isValidHexColor(primary);
  const accentInvalid = !isValidHexColor(accent);
  const hasErrors = logoInvalid || primaryInvalid || accentInvalid;

  const previewPrimary = normalizeHexColor(primary) ?? DEFAULT_PRIMARY;
  const onPrimary = readableTextOn(previewPrimary);
  const ratio = contrastRatio(previewPrimary, onPrimary);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors) return;
    setBrandConfig((prev) => ({
      ...prev,
      orgName: sanitizeOrgName(orgName) ?? undefined,
      logoUrl: sanitizeLogoUrl(logoUrl) ?? undefined,
      primaryColor: normalizeHexColor(primary) ?? undefined,
      accentColor: normalizeHexColor(accent) ?? undefined,
    }));
    setSaved(true);
  };

  const handleReset = () => {
    resetBrandConfig();
    setOrgName('');
    setLogoUrl('');
    setPrimary(DEFAULT_PRIMARY);
    setAccent(DEFAULT_ACCENT);
    setSaved(false);
  };

  const inputClass =
    'w-full rounded-xl border border-[var(--border-hi)] bg-[var(--surface-hi)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  return (
    <div className="card glass noise p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)] p-2.5">
          <Palette className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Organization branding</h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            Set your organization&apos;s logo and colours to theme your portal.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} noValidate className="grid gap-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={ids.name} className="text-sm font-semibold text-[var(--text)]">
            Organization name
          </label>
          <input id={ids.name} className={inputClass} value={orgName} maxLength={60}
            onChange={(e) => { setOrgName(e.target.value); setSaved(false); }} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={ids.logo} className="text-sm font-semibold text-[var(--text)]">
            Logo URL (https)
          </label>
          <input id={ids.logo} type="url" inputMode="url" className={inputClass} value={logoUrl}
            placeholder="https://cdn.example.com/logo.png"
            aria-invalid={logoInvalid} aria-describedby={logoInvalid ? ids.err : undefined}
            onChange={(e) => { setLogoUrl(e.target.value); setSaved(false); }} />
          {logoInvalid && (
            <p id={ids.err} role="alert" className="text-xs text-[var(--danger,#dc2626)]">
              Use an https:// image URL (PNG, JPG, GIF or WebP).
            </p>
          )}
        </div>

        {([
          ['Primary colour', ids.primary, primary, setPrimary, primaryInvalid],
          ['Accent colour', ids.accent, accent, setAccent, accentInvalid],
        ] as const).map(([label, id, value, set, invalid]) => (
          <div key={id} className="space-y-1.5">
            <label htmlFor={id} className="text-sm font-semibold text-[var(--text)]">{label}</label>
            <div className="flex items-center gap-2">
              <input type="color" aria-label={`${label} picker`}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--border-hi)] bg-transparent"
                value={normalizeHexColor(value) ?? DEFAULT_PRIMARY}
                onChange={(e) => { set(e.target.value); setSaved(false); }} />
              <input id={id} className={inputClass} value={value} aria-invalid={invalid}
                onChange={(e) => { set(e.target.value); setSaved(false); }} />
            </div>
            {invalid && (
              <p role="alert" className="text-xs text-[var(--danger,#dc2626)]">
                Enter a hex colour like #0a2540.
              </p>
            )}
          </div>
        ))}

        <div className="md:col-span-2 rounded-2xl border border-[var(--border-hi)] p-4" aria-label="Branding preview">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)] mb-3">Preview</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-xl px-4 py-2 text-sm font-bold"
              style={{ background: previewPrimary, color: onPrimary }}>
              Run payroll
            </span>
            <span className="text-sm font-semibold" style={{ color: normalizeHexColor(accent) ?? DEFAULT_ACCENT }}>
              View details →
            </span>
            <span className="text-xs text-[var(--muted)]">
              Button text contrast {ratio.toFixed(1)}:1 {ratio >= AA_CONTRAST ? '(AA)' : '(below AA)'}
            </span>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={hasErrors}
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--on-accent,#fff)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2">
            Save branding
          </button>
          <button type="button" onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hi)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset to PayD default
          </button>
          <span role="status" aria-live="polite" className="text-sm text-[var(--muted)]">
            {saved ? 'Branding saved.' : ''}
          </span>
        </div>
      </form>
    </div>
  );
};

export default BrandingSettings;
