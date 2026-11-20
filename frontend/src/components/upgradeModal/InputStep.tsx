/**
 * Step 1 — INPUT: current contract state + new WASM hash entry.
 * Pure step component: all state/actions arrive as props.
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import type { ContractRecord } from '../../services/contractUpgrade';
import type { ModalState } from '../../utils/upgradeModalMachine';
import { INPUT_CLASS, LABEL_CLASS } from '../../utils/upgradeModalShared';

interface InputStepProps {
  contract: ContractRecord;
  state: Extract<ModalState, { step: 'input' }>;
  language: string;
  onWasmHashChange: (value: string) => void;
  onValidateAndSimulate: () => void;
}

export default function InputStep({
  contract,
  state,
  language,
  onWasmHashChange,
  onValidateAndSimulate,
}: InputStepProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-5">
      {/* Current contract state */}
      <div className="p-4 bg-black/20 border border-hi rounded-xl">
        <p className={LABEL_CLASS}>{t('upgradeModal.currentDeployedWasmHash')}</p>
        <p className="font-mono text-xs text-muted break-all leading-relaxed">
          {contract.current_wasm_hash}
        </p>
        <div className="flex items-center gap-3 mt-3 text-xs text-muted">
          <span>
            {t('upgradeModal.version')}{' '}
            <span className="text-text font-bold">{contract.version}</span>
          </span>
          <span>·</span>
          <span>
            {t('upgradeModal.network')}{' '}
            <span className="text-text font-bold">{contract.network}</span>
          </span>
          {contract.last_upgraded_at && (
            <>
              <span>·</span>
              <span>
                {t('contractUpgrade.lastUpgraded')}{' '}
                <span className="text-text">
                  {new Date(contract.last_upgraded_at).toLocaleDateString(language)}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* New WASM hash input */}
      <div>
        <label className={LABEL_CLASS}>{t('upgradeModal.newWasmHash')}</label>
        <input
          type="text"
          value={state.wasmHash}
          onChange={(e) => onWasmHashChange(e.target.value)}
          className={`${INPUT_CLASS} ${state.validationError ? 'border-red-500/60' : ''}`}
          placeholder={t('upgradeModal.wasmHashPlaceholder')}
          spellCheck={false}
          maxLength={64}
          autoComplete="off"
        />
        {state.validationError && (
          <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {state.validationError}
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          {t('upgradeModal.uploadWasmBytecodeFirst')}{' '}
          <code className="font-mono bg-black/30 px-1 rounded">stellar contract upload</code>{' '}
          {t('upgradeModal.toObtainTheHash')}
        </p>
      </div>

      <button
        onClick={onValidateAndSimulate}
        disabled={state.validating || !state.wasmHash.trim()}
        className="flex items-center justify-center gap-2 py-3.5 bg-accent/20 text-accent border border-accent/40 font-black rounded-xl hover:bg-accent hover:text-black transition-all uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state.validating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> {t('upgradeModal.validating')}
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4" /> {t('upgradeModal.validateAndSimulate')}
          </>
        )}
      </button>
    </div>
  );
}
