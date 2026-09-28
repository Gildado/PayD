import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ShieldAlert, ShieldCheck, Loader2, Users, Key } from 'lucide-react';
import { useMultisigDetection } from '../hooks/useMultisigDetection';
import { summarizeMultisig, type MultisigInfo } from '../services/multisigDetection';

// ---------------------------------------------------------------------------
// Style constants – matches AdminPanel patterns
// ---------------------------------------------------------------------------

const INPUT_CLASS =
  'w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none ' +
  'focus:border-accent/50 focus:bg-accent/5 transition-all font-mono text-sm';

const LABEL_CLASS = 'block text-xs font-bold uppercase tracking-widest text-muted mb-2 ml-1';

// ---------------------------------------------------------------------------
// Sub–components
// ---------------------------------------------------------------------------

function SignerRow({
  signer,
  isMaster,
}: {
  signer: MultisigInfo['signers'][number];
  isMaster: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hi bg-black/20 px-4 py-3">
      <Key className="h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <span className="block truncate font-mono text-xs">{signer.key}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted">
          {signer.type.replace(/_/g, ' ')}
          {isMaster && ` · ${t('common.masterKey')}`}
        </span>
      </div>
      <span className="shrink-0 rounded border border-hi bg-black/30 px-2 py-0.5 text-xs font-bold">
        w{signer.weight}
      </span>
    </div>
  );
}

function ThresholdBar({
  label,
  value,
  totalWeight,
}: {
  label: string;
  value: number;
  totalWeight: number;
}) {
  const { t } = useTranslation();
  const pct = totalWeight > 0 ? Math.min((value / totalWeight) * 100, 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-muted">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={totalWeight}
          aria-label={t('common.thresholdAriaLabel', { label })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * On-chain multisig support detection panel.
 *
 * Queries Horizon for signer & threshold data and surfaces the result with
 * intuitive visuals so operators can understand partial signing requirements.
 *
 * Issue: https://github.com/Gildado/PayD/issues/171
 */
export default function MultisigDetector() {
  const { t } = useTranslation();
  const [accountInput, setAccountInput] = useState('');
  const { detect, reset, loading, error, info } = useMultisigDetection();

  const handleDetect = () => {
    if (accountInput.trim()) {
      void detect(accountInput.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleDetect();
  };

  const handleClear = () => {
    setAccountInput('');
    reset();
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Shield className="h-5 w-5 text-accent" /> {t('multisig.title')}
      </h2>
      <p className="text-sm text-muted">{t('multisig.description')}</p>

      {/* Input */}
      <div>
        <label className={LABEL_CLASS} htmlFor="multisig-account-input">
          {t('multisig.accountLabel')}
        </label>
        <input
          id="multisig-account-input"
          type="text"
          value={accountInput}
          onChange={(e) => setAccountInput(e.target.value.trim())}
          onKeyDown={handleKeyDown}
          className={INPUT_CLASS}
          placeholder={t('multisig.accountPlaceholder')}
          spellCheck={false}
          autoComplete="off"
          aria-label={t('multisig.accountLabel')}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          disabled={loading || !accountInput.trim()}
          onClick={handleDetect}
          className="flex-1 py-4 bg-accent/20 text-accent border border-accent/50 font-black rounded-xl hover:bg-accent hover:text-white transition-all shadow-lg uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          aria-label={t('multisig.detectAriaLabel')}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {t('multisig.detecting')}
            </>
          ) : (
            t('multisig.detectButton')
          )}
        </button>
        {info && (
          <button
            onClick={handleClear}
            className="px-6 py-4 bg-black/20 border border-hi font-black rounded-xl hover:bg-black/40 transition-all uppercase tracking-widest text-sm"
          >
            {t('common.clear')}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
          role="alert"
        >
          <strong>{t('common.errorLabel')}</strong> {error}
        </div>
      )}

      {/* Results */}
      {info && (
        <div
          className="flex flex-col gap-5 rounded-2xl border border-hi bg-black/20 p-6"
          role="region"
          aria-label={t('multisig.resultsAriaLabel')}
        >
          {/* Status badge */}
          <div className="flex items-center gap-3">
            {info.isMultisig ? (
              <ShieldAlert className="h-6 w-6 text-amber-400" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            )}
            <div>
              <span
                className={`inline-block rounded px-3 py-1 text-xs font-black uppercase tracking-widest border ${
                  info.isMultisig
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {info.isMultisig ? t('multisig.multiSignature') : t('multisig.singleSignature')}
              </span>
              <p className="mt-1 text-xs text-muted">{summarizeMultisig(info)}</p>
            </div>
          </div>

          {/* Thresholds */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted">
              {t('multisig.thresholdConfiguration')}
            </h3>
            <div className="grid gap-3">
              <ThresholdBar
                label={t('multisig.thresholdLow')}
                value={info.thresholds.low}
                totalWeight={info.totalWeight}
              />
              <ThresholdBar
                label={t('multisig.thresholdMedium')}
                value={info.thresholds.med}
                totalWeight={info.totalWeight}
              />
              <ThresholdBar
                label={t('multisig.thresholdHigh')}
                value={info.thresholds.high}
                totalWeight={info.totalWeight}
              />
            </div>
          </div>

          {/* Signers */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted">
              <Users className="h-4 w-4" />{' '}
              {t('multisig.signersCount', { count: info.signers.length })}
            </h3>
            <div className="grid gap-2">
              {info.signers.map((signer) => (
                <SignerRow
                  key={signer.key}
                  signer={signer}
                  isMaster={signer.key === info.accountId}
                />
              ))}
            </div>
          </div>

          {/* Summary stats */}
          <dl className="grid grid-cols-3 gap-4 rounded-xl border border-hi bg-black/20 p-4 text-center">
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-muted">
                {t('multisig.totalWeight')}
              </dt>
              <dd className="mt-1 text-lg font-black">{info.totalWeight}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-muted">
                {t('multisig.medThreshold')}
              </dt>
              <dd className="mt-1 text-lg font-black">{info.thresholds.med}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-muted">
                {t('multisig.requiredSigs')}
              </dt>
              <dd className="mt-1 text-lg font-black">{info.requiredSignatureCount}</dd>
            </div>
          </dl>

          {/* Partial signing guidance for multisig accounts */}
          {info.isMultisig && (
            <div
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300"
              role="status"
            >
              <strong>{t('multisig.partialSigningRequired')}</strong>{' '}
              {t('multisig.partialSigningDescription', { count: info.requiredSignatureCount })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
