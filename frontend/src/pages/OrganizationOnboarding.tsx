import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StrKey } from '@stellar/stellar-sdk';
import { Button, ArrowLink } from '../components/common/Button';
import { OnboardingProgress } from '../components/OnboardingProgress';
import { useWallet } from '../hooks/useWallet';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { SUPPORTED_ASSETS } from '../config/assets';
import {
  ONBOARDING_STEPS,
  useOrgOnboardingStore,
  type OnboardingData,
  type OnboardingEmployee,
  type OnboardingStepId,
  type PayFrequency,
  type TeamSize,
} from '../stores/orgOnboardingStore';

// ── Static options ───────────────────────────────────────────────────────────

const COUNTRY_CODES = [
  'NG',
  'KE',
  'GH',
  'ZA',
  'US',
  'GB',
  'DE',
  'BR',
  'AR',
  'MX',
  'IN',
  'PH',
] as const;
const TEAM_SIZES: TeamSize[] = ['1-10', '11-50', '51-200', '200+'];
const FREQUENCIES: PayFrequency[] = ['weekly', 'biweekly', 'monthly'];
const MAX_DECIMALS = 7;

type FieldErrors = Record<string, string>;

function todayInputValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function newEmployee(): OnboardingEmployee {
  return {
    id: `emp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    wallet: '',
    amount: '',
  };
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function useRegionName() {
  const { i18n } = useTranslation();
  return useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([i18n.language || 'en'], { type: 'region' });
    } catch {
      names = null;
    }
    return (code: string) => {
      if (!code) return '—';
      try {
        return names?.of(code) ?? code;
      } catch {
        // DisplayNames throws on codes it doesn't recognise.
        return code;
      }
    };
  }, [i18n.language]);
}

// ── Validation ───────────────────────────────────────────────────────────────

function validateStep(
  step: OnboardingStepId,
  data: OnboardingData,
  walletAddress: string | null,
  t: (key: string, options?: Record<string, unknown>) => string
): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 'organization') {
    const name = data.organization.name.trim();
    if (name.length < 2) errors['onb-org-name'] = t('orgOnboarding.errors.orgName');
    if (!data.organization.country) errors['onb-org-country'] = t('orgOnboarding.errors.country');
    if (!data.organization.teamSize) errors['onb-team-size'] = t('orgOnboarding.errors.teamSize');
  }

  if (step === 'wallet' && !walletAddress && !data.treasuryAddress && !data.walletSkipped) {
    errors['onb-connect-wallet'] = t('orgOnboarding.errors.wallet');
  }

  if (step === 'payroll') {
    if (!data.payroll.asset) errors['onb-asset'] = t('orgOnboarding.errors.asset');
    if (!data.payroll.firstPayDate) {
      errors['onb-first-pay-date'] = t('orgOnboarding.errors.payDateRequired');
    } else if (data.payroll.firstPayDate < todayInputValue()) {
      errors['onb-first-pay-date'] = t('orgOnboarding.errors.payDatePast');
    }
  }

  if (step === 'team') {
    if (data.employees.length === 0 && !data.importRosterLater) {
      errors['onb-add-employee'] = t('orgOnboarding.errors.teamEmpty');
    }
    const seen = new Set<string>();
    data.employees.forEach((employee, index) => {
      const n = index + 1;
      if (!employee.name.trim()) {
        errors[`onb-emp-${employee.id}-name`] = t('orgOnboarding.errors.employeeName', { n });
      }
      const wallet = employee.wallet.trim();
      if (!StrKey.isValidEd25519PublicKey(wallet)) {
        errors[`onb-emp-${employee.id}-wallet`] = t('orgOnboarding.errors.employeeWallet', { n });
      } else if (seen.has(wallet)) {
        errors[`onb-emp-${employee.id}-wallet`] = t('orgOnboarding.errors.employeeWalletDup', {
          n,
        });
      }
      seen.add(wallet);
      const amount = employee.amount.trim();
      const [, fraction = ''] = amount.split('.');
      if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0 || fraction.length > MAX_DECIMALS) {
        errors[`onb-emp-${employee.id}-amount`] = t('orgOnboarding.errors.employeeAmount', { n });
      }
    });
  }

  return errors;
}

// ── Small field helpers ──────────────────────────────────────────────────────

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="onb-error">
      <AlertCircle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

function describedBy(...ids: (string | false | undefined)[]) {
  const value = ids.filter(Boolean).join(' ');
  return value || undefined;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OrganizationOnboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const regionName = useRegionName();
  const { address, connect, status: walletStatus, walletDisplayName } = useWallet();

  const { status, stepIndex, maxStepIndex, data, goToStep, update, complete, reset } =
    useOrgOnboardingStore();

  const [errors, setErrors] = useState<FieldErrors>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const summaryTitleId = useId();

  const step = ONBOARDING_STEPS[stepIndex];
  const stepLabels: Record<OnboardingStepId, string> = {
    organization: t('orgOnboarding.steps.organization'),
    wallet: t('orgOnboarding.steps.wallet'),
    payroll: t('orgOnboarding.steps.payroll'),
    team: t('orgOnboarding.steps.team'),
    review: t('orgOnboarding.steps.review'),
  };
  const progressSteps = ONBOARDING_STEPS.map((id) => ({ id, label: stepLabels[id] }));
  const errorEntries = Object.entries(errors);

  // Move focus to the new step's heading so keyboard and screen-reader users
  // land at the top of the content that just changed.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [stepIndex, status]);

  // The wallet step is satisfied as soon as a wallet connects.
  useEffect(() => {
    if (address && errors['onb-connect-wallet']) setErrors({});
  }, [address, errors]);

  const setOrg = (patch: Partial<OnboardingData['organization']>) =>
    update({ organization: { ...data.organization, ...patch } });
  const setPayroll = (patch: Partial<OnboardingData['payroll']>) =>
    update({ payroll: { ...data.payroll, ...patch } });
  const setEmployee = (id: string, patch: Partial<OnboardingEmployee>) =>
    update({
      employees: data.employees.map((employee) =>
        employee.id === id ? { ...employee, ...patch } : employee
      ),
    });

  const clearError = (fieldId: string) => {
    if (!errors[fieldId]) return;
    setErrors((current) => {
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  };

  const goTo = (index: number) => {
    setErrors({});
    goToStep(index);
  };

  const handleContinue = () => {
    const found = validateStep(step, data, address, t);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      // Let the summary render, then move focus to it.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (step === 'wallet' && address) {
      update({ treasuryAddress: address, walletSkipped: false });
    }
    if (step === 'review') {
      complete();
      return;
    }
    goTo(stepIndex + 1);
  };

  const panelClass = `onb-panel${reduceMotion ? '' : ' onb-panel-enter'}`;

  // ── Completed ──────────────────────────────────────────────────────────────
  if (status === 'completed') {
    return (
      <main className="onb-shell">
        <section className={`${panelClass} onb-done`} aria-labelledby="onb-done-title">
          <span className="onb-done-badge motion-success-badge" aria-hidden="true">
            <CheckCircle2 size={32} />
          </span>
          <h1 id="onb-done-title" ref={headingRef} tabIndex={-1} className="onb-title">
            {t('orgOnboarding.done.title', { org: data.organization.name || 'PayD' })}
          </h1>
          <p className="onb-lede mx-auto">{t('orgOnboarding.done.body')}</p>

          <ul className="onb-next-steps">
            <li className="onb-next-step">
              <h3>{t('orgOnboarding.done.runTitle')}</h3>
              <p>{t('orgOnboarding.done.runBody')}</p>
              <ArrowLink to="/payroll" className="mt-auto text-sm">
                {t('orgOnboarding.done.runLink')}
              </ArrowLink>
            </li>
            <li className="onb-next-step">
              <h3>{t('orgOnboarding.done.teamTitle')}</h3>
              <p>{t('orgOnboarding.done.teamBody')}</p>
              <ArrowLink
                to={data.importRosterLater ? '/bulk-upload' : '/employee'}
                className="mt-auto text-sm"
              >
                {data.importRosterLater
                  ? t('orgOnboarding.done.csvLink')
                  : t('orgOnboarding.done.teamLink')}
              </ArrowLink>
            </li>
            <li className="onb-next-step">
              <h3>{t('orgOnboarding.done.walletTitle')}</h3>
              <p>
                {data.treasuryAddress
                  ? t('orgOnboarding.done.walletReady', {
                      address: shortAddress(data.treasuryAddress),
                    })
                  : t('orgOnboarding.done.walletPending')}
              </p>
              <ArrowLink to="/settings" className="mt-auto text-sm">
                {t('orgOnboarding.done.settingsLink')}
              </ArrowLink>
            </li>
          </ul>

          <div className="onb-actions">
            <Button variant="secondary" onClick={reset}>
              {t('orgOnboarding.done.startOver')}
            </Button>
            <Button onClick={() => void navigate('/payroll')}>
              {t('orgOnboarding.done.cta')}
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
        </section>
      </main>
    );
  }

  // ── Steps ──────────────────────────────────────────────────────────────────
  return (
    <main className="onb-shell">
      <header className="onb-intro">
        <p className="onb-eyebrow">{t('orgOnboarding.eyebrow')}</p>
        <h1 className="onb-title">{t('orgOnboarding.title')}</h1>
        <p className="onb-lede">{t('orgOnboarding.lede')}</p>
      </header>

      <OnboardingProgress
        steps={progressSteps}
        currentIndex={stepIndex}
        maxReachedIndex={maxStepIndex}
        onStepSelect={goTo}
      />

      <section key={step} className={panelClass} aria-labelledby={`onb-step-${step}`}>
        <h2 id={`onb-step-${step}`} ref={headingRef} tabIndex={-1} className="onb-step-title">
          {t(`orgOnboarding.${step}.title`)}
        </h2>
        <p className="onb-step-desc">{t(`orgOnboarding.${step}.desc`)}</p>

        {errorEntries.length > 0 ? (
          <div
            ref={summaryRef}
            className="onb-error-summary mt-6"
            role="alert"
            tabIndex={-1}
            aria-labelledby={summaryTitleId}
          >
            <p id={summaryTitleId} className="m-0 font-semibold">
              {t('orgOnboarding.errors.summary', { count: errorEntries.length })}
            </p>
            <ul>
              {errorEntries.map(([fieldId, message]) => (
                <li key={fieldId}>
                  <a
                    href={`#${fieldId}`}
                    onClick={(event) => {
                      event.preventDefault();
                      document.getElementById(fieldId)?.focus();
                    }}
                  >
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="onb-step-body">
          {step === 'organization' ? (
            <>
              <div className="onb-field">
                <label htmlFor="onb-org-name" className="onb-label">
                  {t('orgOnboarding.organization.name')}
                  <span className="onb-required" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="onb-org-name"
                  className="onb-input"
                  autoComplete="organization"
                  required
                  aria-invalid={errors['onb-org-name'] ? true : undefined}
                  aria-describedby={describedBy(errors['onb-org-name'] && 'onb-org-name-error')}
                  value={data.organization.name}
                  placeholder={t('orgOnboarding.organization.namePlaceholder')}
                  onChange={(event) => {
                    setOrg({ name: event.target.value });
                    clearError('onb-org-name');
                  }}
                />
                <FieldError id="onb-org-name-error" message={errors['onb-org-name']} />
              </div>

              <div className="onb-field">
                <label htmlFor="onb-org-country" className="onb-label">
                  {t('orgOnboarding.organization.country')}
                  <span className="onb-required" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  id="onb-org-country"
                  className="onb-input"
                  required
                  aria-invalid={errors['onb-org-country'] ? true : undefined}
                  aria-describedby={describedBy(
                    'onb-org-country-help',
                    errors['onb-org-country'] && 'onb-org-country-error'
                  )}
                  value={data.organization.country}
                  onChange={(event) => {
                    setOrg({ country: event.target.value });
                    clearError('onb-org-country');
                  }}
                >
                  <option value="">{t('orgOnboarding.organization.countryPlaceholder')}</option>
                  {COUNTRY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {regionName(code)}
                    </option>
                  ))}
                  <option value="OTHER">{t('orgOnboarding.organization.countryOther')}</option>
                </select>
                <p id="onb-org-country-help" className="onb-help">
                  {t('orgOnboarding.organization.countryHelp')}
                </p>
                <FieldError id="onb-org-country-error" message={errors['onb-org-country']} />
              </div>

              <fieldset
                className="onb-field"
                aria-describedby={describedBy(errors['onb-team-size'] && 'onb-team-size-error')}
              >
                <legend className="onb-label mb-2">
                  {t('orgOnboarding.organization.teamSize')}
                  <span className="onb-required" aria-hidden="true">
                    *
                  </span>
                </legend>
                <div className="onb-choices">
                  {TEAM_SIZES.map((size, index) => (
                    <label key={size} className="onb-choice">
                      <input
                        type="radio"
                        name="onb-team-size"
                        id={index === 0 ? 'onb-team-size' : undefined}
                        value={size}
                        checked={data.organization.teamSize === size}
                        onChange={() => {
                          setOrg({ teamSize: size });
                          clearError('onb-team-size');
                        }}
                      />
                      <span className="onb-choice-title">{size}</span>
                      <span className="onb-choice-meta">
                        {t('orgOnboarding.organization.people')}
                      </span>
                      <Check size={16} className="onb-choice-check" aria-hidden="true" />
                    </label>
                  ))}
                </div>
                <FieldError id="onb-team-size-error" message={errors['onb-team-size']} />
              </fieldset>
            </>
          ) : null}

          {step === 'wallet' ? (
            <>
              {address ? (
                <div className="onb-callout" data-tone="success" role="status">
                  <span className="onb-callout-icon" aria-hidden="true">
                    <CheckCircle2 size={20} />
                  </span>
                  <div>
                    <p className="onb-callout-title">
                      {t('orgOnboarding.wallet.connected', {
                        wallet: walletDisplayName ?? 'Stellar',
                      })}
                    </p>
                    <p className="onb-callout-body font-mono">{address}</p>
                  </div>
                </div>
              ) : (
                <div className="onb-callout">
                  <span className="onb-callout-icon" aria-hidden="true">
                    <Wallet size={20} />
                  </span>
                  <div className="flex-1">
                    <p className="onb-callout-title">{t('orgOnboarding.wallet.whyTitle')}</p>
                    <p className="onb-callout-body">{t('orgOnboarding.wallet.whyBody')}</p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Button
                        id="onb-connect-wallet"
                        size="sm"
                        onClick={() => {
                          void connect();
                        }}
                        disabled={walletStatus === 'connecting'}
                        aria-busy={walletStatus === 'connecting'}
                        aria-describedby={describedBy(
                          errors['onb-connect-wallet'] && 'onb-connect-wallet-error'
                        )}
                      >
                        <Wallet size={16} aria-hidden="true" />
                        {walletStatus === 'connecting'
                          ? t('connectAccount.connecting')
                          : t('orgOnboarding.wallet.connect')}
                      </Button>
                      {!data.walletSkipped ? (
                        <button
                          type="button"
                          className="link-arrow text-sm"
                          onClick={() => {
                            update({ walletSkipped: true });
                            clearError('onb-connect-wallet');
                          }}
                        >
                          {t('orgOnboarding.wallet.later')}
                        </button>
                      ) : null}
                    </div>
                    <FieldError
                      id="onb-connect-wallet-error"
                      message={errors['onb-connect-wallet']}
                    />
                  </div>
                </div>
              )}

              {!address && data.walletSkipped ? (
                <div className="onb-callout" data-tone="warning" role="status">
                  <span className="onb-callout-icon" aria-hidden="true">
                    <ShieldAlert size={20} />
                  </span>
                  <div>
                    <p className="onb-callout-title">{t('orgOnboarding.wallet.skippedTitle')}</p>
                    <p className="onb-callout-body">{t('orgOnboarding.wallet.skippedBody')}</p>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {step === 'payroll' ? (
            <>
              <fieldset className="onb-field">
                <legend className="onb-label mb-2">
                  {t('orgOnboarding.payroll.asset')}
                  <span className="onb-required" aria-hidden="true">
                    *
                  </span>
                </legend>
                <div className="onb-choices">
                  {SUPPORTED_ASSETS.map((asset, index) => (
                    <label key={asset.code} className="onb-choice">
                      <input
                        type="radio"
                        name="onb-asset"
                        id={index === 0 ? 'onb-asset' : undefined}
                        value={asset.code}
                        checked={data.payroll.asset === asset.code}
                        onChange={() => {
                          setPayroll({ asset: asset.code });
                          clearError('onb-asset');
                        }}
                      />
                      <span className="onb-choice-title">{asset.code}</span>
                      <span className="onb-choice-meta">
                        {asset.label.replace(/\s*\(.*\)$/, '')}
                      </span>
                      <Check size={16} className="onb-choice-check" aria-hidden="true" />
                    </label>
                  ))}
                </div>
                <FieldError id="onb-asset-error" message={errors['onb-asset']} />
              </fieldset>

              <fieldset className="onb-field">
                <legend className="onb-label mb-2">{t('orgOnboarding.payroll.frequency')}</legend>
                <div className="onb-choices">
                  {FREQUENCIES.map((frequency) => (
                    <label key={frequency} className="onb-choice">
                      <input
                        type="radio"
                        name="onb-frequency"
                        value={frequency}
                        checked={data.payroll.frequency === frequency}
                        onChange={() => setPayroll({ frequency })}
                      />
                      <span className="onb-choice-title">
                        {t(`orgOnboarding.payroll.freq_${frequency}`)}
                      </span>
                      <span className="onb-choice-meta">
                        {t(`orgOnboarding.payroll.freqMeta_${frequency}`)}
                      </span>
                      <Check size={16} className="onb-choice-check" aria-hidden="true" />
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="onb-field sm:max-w-xs">
                <label htmlFor="onb-first-pay-date" className="onb-label">
                  {t('orgOnboarding.payroll.firstPayDate')}
                  <span className="onb-required" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="onb-first-pay-date"
                  type="date"
                  className="onb-input"
                  required
                  min={todayInputValue()}
                  aria-invalid={errors['onb-first-pay-date'] ? true : undefined}
                  aria-describedby={describedBy(
                    'onb-first-pay-date-help',
                    errors['onb-first-pay-date'] && 'onb-first-pay-date-error'
                  )}
                  value={data.payroll.firstPayDate}
                  onChange={(event) => {
                    setPayroll({ firstPayDate: event.target.value });
                    clearError('onb-first-pay-date');
                  }}
                />
                <p id="onb-first-pay-date-help" className="onb-help">
                  {t('orgOnboarding.payroll.firstPayDateHelp')}
                </p>
                <FieldError id="onb-first-pay-date-error" message={errors['onb-first-pay-date']} />
              </div>
            </>
          ) : null}

          {step === 'team' ? (
            <>
              {data.employees.length > 0 ? (
                <ul className="onb-employees" aria-label={t('orgOnboarding.team.listLabel')}>
                  {data.employees.map((employee, index) => {
                    const base = `onb-emp-${employee.id}`;
                    const n = index + 1;
                    return (
                      <li key={employee.id} className="onb-employee">
                        <div className="onb-field">
                          <label htmlFor={`${base}-name`} className="onb-label">
                            <span className="sr-only">
                              {t('orgOnboarding.team.rowPrefix', { n })}{' '}
                            </span>
                            {t('orgOnboarding.team.nameLabel')}
                          </label>
                          <input
                            id={`${base}-name`}
                            className="onb-input"
                            autoComplete="off"
                            aria-invalid={errors[`${base}-name`] ? true : undefined}
                            aria-describedby={describedBy(
                              errors[`${base}-name`] && `${base}-name-error`
                            )}
                            value={employee.name}
                            onChange={(event) => {
                              setEmployee(employee.id, { name: event.target.value });
                              clearError(`${base}-name`);
                            }}
                          />
                          <FieldError id={`${base}-name-error`} message={errors[`${base}-name`]} />
                        </div>
                        <div className="onb-field">
                          <label htmlFor={`${base}-wallet`} className="onb-label">
                            <span className="sr-only">
                              {t('orgOnboarding.team.rowPrefix', { n })}{' '}
                            </span>
                            {t('orgOnboarding.team.walletLabel')}
                          </label>
                          <input
                            id={`${base}-wallet`}
                            className="onb-input onb-input-mono"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="G…"
                            aria-invalid={errors[`${base}-wallet`] ? true : undefined}
                            aria-describedby={describedBy(
                              errors[`${base}-wallet`] && `${base}-wallet-error`
                            )}
                            value={employee.wallet}
                            onChange={(event) => {
                              setEmployee(employee.id, { wallet: event.target.value.trim() });
                              clearError(`${base}-wallet`);
                            }}
                          />
                          <FieldError
                            id={`${base}-wallet-error`}
                            message={errors[`${base}-wallet`]}
                          />
                        </div>
                        <div className="onb-field">
                          <label htmlFor={`${base}-amount`} className="onb-label">
                            <span className="sr-only">
                              {t('orgOnboarding.team.rowPrefix', { n })}{' '}
                            </span>
                            {t('orgOnboarding.team.amountLabel', { asset: data.payroll.asset })}
                          </label>
                          <input
                            id={`${base}-amount`}
                            className="onb-input"
                            inputMode="decimal"
                            autoComplete="off"
                            aria-invalid={errors[`${base}-amount`] ? true : undefined}
                            aria-describedby={describedBy(
                              errors[`${base}-amount`] && `${base}-amount-error`
                            )}
                            value={employee.amount}
                            onChange={(event) => {
                              setEmployee(employee.id, { amount: event.target.value });
                              clearError(`${base}-amount`);
                            }}
                          />
                          <FieldError
                            id={`${base}-amount-error`}
                            message={errors[`${base}-amount`]}
                          />
                        </div>
                        <button
                          type="button"
                          className="onb-employee-remove"
                          aria-label={t('orgOnboarding.team.remove', {
                            name: employee.name.trim() || t('orgOnboarding.team.employeeN', { n }),
                          })}
                          onClick={() =>
                            update({
                              employees: data.employees.filter((item) => item.id !== employee.id),
                            })
                          }
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="onb-callout">
                  <span className="onb-callout-icon" aria-hidden="true">
                    <Users size={20} />
                  </span>
                  <div>
                    <p className="onb-callout-title">{t('orgOnboarding.team.emptyTitle')}</p>
                    <p className="onb-callout-body">{t('orgOnboarding.team.emptyBody')}</p>
                  </div>
                </div>
              )}

              <div>
                <Button
                  id="onb-add-employee"
                  variant="secondary"
                  size="sm"
                  aria-describedby={describedBy(
                    errors['onb-add-employee'] && 'onb-add-employee-error'
                  )}
                  onClick={() => {
                    const employee = newEmployee();
                    update({ employees: [...data.employees, employee], importRosterLater: false });
                    clearError('onb-add-employee');
                    requestAnimationFrame(() =>
                      document.getElementById(`onb-emp-${employee.id}-name`)?.focus()
                    );
                  }}
                >
                  <Plus size={16} aria-hidden="true" />
                  {t('orgOnboarding.team.add')}
                </Button>
                <FieldError id="onb-add-employee-error" message={errors['onb-add-employee']} />
              </div>

              {data.employees.length === 0 ? (
                <label className="onb-checkbox">
                  <input
                    type="checkbox"
                    checked={data.importRosterLater}
                    onChange={(event) => {
                      update({ importRosterLater: event.target.checked });
                      clearError('onb-add-employee');
                    }}
                  />
                  <span>{t('orgOnboarding.team.importLater')}</span>
                </label>
              ) : null}
            </>
          ) : null}

          {step === 'review' ? (
            <ul className="onb-review">
              <ReviewRow
                icon={<Building2 size={18} />}
                title={stepLabels.organization}
                onEdit={() => goTo(0)}
                editLabel={t('orgOnboarding.review.edit', { section: stepLabels.organization })}
              >
                {data.organization.name} ·{' '}
                {data.organization.country === 'OTHER'
                  ? t('orgOnboarding.organization.countryOther')
                  : regionName(data.organization.country)}{' '}
                · {t('orgOnboarding.review.people', { size: data.organization.teamSize })}
              </ReviewRow>
              <ReviewRow
                icon={<Wallet size={18} />}
                title={stepLabels.wallet}
                onEdit={() => goTo(1)}
                editLabel={t('orgOnboarding.review.edit', { section: stepLabels.wallet })}
                missing={!data.treasuryAddress}
              >
                {data.treasuryAddress
                  ? `${walletDisplayName ?? 'Stellar'} · ${shortAddress(data.treasuryAddress)}`
                  : t('orgOnboarding.review.walletMissing')}
              </ReviewRow>
              <ReviewRow
                icon={<CalendarClock size={18} />}
                title={stepLabels.payroll}
                onEdit={() => goTo(2)}
                editLabel={t('orgOnboarding.review.edit', { section: stepLabels.payroll })}
              >
                {data.payroll.asset} · {t(`orgOnboarding.payroll.freq_${data.payroll.frequency}`)} ·{' '}
                {t('orgOnboarding.review.firstRun', { date: data.payroll.firstPayDate })}
              </ReviewRow>
              <ReviewRow
                icon={<Users size={18} />}
                title={stepLabels.team}
                onEdit={() => goTo(3)}
                editLabel={t('orgOnboarding.review.edit', { section: stepLabels.team })}
              >
                {data.employees.length > 0
                  ? t('orgOnboarding.review.employees', {
                      count: data.employees.length,
                      total: data.employees
                        .reduce((sum, employee) => sum + Number(employee.amount || 0), 0)
                        .toLocaleString(undefined, { maximumFractionDigits: MAX_DECIMALS }),
                      asset: data.payroll.asset,
                    })
                  : t('orgOnboarding.review.csvLater')}
              </ReviewRow>
            </ul>
          ) : null}
        </div>

        <div className="onb-actions">
          {stepIndex > 0 ? (
            <Button variant="secondary" onClick={() => goTo(stepIndex - 1)}>
              <ArrowLeft size={18} aria-hidden="true" />
              {t('orgOnboarding.back')}
            </Button>
          ) : null}
          <div className="onb-actions-end">
            {stepIndex === 0 ? (
              <ArrowLink to="/" className="justify-center text-sm">
                {t('orgOnboarding.saveExit')}
              </ArrowLink>
            ) : null}
            <Button onClick={handleContinue}>
              {step === 'review' ? t('orgOnboarding.finish') : t('orgOnboarding.continue')}
              {step === 'review' ? (
                <Check size={18} aria-hidden="true" />
              ) : (
                <ArrowRight size={18} aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function ReviewRow({
  icon,
  title,
  children,
  onEdit,
  editLabel,
  missing = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onEdit: () => void;
  editLabel: string;
  missing?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <li className="onb-review-row">
      <div className="flex min-w-0 items-start gap-3">
        <span className="onb-callout-icon h-9 w-9 shrink-0" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="onb-review-title">{title}</h3>
          <p className="onb-review-value" data-missing={missing ? 'true' : undefined}>
            {children}
          </p>
        </div>
      </div>
      <button type="button" className="link-arrow text-sm" onClick={onEdit} aria-label={editLabel}>
        {t('orgOnboarding.review.editShort')}
      </button>
    </li>
  );
}
