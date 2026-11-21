import React, { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, RotateCcw, Upload } from 'lucide-react';
import { Button } from './common/Button';
import { FormField } from './FormField';
import { useTheme, type OrgBrandConfig } from '../hooks/useTheme';
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  PREFERRED_STABLECOINS,
  readOrganizationSettings,
  resetOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationSettingsData,
  type PreferredStablecoin,
} from '../services/organizationSettings';
import {
  AA_CONTRAST,
  contrastRatio,
  isValidHexColor,
  normalizeHexColor,
  readableTextOn,
  sanitizeLogoUrl,
  sanitizeOrgName,
} from '../utils/brand';
import { processImageUpload } from '../utils/imageOptimization';

const DEFAULT_PRIMARY = '#0a2540';
const DEFAULT_ACCENT = '#14b8a6';

interface OrganizationFormState {
  orgName: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  preferredStablecoin: PreferredStablecoin;
  primaryColor: string;
  accentColor: string;
}

function createInitialForm(
  brandConfig: OrgBrandConfig,
  settings: OrganizationSettingsData
): OrganizationFormState {
  return {
    orgName: brandConfig.orgName ?? '',
    logoUrl: brandConfig.logoUrl ?? '',
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    preferredStablecoin: settings.preferredStablecoin,
    primaryColor: brandConfig.primaryColor ?? DEFAULT_PRIMARY,
    accentColor: brandConfig.accentColor ?? DEFAULT_ACCENT,
  };
}

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  invalid: boolean;
  errorMessage: string;
  onChange: (value: string) => void;
}

const ColorField: React.FC<ColorFieldProps> = ({
  id,
  label,
  value,
  invalid,
  errorMessage,
  onChange,
}) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-sm font-semibold text-[var(--text)]">
      {label}
    </label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${label} picker`}
        className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--border-hi)] bg-transparent"
        value={normalizeHexColor(value) ?? DEFAULT_PRIMARY}
        onChange={(event) => onChange(event.target.value)}
      />
      <input
        id={id}
        className="w-full rounded-xl border border-[var(--border-hi)] bg-[var(--surface-hi)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        value={value}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
    {invalid && (
      <p role="alert" className="text-xs text-[var(--danger,#dc2626)]">
        {errorMessage}
      </p>
    )}
  </div>
);

export const OrganizationSettings: React.FC = () => {
  const { t } = useTranslation();
  const { brandConfig, setBrandConfig, resetBrandConfig } = useTheme();
  const ids = {
    name: useId(),
    logo: useId(),
    file: useId(),
    email: useId(),
    phone: useId(),
    stablecoin: useId(),
    primary: useId(),
    accent: useId(),
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<OrganizationFormState>(() =>
    createInitialForm(brandConfig, readOrganizationSettings())
  );
  const initial = useRef(form);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [touched, setTouched] = useState(false);

  const update = (patch: Partial<OrganizationFormState>) => {
    setForm((previous) => ({ ...previous, ...patch }));
    setStatus('');
    setTouched(true);
  };

  const orgName = sanitizeOrgName(form.orgName);
  const logoUrl = sanitizeLogoUrl(form.logoUrl);
  const contactEmail = form.contactEmail.trim();
  const contactPhone = form.contactPhone.trim();
  const nameInvalid = orgName === null;
  const logoInvalid = form.logoUrl.trim() !== '' && logoUrl === null;
  const emailInvalid = contactEmail !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail);
  const phoneInvalid = contactPhone !== '' && !/^\+?[\d\s().-]{7,25}$/.test(contactPhone);
  const primaryInvalid = !isValidHexColor(form.primaryColor);
  const accentInvalid = !isValidHexColor(form.accentColor);
  const hasErrors =
    nameInvalid || logoInvalid || emailInvalid || phoneInvalid || primaryInvalid || accentInvalid;

  const previewPrimary = normalizeHexColor(form.primaryColor) ?? DEFAULT_PRIMARY;
  const previewAccent = normalizeHexColor(form.accentColor) ?? DEFAULT_ACCENT;
  const onPrimary = readableTextOn(previewPrimary);
  const ratio = contrastRatio(previewPrimary, onPrimary);

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (hasErrors) return;

    const primaryColor = normalizeHexColor(form.primaryColor) ?? DEFAULT_PRIMARY;
    const accentColor = normalizeHexColor(form.accentColor) ?? DEFAULT_ACCENT;
    setBrandConfig((previous) => ({
      ...previous,
      orgName: orgName ?? undefined,
      logoUrl: logoUrl ?? undefined,
      primaryColor,
      accentColor,
    }));
    saveOrganizationSettings({
      contactEmail,
      contactPhone,
      preferredStablecoin: form.preferredStablecoin,
    });

    const saved: OrganizationFormState = {
      orgName: orgName ?? '',
      logoUrl: logoUrl ?? '',
      contactEmail,
      contactPhone,
      preferredStablecoin: form.preferredStablecoin,
      primaryColor,
      accentColor,
    };
    initial.current = saved;
    setForm(saved);
    setStatus(t('settings.orgSaved'));
  };

  const handleCancel = () => {
    setForm(initial.current);
    setTouched(false);
    setStatus(t('settings.orgCancelled'));
  };

  const handleReset = () => {
    resetBrandConfig();
    resetOrganizationSettings();
    const cleared = createInitialForm({}, DEFAULT_ORGANIZATION_SETTINGS);
    initial.current = cleared;
    setForm(cleared);
    setTouched(false);
    setStatus(t('settings.orgResetDone'));
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatus('');
    try {
      const uploaded = await processImageUpload(file, { maxWidth: 400, maxHeight: 400 });
      const safeUrl = sanitizeLogoUrl(uploaded);
      if (!safeUrl) {
        setStatus(t('settings.orgLogoUploadFailed'));
        return;
      }
      update({ logoUrl: safeUrl });
      setStatus(t('settings.orgLogoUploaded'));
    } catch {
      setStatus(t('settings.orgLogoUploadFailed'));
    } finally {
      input.value = '';
      setUploading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-[var(--border-hi)] bg-[var(--surface-hi)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  return (
    <div className="card glass noise p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)] p-2.5">
          <Building2 className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">{t('settings.orgTitle')}</h2>
          <p className="text-sm text-[var(--muted)] mt-1">{t('settings.orgDescription')}</p>
        </div>
      </div>

      <form onSubmit={handleSave} noValidate className="grid gap-5 md:grid-cols-2">
        <FormField
          id={ids.name}
          label={t('settings.orgNameLabel')}
          error={touched && nameInvalid ? t('settings.orgNameError') : undefined}
          maxLength={60}
        >
          <input
            className={inputClass}
            value={form.orgName}
            onChange={(event) => update({ orgName: event.target.value })}
          />
        </FormField>

        <FormField
          id={ids.logo}
          label={t('settings.orgLogoLabel')}
          helpText={t('settings.orgLogoHelp')}
          error={touched && logoInvalid ? t('settings.orgLogoError') : undefined}
        >
          <input
            type="url"
            inputMode="url"
            className={inputClass}
            value={form.logoUrl}
            placeholder={t('settings.orgLogoPlaceholder')}
            onChange={(event) => update({ logoUrl: event.target.value })}
          />
        </FormField>

        <div className="md:col-span-2 flex flex-wrap items-center gap-3 -mt-2">
          <input
            id={ids.file}
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label={t('settings.orgLogoFileLabel')}
            onChange={(event) => void handleLogoUpload(event)}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {uploading ? t('settings.orgUploading') : t('settings.orgUploadLogo')}
          </Button>
        </div>

        <FormField
          id={ids.email}
          label={t('settings.orgEmailLabel')}
          optional
          error={touched && emailInvalid ? t('settings.orgEmailError') : undefined}
        >
          <input
            type="email"
            className={inputClass}
            value={form.contactEmail}
            placeholder={t('settings.orgEmailPlaceholder')}
            onChange={(event) => update({ contactEmail: event.target.value })}
          />
        </FormField>

        <FormField
          id={ids.phone}
          label={t('settings.orgPhoneLabel')}
          optional
          error={touched && phoneInvalid ? t('settings.orgPhoneError') : undefined}
        >
          <input
            type="tel"
            className={inputClass}
            value={form.contactPhone}
            placeholder={t('settings.orgPhonePlaceholder')}
            onChange={(event) => update({ contactPhone: event.target.value })}
          />
        </FormField>

        <FormField
          id={ids.stablecoin}
          label={t('settings.orgStablecoinLabel')}
          helpText={t('settings.orgStablecoinHelp')}
        >
          <select
            className={inputClass}
            value={form.preferredStablecoin}
            onChange={(event) =>
              update({ preferredStablecoin: event.target.value as PreferredStablecoin })
            }
          >
            {PREFERRED_STABLECOINS.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </FormField>

        <ColorField
          id={ids.primary}
          label={t('settings.orgPrimaryColor')}
          value={form.primaryColor}
          invalid={touched && primaryInvalid}
          errorMessage={t('settings.orgColorError')}
          onChange={(value) => update({ primaryColor: value })}
        />

        <ColorField
          id={ids.accent}
          label={t('settings.orgAccentColor')}
          value={form.accentColor}
          invalid={touched && accentInvalid}
          errorMessage={t('settings.orgColorError')}
          onChange={(value) => update({ accentColor: value })}
        />

        <div
          className="md:col-span-2 rounded-2xl border border-[var(--border-hi)] p-4"
          aria-label={t('settings.orgPreviewLabel')}
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)] mb-3">
            {t('settings.orgPreview')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={t('settings.orgLogoAlt')}
                className="h-10 w-10 rounded-lg object-contain"
              />
            )}
            <span className="text-sm font-bold text-[var(--text)]">
              {orgName ?? t('settings.orgPreviewName')}
            </span>
            <span
              className="rounded-xl px-4 py-2 text-sm font-bold"
              style={{ background: previewPrimary, color: onPrimary }}
            >
              {t('settings.orgPreviewAction')}
            </span>
            <span className="text-sm font-semibold" style={{ color: previewAccent }}>
              {t('settings.orgPreviewLink')}
            </span>
            <span className="text-xs text-[var(--muted)]">
              {t('settings.orgContrast', {
                ratio: ratio.toFixed(1),
                level:
                  ratio >= AA_CONTRAST
                    ? t('settings.orgContrastAa')
                    : t('settings.orgContrastBelowAa'),
              })}
            </span>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={hasErrors}>
            {t('settings.orgSave')}
          </Button>
          <Button type="button" variant="secondary" onClick={handleCancel}>
            {t('settings.orgCancel')}
          </Button>
          <Button type="button" variant="secondary" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t('settings.orgReset')}
          </Button>
          <span role="status" aria-live="polite" className="text-sm text-[var(--muted)]">
            {status}
          </span>
        </div>
      </form>
    </div>
  );
};

export default OrganizationSettings;
