/**
 * Shared presentational components used by the upgrade modal steps.
 * Components only — no constants or helpers live in this file.
 */

import { useTranslation } from 'react-i18next';
import { ChevronRight, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { MigrationStep } from '../../services/contractUpgrade';

/** Step progress indicator */
export function StepBreadcrumb({ current }: { current: number }) {
  const { t } = useTranslation();
  const steps = [
    t('upgradeModal.stepInput'),
    t('upgradeModal.stepSimulate'),
    t('upgradeModal.stepReview'),
    t('upgradeModal.stepAuthorize'),
    t('upgradeModal.stepExecute'),
  ];
  return (
    <div className="flex items-center gap-1 text-xs text-muted mb-6">
      {steps.map((label, i) => (
        <span key={label} className="flex items-center gap-1">
          <span
            className={`px-2 py-0.5 rounded font-bold uppercase tracking-widest ${
              i + 1 === current
                ? 'text-accent bg-accent/10'
                : i + 1 < current
                  ? 'text-emerald-500'
                  : 'text-muted/50'
            }`}
          >
            {i + 1 < current ? '✓' : `${i + 1}.`} {label}
          </span>
          {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted/30" />}
        </span>
      ))}
    </div>
  );
}

/** Diff row showing old → new WASM hash */
export function HashDiff({
  label,
  oldHash,
  newHash,
}: {
  label: string;
  oldHash: string;
  newHash: string;
}) {
  return (
    <div className="grid gap-1 text-xs font-mono">
      <span className="text-muted text-[10px] uppercase tracking-widest">{label}</span>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-red-400/80 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
          <span className="text-red-500 font-bold">−</span>
          <span className="break-all">{oldHash}</span>
        </div>
        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
          <span className="text-emerald-500 font-bold">+</span>
          <span className="break-all">{newHash}</span>
        </div>
      </div>
    </div>
  );
}

/** Individual migration step row */
export function MigrationStepRow({ step }: { step: MigrationStep }) {
  const icon = {
    pending: <div className="w-4 h-4 rounded-full border border-muted/40 bg-transparent" />,
    running: <Loader2 className="w-4 h-4 text-accent animate-spin" />,
    completed: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
  }[step.status];

  const textColor = {
    pending: 'text-muted',
    running: 'text-text',
    completed: 'text-emerald-400',
    failed: 'text-red-400',
  }[step.status];

  return (
    <div className="flex items-start gap-3 py-3 border-b border-hi/50 last:border-0">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${textColor}`}>{step.name}</p>
        {step.message && <p className="text-xs text-muted mt-0.5">{step.message}</p>}
      </div>
    </div>
  );
}
