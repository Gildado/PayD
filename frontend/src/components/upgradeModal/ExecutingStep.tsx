/**
 * Step 5 — EXECUTING: progress bar, tx info and migration steps.
 * Pure step component: all state/actions arrive as props.
 */

import { useTranslation } from 'react-i18next';
import { Copy, ExternalLink, Loader2 } from 'lucide-react';
import type { ContractRecord } from '../../services/contractUpgrade';
import type { ModalState } from '../../utils/upgradeModalMachine';
import { LABEL_CLASS, migrationProgress } from '../../utils/upgradeModalShared';
import { getTxExplorerUrl } from '../../utils/stellarExpert';
import { MigrationStepRow } from './Shared';

interface ExecutingStepProps {
  contract: ContractRecord;
  state: Extract<ModalState, { step: 'executing' }>;
  onCopyTxHash: (hash: string) => void;
}

export default function ExecutingStep({ contract, state, onCopyTxHash }: ExecutingStepProps) {
  const { t } = useTranslation();
  const progress = migrationProgress(state.migrationSteps);

  return (
    <div className="flex flex-col gap-5">
      <div className="p-4 bg-black/20 border border-hi rounded-xl">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-bold uppercase tracking-widest text-muted">
            {t('upgradeModal.migrationProgress')}
          </span>
          <span className="font-mono text-text">
            {progress.total === 0
              ? t('upgradeModal.initializing')
              : `${progress.completed}/${progress.total} (${progress.percent}%)`}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {/* Transaction info */}
      {state.txHash && (
        <div className="p-4 bg-black/20 border border-hi rounded-xl">
          <p className={LABEL_CLASS}>{t('upgradeModal.transactionHash')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs text-text break-all leading-relaxed">
              {state.txHash}
            </code>
            <a
              href={getTxExplorerUrl(state.txHash, contract.network)}
              target="_blank"
              rel="noopener noreferrer"
              title={t('contractUpgrade.viewOnStellarExpert')}
              aria-label={t('contractUpgrade.viewOnStellarExpert')}
              className="p-1.5 hover:bg-white/5 rounded text-muted hover:text-text transition-colors shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
            <button
              onClick={() => onCopyTxHash(state.txHash!)}
              aria-label={t('upgradeModal.copyTransactionHash', 'Copy transaction hash')}
              title={t('upgradeModal.copyTransactionHash', 'Copy transaction hash')}
              className="p-1.5 hover:bg-white/5 rounded text-muted hover:text-text transition-colors shrink-0"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Overall status badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-muted">
          {t('bulkPaymentTracker.columnStatus')}:
        </span>
        <span
          className={`px-3 py-1 rounded text-xs font-black uppercase tracking-widest border ${
            state.overallStatus === 'completed'
              ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
              : state.overallStatus === 'failed'
                ? 'bg-red-500/20 text-red-500 border-red-500/30'
                : 'bg-accent/20 text-accent border-accent/30'
          }`}
        >
          {t(
            {
              pending: 'contractUpgrade.statusPending',
              simulated: 'contractUpgrade.statusSimulated',
              confirmed: 'contractUpgrade.statusConfirmed',
              executing: 'contractUpgrade.statusExecuting',
              completed: 'contractUpgrade.statusCompleted',
              failed: 'contractUpgrade.statusFailed',
              cancelled: 'contractUpgrade.statusCancelled',
            }[state.overallStatus]
          )}
        </span>
        {['executing', 'pending'].includes(state.overallStatus) && (
          <Loader2 className="w-4 h-4 text-accent animate-spin" />
        )}
      </div>

      {/* Migration steps */}
      <div className="border border-hi rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-hi bg-black/20">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            {t('upgradeModal.postUpgradeMigration')}
          </p>
        </div>
        <div className="px-4 divide-y divide-hi/30">
          {state.migrationSteps.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('upgradeModal.waitingForMigration')}
            </div>
          ) : (
            state.migrationSteps.map((s) => <MigrationStepRow key={s.id} step={s} />)
          )}
        </div>
      </div>
    </div>
  );
}
