/**
 * Step 6 — terminal states: DONE (tx hash + explorer link) and FAILED
 * (parsed contract error + close / retry actions).
 * Pure step components: all state/actions arrive as props.
 */

import { useTranslation } from 'react-i18next';
import { CheckCircle2, Copy, ExternalLink, RefreshCw, XCircle } from 'lucide-react';
import type { ContractRecord } from '../../services/contractUpgrade';
import type { ModalState } from '../../utils/upgradeModalMachine';
import { LABEL_CLASS } from '../../utils/upgradeModalShared';
import { getTxExplorerUrl } from '../../utils/stellarExpert';
import { parseContractError } from '../../utils/contractErrorParser';
import { ContractErrorPanel } from '../ContractErrorPanel';

interface DoneStepProps {
  contract: ContractRecord;
  state: Extract<ModalState, { step: 'done' }>;
  onClose: () => void;
  onCopyTxHash: (hash: string) => void;
}

export function DoneStep({ contract, state, onClose, onCopyTxHash }: DoneStepProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div className="motion-success-ring absolute inset-0 rounded-full border-2 border-emerald-500/50" />
        <div className="motion-success-badge relative w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="motion-success-icon w-8 h-8 text-emerald-500" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-xl font-black">{t('upgradeModal.upgradeCompleteTitle')}</p>
        <p className="text-sm text-muted mt-1">
          {t('upgradeModal.contractAndMigrationFinished')}
        </p>
      </div>
      <div className="w-full p-4 bg-black/20 border border-hi rounded-xl">
        <p className={LABEL_CLASS}>{t('upgradeModal.transactionHash')}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-xs break-all">{state.txHash}</code>
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
            onClick={() => onCopyTxHash(state.txHash)}
            aria-label={t('upgradeModal.copyTransactionHash', 'Copy transaction hash')}
            title={t('upgradeModal.copyTransactionHash', 'Copy transaction hash')}
            className="p-1.5 hover:bg-white/5 rounded text-muted hover:text-text transition-colors shrink-0"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <button
        onClick={onClose}
        className="w-full py-3 bg-accent/20 text-accent border border-accent/40 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-accent hover:text-black transition-all"
      >
        {t('upgradeModal.done')}
      </button>
    </div>
  );
}

interface FailedStepProps {
  state: Extract<ModalState, { step: 'failed' }>;
  onClose: () => void;
  onTryAgain: () => void;
}

export function FailedStep({ state, onClose, onTryAgain }: FailedStepProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
        <XCircle className="w-8 h-8 text-red-500" />
      </div>
      <div className="text-center">
        <p className="text-xl font-black">{t('upgradeModal.upgradeFailedTitle')}</p>
        <p className="text-sm text-muted mt-1">{t('upgradeModal.upgradeDidNotComplete')}</p>
      </div>
      <div className="w-full">
        <ContractErrorPanel
          error={parseContractError(undefined, state.error)}
          title={t('upgradeModal.simulationExecutionErrorTitle')}
        />
      </div>

      <div className="flex gap-3 w-full">
        <button
          onClick={onClose}
          className="flex-1 py-3 border border-hi rounded-xl text-sm font-bold text-muted hover:text-text hover:bg-white/5 transition-all uppercase tracking-widest"
        >
          {t('common.close')}
        </button>
        <button
          onClick={onTryAgain}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-black/20 border border-hi rounded-xl text-sm font-bold hover:bg-white/5 transition-all uppercase tracking-widest"
        >
          <RefreshCw className="w-4 h-4" /> {t('common.tryAgain')}
        </button>
      </div>
    </div>
  );
}
