/**
 * Step 3 — REVIEW: simulation diff, cost, warnings and actions.
 * Pure step component: all state/actions arrive as props.
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import type { ContractRecord } from '../../services/contractUpgrade';
import type { ModalState } from '../../utils/upgradeModalMachine';
import { LABEL_CLASS } from '../../utils/upgradeModalShared';
import { HashDiff } from './Shared';

interface ReviewStepProps {
  contract: ContractRecord;
  state: Extract<ModalState, { step: 'review' }>;
  language: string;
  onCancel: () => void;
  onAcceptReview: () => void;
}

export default function ReviewStep({
  contract,
  state,
  language,
  onCancel,
  onAcceptReview,
}: ReviewStepProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-5">
      {/* Simulation status */}
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border ${
          state.simulation.success
            ? 'bg-emerald-500/5 border-emerald-500/30'
            : 'bg-red-500/5 border-red-500/30'
        }`}
      >
        {state.simulation.success ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        )}
        <div>
          <p
            className={`font-bold text-sm ${state.simulation.success ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {state.simulation.success
              ? t('upgradeModal.simulationPassed')
              : t('upgradeModal.simulationFailedLabel')}
          </p>
          {state.simulation.error && (
            <p className="text-xs text-red-400 mt-0.5">{state.simulation.error}</p>
          )}
        </div>
      </div>

      {/* Warnings */}
      {state.simulation.warnings.length > 0 && (
        <div className="flex flex-col gap-2">
          {state.simulation.warnings.map((w) => (
            <div
              key={w}
              className="flex items-start gap-2 p-3 bg-yellow-500/5 border border-yellow-500/30 rounded-xl text-xs text-yellow-400"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Hash diff */}
      <HashDiff
        label={t('upgradeModal.wasmHashChange')}
        oldHash={contract.current_wasm_hash}
        newHash={state.wasmHash}
      />

      <div className="p-4 bg-black/20 border border-hi rounded-xl">
        <p className={LABEL_CLASS}>{t('upgradeModal.whatWillChange')}</p>
        <ul className="mt-2 grid gap-2 text-xs">
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            <span>
              {t('upgradeModal.changeBytecodeHash', { contractId: contract.contract_id })}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            <span>{t('upgradeModal.changeVersionMetadata')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            <span>{t('upgradeModal.changeMigrationScripts')}</span>
          </li>
        </ul>
      </div>

      {/* Cost breakdown */}
      {state.simulation.success && (
        <div className="p-4 bg-black/20 border border-hi rounded-xl">
          <p className={LABEL_CLASS}>{t('upgradeModal.estimatedCost')}</p>
          <dl className="grid grid-cols-2 gap-3 mt-3 text-sm">
            <div>
              <dt className="text-muted text-xs">{t('upgradeModal.networkFee')}</dt>
              <dd className="font-bold font-mono">{state.simulation.estimatedFeeXlm} XLM</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">{t('upgradeModal.cpuInstructions')}</dt>
              <dd className="font-bold font-mono">
                {state.simulation.cpuInstructions === 'N/A'
                  ? t('upgradeModal.notApplicable')
                  : Number(state.simulation.cpuInstructions).toLocaleString(language)}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs">{t('upgradeModal.memory')}</dt>
              <dd className="font-bold font-mono">
                {state.simulation.memoryBytes === 'N/A'
                  ? t('upgradeModal.notApplicable')
                  : `${(Number(state.simulation.memoryBytes) / 1024).toFixed(1)} KB`}
              </dd>
            </div>
            {state.simulation.latestLedger > 0 && (
              <div>
                <dt className="text-muted text-xs">{t('upgradeModal.ledger')}</dt>
                <dd className="font-bold font-mono">
                  #{state.simulation.latestLedger.toLocaleString(language)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-2">
        <button
          onClick={onCancel}
          className="flex-1 py-3 border border-hi rounded-xl text-sm font-bold text-muted hover:text-text hover:bg-white/5 transition-all uppercase tracking-widest"
        >
          {t('common.cancel')}
        </button>
        {state.simulation.success && (
          <button
            onClick={onAcceptReview}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-accent/20 text-accent border border-accent/40 rounded-xl text-sm font-black hover:bg-accent hover:text-black transition-all uppercase tracking-widest"
          >
            {t('upgradeModal.proceed')} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
