/**
 * Step 4 — AUTHORIZE: irreversibility warning + admin secret entry.
 * Pure step component: all state/actions arrive as props.
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import type { ContractRecord } from '../../services/contractUpgrade';
import type { ModalState } from '../../utils/upgradeModalMachine';
import { INPUT_CLASS, LABEL_CLASS } from '../../utils/upgradeModalShared';

interface AuthorizeStepProps {
  contract: ContractRecord;
  state: Extract<ModalState, { step: 'authorize' }>;
  onSecretChange: (value: string) => void;
  onCancel: () => void;
  onExecute: () => void;
}

export default function AuthorizeStep({
  contract,
  state,
  onSecretChange,
  onCancel,
  onExecute,
}: AuthorizeStepProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-5">
      {/* Irreversibility warning */}
      <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold text-red-400">{t('upgradeModal.actionIrreversible')}</p>
          <p className="text-red-400/80 text-xs mt-1">
            {t('upgradeModal.actionIrreversibleDescription')}
          </p>
        </div>
      </div>

      {/* Compact diff reminder */}
      <div className="p-4 bg-black/20 border border-hi rounded-xl">
        <p className={LABEL_CLASS}>{t('upgradeModal.upgradeSummary')}</p>
        <div className="flex flex-col gap-2 mt-2 text-xs font-mono">
          <div className="flex gap-2">
            <span className="text-muted w-12 shrink-0">{t('upgradeModal.from')}</span>
            <span className="text-red-400 break-all">
              {contract.current_wasm_hash.slice(0, 24)}…
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted w-12 shrink-0">{t('upgradeModal.to')}</span>
            <span className="text-emerald-400 break-all">{state.wasmHash.slice(0, 24)}…</span>
          </div>
        </div>
      </div>

      {/* Admin secret key */}
      <div>
        <label className={LABEL_CLASS}>{t('upgradeModal.adminSecretKeyLabel')}</label>
        <input
          type="password"
          value={state.adminSecret}
          onChange={(e) => onSecretChange(e.target.value)}
          className={INPUT_CLASS}
          placeholder={t('upgradeModal.adminSecretPlaceholder')}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="mt-1.5 text-xs text-muted">{t('upgradeModal.secretKeyNeverStored')}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-2">
        <button
          onClick={onCancel}
          className="flex-1 py-3 border border-hi rounded-xl text-sm font-bold text-muted hover:text-text hover:bg-white/5 transition-all uppercase tracking-widest"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={onExecute}
          disabled={!state.adminSecret.trim()}
          className="flex-1 py-3 bg-red-500/20 text-red-400 border border-red-500/40 rounded-xl text-sm font-black hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('upgradeModal.executeUpgrade')}
        </button>
      </div>
    </div>
  );
}
