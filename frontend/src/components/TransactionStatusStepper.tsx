import React from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type TransactionLifecycleStatus = 'pending' | 'processing' | 'confirmed' | 'failed';

/** The stage a failed transaction died in. */
export type TransactionFailureStage = 'pending' | 'processing';

type StageId = 'pending' | 'processing' | 'confirmed';
type StepState = 'complete' | 'current' | 'upcoming' | 'error';

const STAGES: readonly StageId[] = ['pending', 'processing', 'confirmed'];

export interface TransactionStatusStepperProps {
  status: TransactionLifecycleStatus;
  /**
   * Where a failure happened. Defaults to `processing` — the network rejected
   * a submitted transaction — which is by far the common case.
   */
  failedAt?: TransactionFailureStage;
  orientation?: 'horizontal' | 'vertical';
  /** `sm` drops the step descriptions; use it in toasts and table rows. */
  size?: 'sm' | 'md';
  /**
   * Announce transitions through a polite live region. Turn off when the
   * stepper already sits inside another live region (e.g. the toast stack).
   */
  announce?: boolean;
  className?: string;
}

function getStepStates(
  status: TransactionLifecycleStatus,
  failedAt: TransactionFailureStage
): StepState[] {
  if (status === 'confirmed') return ['complete', 'complete', 'complete'];
  if (status === 'failed') {
    return failedAt === 'pending'
      ? ['error', 'upcoming', 'upcoming']
      : ['complete', 'error', 'upcoming'];
  }
  const activeIndex = STAGES.indexOf(status);
  return STAGES.map((_, i) =>
    i < activeIndex ? 'complete' : i === activeIndex ? 'current' : 'upcoming'
  );
}

/**
 * Animated stepper for an on-chain transaction: pending (signing and
 * submission) → processing (awaiting ledger close) → confirmed.
 *
 * Accessibility: an ordered list with `aria-current="step"` on the live stage,
 * a hidden per-step state suffix, and a polite live region that announces each
 * transition once. Motion is decorative and is dropped under
 * `prefers-reduced-motion`.
 */
export const TransactionStatusStepper: React.FC<TransactionStatusStepperProps> = ({
  status,
  failedAt = 'processing',
  orientation = 'horizontal',
  size = 'md',
  announce = true,
  className,
}) => {
  const { t } = useTranslation();
  const states = getStepStates(status, failedAt);

  const stateLabel: Record<StepState, string> = {
    complete: t('txStepper.stateComplete'),
    current: t('txStepper.stateCurrent'),
    upcoming: t('txStepper.stateUpcoming'),
    error: t('txStepper.stateError'),
  };

  const announcement = !announce
    ? null
    : status === 'failed'
      ? t('txStepper.announceFailed', { stage: t(`txStepper.${failedAt}Title`) })
      : t(`txStepper.announce_${status}`);

  return (
    <div
      className={['tx-stepper', className ?? ''].filter(Boolean).join(' ')}
      data-orientation={orientation}
      data-size={size}
      data-status={status}
    >
      <ol className="tx-stepper-list" aria-label={t('txStepper.ariaLabel')}>
        {STAGES.map((stage, i) => {
          const state = states[i];
          const isLast = i === STAGES.length - 1;
          return (
            <li
              key={stage}
              className="tx-step"
              data-state={state}
              data-final={isLast ? 'true' : undefined}
              aria-current={state === 'current' || state === 'error' ? 'step' : undefined}
            >
              <span className="tx-step-marker" aria-hidden="true">
                {state === 'complete' ? <Check strokeWidth={3} /> : null}
                {state === 'error' ? <X strokeWidth={3} /> : null}
                {state === 'current' ? (
                  <Loader2 className="tx-step-spinner" strokeWidth={2.5} />
                ) : null}
                {state === 'upcoming' ? i + 1 : null}
              </span>
              {!isLast ? (
                <span className="tx-step-connector" aria-hidden="true">
                  <span className="tx-step-connector-fill" />
                </span>
              ) : null}
              <span className="tx-step-text">
                <span className="tx-step-title">{t(`txStepper.${stage}Title`)}</span>
                <span className="tx-step-desc">
                  {state === 'error'
                    ? t('txStepper.errorDescription')
                    : t(`txStepper.${stage}Description`)}
                </span>
                <span className="sr-only"> ({stateLabel[state]})</span>
              </span>
            </li>
          );
        })}
      </ol>
      {announce ? (
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      ) : null}
    </div>
  );
};

export default TransactionStatusStepper;
