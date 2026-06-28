import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Coins,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { useEffect, useId, useState, type ChangeEvent } from 'react';
import {
  generatePreviewDates,
  getLocalTimezoneLabel,
  validateSchedulingConfig,
  type SchedulingConfig,
  type SchedulingFrequency,
  type SchedulingValidationErrors,
} from '../utils/scheduling';

const DEFAULT_EMPLOYEE_PREFERENCES: SchedulingConfig['preferences'] = [
  { id: '1', name: 'Alice', amount: '1000', currency: 'USDC' },
  { id: '2', name: 'Bob', amount: '1500', currency: 'XLM' },
];

const WIZARD_STEPS = [
  { id: 1, title: 'Set schedule', icon: CalendarDays },
  { id: 2, title: 'Choose payouts', icon: WalletCards },
  { id: 3, title: 'Review run plan', icon: Sparkles },
] as const;

interface SchedulingWizardProps {
  initialConfig?: SchedulingConfig | null;
  timezoneLabel?: string;
  onComplete: (config: SchedulingConfig) => void;
  onCancel: () => void;
}

function getDefaultConfig(): SchedulingConfig {
  return {
    frequency: 'monthly',
    dayOfMonth: 1,
    timeOfDay: '09:00',
    preferences: DEFAULT_EMPLOYEE_PREFERENCES.map((preference) => ({ ...preference })),
  };
}

function cloneConfig(config?: SchedulingConfig | null): SchedulingConfig {
  if (!config) {
    return getDefaultConfig();
  }

  return {
    ...config,
    preferences:
      config.preferences.length > 0
        ? config.preferences.map((preference) => ({ ...preference }))
        : DEFAULT_EMPLOYEE_PREFERENCES.map((preference) => ({ ...preference })),
  };
}

function getStepTitle(step: number) {
  return WIZARD_STEPS.find((entry) => entry.id === step)?.title ?? WIZARD_STEPS[0].title;
}

export const SchedulingWizard = ({
  initialConfig,
  timezoneLabel = getLocalTimezoneLabel(),
  onComplete,
  onCancel,
}: SchedulingWizardProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [config, setConfig] = useState<SchedulingConfig>(() => cloneConfig(initialConfig));
  const [errors, setErrors] = useState<SchedulingValidationErrors>({});

  const headingId = useId();
  const descriptionId = useId();
  const validationId = useId();

  useEffect(() => {
    setStep(1);
    setConfig(cloneConfig(initialConfig));
    setErrors({});
  }, [initialConfig]);

  const previewDates = generatePreviewDates(config);
  const hasValidationErrors = Object.keys(errors).length > 0;

  const handleFrequencyChange = (frequency: SchedulingFrequency) => {
    setConfig((current) => ({
      ...current,
      frequency,
      dayOfWeek: frequency === 'monthly' ? undefined : (current.dayOfWeek ?? 1),
      dayOfMonth: frequency === 'monthly' ? (current.dayOfMonth ?? 1) : undefined,
    }));
    setErrors({});
  };

  const handleTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setConfig((current) => ({ ...current, timeOfDay: event.target.value }));
    setErrors((current) => ({ ...current, timeOfDay: undefined }));
  };

  const handleDayOfWeekChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setConfig((current) => ({
      ...current,
      dayOfWeek: Number.parseInt(event.target.value, 10),
    }));
    setErrors((current) => ({ ...current, dayOfWeek: undefined }));
  };

  const handleDayOfMonthChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10);
    setConfig((current) => ({
      ...current,
      dayOfMonth: Number.isFinite(parsed) ? parsed : undefined,
    }));
    setErrors((current) => ({ ...current, dayOfMonth: undefined }));
  };

  const handleCurrencyChange = (employeeId: string, currency: string) => {
    setConfig((current) => ({
      ...current,
      preferences: current.preferences.map((preference) =>
        preference.id === employeeId ? { ...preference, currency } : preference
      ),
    }));
  };

  const handleNext = () => {
    if (step === 1) {
      const nextErrors = validateSchedulingConfig(config);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        return;
      }
    }

    setStep((current) => (current === 3 ? current : ((current + 1) as 2 | 3)));
  };

  const handleBack = () => {
    if (step === 1) {
      onCancel();
      return;
    }

    setStep((current) => (current === 1 ? current : ((current - 1) as 1 | 2)));
  };

  const handleConfirm = () => {
    const nextErrors = validateSchedulingConfig(config);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStep(1);
      return;
    }

    onComplete(config);
  };

  return (
    <section
      className="card glass noise w-full p-5 sm:p-8"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 border-b border-hi pb-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Scheduling wizard
              </div>
              <h2 id={headingId} className="text-2xl font-black tracking-tight">
                {getStepTitle(step)}
              </h2>
              <p id={descriptionId} className="max-w-2xl text-sm text-muted">
                Configure cadence, payout preferences, and the next three payroll runs in{' '}
                <span className="font-semibold text-text">{timezoneLabel}</span>.
              </p>
            </div>

            <div className="rounded-2xl border border-hi bg-black/20 px-4 py-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                Current step
              </div>
              <div className="mt-1 font-semibold text-text">
                {step} / {WIZARD_STEPS.length}
              </div>
            </div>
          </div>

          <ol className="grid gap-3 md:grid-cols-3" aria-label="Scheduling wizard steps">
            {WIZARD_STEPS.map(({ id, title, icon: Icon }) => {
              const isActive = step === id;
              const isComplete = step > id;

              return (
                <li
                  key={id}
                  className={`rounded-2xl border px-4 py-3 transition-colors ${
                    isActive
                      ? 'border-accent/40 bg-accent/10 text-text'
                      : isComplete
                        ? 'border-success/30 bg-success/10 text-text'
                        : 'border-hi bg-black/15 text-muted'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                        isActive
                          ? 'border-accent/40 bg-accent/15 text-accent'
                          : isComplete
                            ? 'border-success/30 bg-success/15 text-success'
                            : 'border-hi bg-black/20 text-muted'
                      }`}
                    >
                      {isComplete ? (
                        <Check className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                        Step {id}
                      </div>
                      <div className="font-semibold">{title}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {step === 1 ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-3 ml-1 block text-xs font-bold uppercase tracking-widest text-muted">
                Frequency
              </label>
              <div className="grid gap-3 md:grid-cols-3">
                {(['weekly', 'biweekly', 'monthly'] as const).map((frequency) => {
                  const isSelected = config.frequency === frequency;
                  return (
                    <button
                      key={frequency}
                      type="button"
                      onClick={() => handleFrequencyChange(frequency)}
                      className={`rounded-2xl border px-4 py-4 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                        isSelected
                          ? 'border-accent/45 bg-accent/10 shadow-lg shadow-accent/10'
                          : 'border-hi bg-black/15 hover:border-accent/25 hover:bg-accent/5'
                      }`}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold capitalize text-text">
                            {frequency}
                          </div>
                          <div className="mt-1 text-xs text-muted">
                            {frequency === 'weekly'
                              ? 'Run every week on the same weekday.'
                              : frequency === 'biweekly'
                                ? 'Run every two weeks with the same weekday and time.'
                                : 'Run once per month with calendar-aware date clamping.'}
                          </div>
                        </div>
                        <Coins
                          className={`h-5 w-5 shrink-0 ${isSelected ? 'text-accent' : 'text-muted'}`}
                          aria-hidden="true"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {config.frequency === 'monthly' ? (
              <div>
                <label
                  htmlFor="schedule-day-of-month"
                  className="mb-3 ml-1 block text-xs font-bold uppercase tracking-widest text-muted"
                >
                  Day of month
                </label>
                <input
                  id="schedule-day-of-month"
                  type="number"
                  min="1"
                  max="31"
                  value={config.dayOfMonth ?? ''}
                  onChange={handleDayOfMonthChange}
                  aria-invalid={Boolean(errors.dayOfMonth)}
                  aria-describedby={errors.dayOfMonth ? validationId : undefined}
                  className={`w-full rounded-2xl border bg-black/20 p-4 font-mono text-text outline-none transition-all focus:border-accent/50 focus:bg-accent/5 ${
                    errors.dayOfMonth ? 'border-danger/50' : 'border-hi'
                  }`}
                />
              </div>
            ) : (
              <div>
                <label
                  htmlFor="schedule-day-of-week"
                  className="mb-3 ml-1 block text-xs font-bold uppercase tracking-widest text-muted"
                >
                  Day of week
                </label>
                <select
                  id="schedule-day-of-week"
                  value={config.dayOfWeek ?? 1}
                  onChange={handleDayOfWeekChange}
                  aria-invalid={Boolean(errors.dayOfWeek)}
                  aria-describedby={errors.dayOfWeek ? validationId : undefined}
                  className={`w-full cursor-pointer rounded-2xl border bg-black/20 p-4 text-text outline-none transition-all focus:border-accent/50 focus:bg-accent/5 ${
                    errors.dayOfWeek ? 'border-danger/50' : 'border-hi'
                  }`}
                >
                  {[
                    'Sunday',
                    'Monday',
                    'Tuesday',
                    'Wednesday',
                    'Thursday',
                    'Friday',
                    'Saturday',
                  ].map((day, index) => (
                    <option key={day} value={index} className="bg-surface">
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="schedule-time-of-day"
                className="mb-3 ml-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted"
              >
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                Run time
              </label>
              <input
                id="schedule-time-of-day"
                type="time"
                value={config.timeOfDay}
                onChange={handleTimeChange}
                aria-invalid={Boolean(errors.timeOfDay)}
                aria-describedby={errors.timeOfDay ? validationId : undefined}
                className={`w-full rounded-2xl border bg-black/20 p-4 font-mono text-text outline-none transition-all focus:border-accent/50 focus:bg-accent/5 ${
                  errors.timeOfDay ? 'border-danger/50' : 'border-hi'
                }`}
              />
            </div>

            <div className="md:col-span-2 rounded-2xl border border-hi bg-black/15 p-4 text-sm text-muted">
              Previewed dates are rendered in{' '}
              <span className="font-semibold text-text">{timezoneLabel}</span>.
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-hi bg-black/15 p-4 text-sm text-muted">
              Choose the preferred payout asset per employee. These preferences are saved with the
              schedule and shown in the run summary before confirmation.
            </div>

            <div className="grid gap-3 md:hidden">
              {config.preferences.map((employee) => (
                <article key={employee.id} className="rounded-2xl border border-hi bg-black/15 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-text">{employee.name}</div>
                      <div className="mt-1 text-xs text-muted">${employee.amount} scheduled</div>
                    </div>
                    <select
                      value={employee.currency}
                      onChange={(event) => handleCurrencyChange(employee.id, event.target.value)}
                      aria-label={`Select payout currency for ${employee.name}`}
                      className="rounded-xl border border-hi bg-transparent px-3 py-2 text-sm text-text outline-none focus:border-accent"
                    >
                      <option value="USDC">USDC</option>
                      <option value="XLM">XLM</option>
                      <option value="EURC">EURC</option>
                    </select>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-hi md:block">
              <table className="w-full text-left text-sm" aria-label="Employee payout preferences">
                <thead className="border-b border-hi bg-surface/50 text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Scheduled amount</th>
                    <th className="px-4 py-3">Receive in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hi">
                  {config.preferences.map((employee) => (
                    <tr key={employee.id} className="bg-black/10 hover:bg-black/20">
                      <td className="px-4 py-3 font-medium">{employee.name}</td>
                      <td className="px-4 py-3 font-mono text-muted">${employee.amount}</td>
                      <td className="px-4 py-3">
                        <select
                          value={employee.currency}
                          onChange={(event) =>
                            handleCurrencyChange(employee.id, event.target.value)
                          }
                          aria-label={`Select payout currency for ${employee.name}`}
                          className="rounded-xl border border-hi bg-transparent px-3 py-2 text-text outline-none focus:border-accent"
                        >
                          <option value="USDC">USDC (Stellar)</option>
                          <option value="XLM">XLM</option>
                          <option value="EURC">EURC</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-2xl border border-accent/20 bg-accent/10 p-6">
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-accent">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                  Schedule overview
                </h3>
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <span className="block text-xs uppercase tracking-wider text-muted">
                      Frequency
                    </span>
                    <span className="font-bold capitalize text-text">{config.frequency}</span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase tracking-wider text-muted">Time</span>
                    <span className="font-mono text-text">{config.timeOfDay}</span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase tracking-wider text-muted">
                      Timezone
                    </span>
                    <span className="font-semibold text-text">{timezoneLabel}</span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase tracking-wider text-muted">
                      Preference count
                    </span>
                    <span className="font-semibold text-text">{config.preferences.length}</span>
                  </div>
                </div>
              </div>

              <aside className="rounded-2xl border border-hi bg-black/15 p-6">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-muted">
                  <WalletCards className="h-4 w-4" aria-hidden="true" />
                  Payout mix
                </h4>
                <ul className="space-y-3 text-sm">
                  {config.preferences.map((employee) => (
                    <li
                      key={employee.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-hi bg-black/15 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-text">{employee.name}</div>
                        <div className="text-xs text-muted">${employee.amount}</div>
                      </div>
                      <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                        {employee.currency}
                      </span>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted">
                Upcoming runs
              </h4>
              <ul className="flex flex-col gap-3">
                {previewDates.map((date, index) => (
                  <li
                    key={date.toISOString()}
                    className="flex flex-col gap-3 rounded-2xl border border-hi bg-black/20 p-4 sm:flex-row sm:items-center"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-xs font-bold text-muted">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-text">
                        {date.toLocaleString(undefined, {
                          dateStyle: 'full',
                          timeStyle: 'short',
                        })}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        Triggered in {timezoneLabel} using the saved payout mix for this run.
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {hasValidationErrors ? (
          <div
            id={validationId}
            className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>{errors.dayOfMonth ?? errors.dayOfWeek ?? errors.timeOfDay}</div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-hi pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleBack}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
              step === 1
                ? 'text-muted hover:text-text'
                : 'border border-hi bg-surface text-text hover:bg-hi/50'
            }`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-bg shadow-lg shadow-accent/20 transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-success px-5 py-3 text-sm font-semibold text-bg shadow-lg shadow-success/20 transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Confirm schedule
              <Check className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
