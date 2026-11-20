import React from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface OnboardingProgressStep {
  id: string;
  label: string;
}

export interface OnboardingProgressProps {
  steps: OnboardingProgressStep[];
  currentIndex: number;
  /** Furthest step reached; steps up to here can be revisited. */
  maxReachedIndex: number;
  onStepSelect?: (index: number) => void;
}

/**
 * Progress indicator for the onboarding wizard. ≥ 640px: a clickable
 * numbered stepper (visited steps are buttons, future ones are disabled).
 * < 640px: "Step 2 of 5" plus a progress bar, so it never squeezes.
 */
export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  steps,
  currentIndex,
  maxReachedIndex,
  onStepSelect,
}) => {
  const { t } = useTranslation();
  const current = steps[currentIndex];
  const percent = Math.round(((currentIndex + 1) / steps.length) * 100);

  return (
    <nav className="onb-progress" aria-label={t('orgOnboarding.progressLabel')}>
      <ol className="onb-progress-list">
        {steps.map((step, index) => {
          // Steps before the furthest one reached were passed with valid input;
          // the furthest step itself is visited but not yet finished.
          const state =
            index === currentIndex
              ? 'current'
              : index < currentIndex || index < maxReachedIndex
                ? 'complete'
                : 'upcoming';
          const reachable = index <= maxReachedIndex && index !== currentIndex;
          return (
            <li key={step.id} className="onb-progress-item" data-state={state}>
              <button
                type="button"
                className="onb-progress-btn"
                disabled={!reachable}
                aria-current={index === currentIndex ? 'step' : undefined}
                onClick={() => onStepSelect?.(index)}
              >
                <span className="onb-progress-marker" aria-hidden="true">
                  {state === 'complete' ? <Check size={16} strokeWidth={3} /> : index + 1}
                </span>
                <span className="onb-progress-label">
                  {step.label}
                  <span className="sr-only">
                    {' '}
                    (
                    {state === 'complete'
                      ? t('orgOnboarding.stepComplete')
                      : state === 'current'
                        ? t('orgOnboarding.stepCurrent')
                        : t('orgOnboarding.stepUpcoming')}
                    )
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="onb-progress-compact">
        <p className="onb-progress-compact-text m-0">
          <span className="onb-progress-compact-step">
            {t('orgOnboarding.stepOf', { current: currentIndex + 1, total: steps.length })}
          </span>
          <span className="onb-progress-compact-name">{current?.label}</span>
        </p>
        <div
          className="onb-progress-track"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={currentIndex + 1}
          aria-valuetext={t('orgOnboarding.stepOfNamed', {
            current: currentIndex + 1,
            total: steps.length,
            name: current?.label,
          })}
          aria-label={t('orgOnboarding.progressLabel')}
        >
          <div className="onb-progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </nav>
  );
};

export default OnboardingProgress;
