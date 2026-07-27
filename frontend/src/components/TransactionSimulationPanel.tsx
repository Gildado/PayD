/**
 * TransactionSimulationPanel
 *
 * Displays the results of a transaction simulation. Surfaces clear success
 * states or detailed diagnostic errors when a transaction is predicted to fail.
 *
 * Issue: https://github.com/Gildado/PayD/issues/41
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SimulationResult } from '../services/transactionSimulation';
import styles from './TransactionSimulationPanel.module.css';

/** One side of a balance change (e.g. "You send -100 USDC"). */
export interface BalanceChangeItem {
  label: string;
  asset: string;
  amount: number;
  direction: 'debit' | 'credit';
}

/** A fee line item shown in the fee estimate breakdown. */
export interface FeeEstimateItem {
  label: string;
  value: string;
}

interface Props {
  /** The simulation result to display */
  result: SimulationResult | null;
  /** Whether simulation is currently in progress */
  isSimulating: boolean;
  /** Whether an error occurred during the simulation process itself */
  processError?: string | null;
  /** Optional callback to reset/clear simulation state */
  onReset?: () => void;
  /** Before/after balance changes for the accounts involved in the transaction */
  balanceChanges?: BalanceChangeItem[];
  /** Path payment route, as an ordered list of asset hops (e.g. ["USDC", "XLM", "NGN"]) */
  route?: string[];
  /** Fee estimate line items (e.g. base fee, protocol fee) */
  feeEstimate?: FeeEstimateItem[];
  /** Estimated slippage as a percentage (e.g. 1.5 for 1.5%) */
  slippagePercent?: number;
  /** Slippage above this percentage is flagged as high (default 1%) */
  slippageWarningThreshold?: number;
}

// ── Icons ──────────────────────────────────────────────────────────────────

const SuccessIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const WarningIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ErrorIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

// ── Main Component ──────────────────────────────────────────────────────────

export const TransactionSimulationPanel: React.FC<Props> = ({
  result,
  isSimulating,
  processError,
  onReset,
  balanceChanges,
  route,
  feeEstimate,
  slippagePercent,
  slippageWarningThreshold = 1,
}) => {
  const { t, i18n } = useTranslation();
  const hasSlippageWarning =
    slippagePercent !== undefined && slippagePercent > slippageWarningThreshold;

  const renderBalanceAndRoute = () => (
    <>
      {balanceChanges && balanceChanges.length > 0 && (
        <div className={styles.balanceSection}>
          <p className={styles.sectionTitle}>{t('txSimulation.balanceChanges')}</p>
          {balanceChanges.map((change, index) => (
            <div key={`${change.label}-${index}`} className={styles.balanceRow}>
              <span className={styles.balanceLabel}>{change.label}</span>
              <span
                className={
                  change.direction === 'debit' ? styles.balanceNegative : styles.balancePositive
                }
              >
                {change.direction === 'debit' ? '−' : '+'}
                {Math.abs(change.amount).toLocaleString(i18n.language, {
                  maximumFractionDigits: 7,
                })}{' '}
                {change.asset}
              </span>
            </div>
          ))}
        </div>
      )}

      {route && route.length > 1 && (
        <div className={styles.routeSection}>
          <p className={styles.sectionTitle}>{t('txSimulation.paymentRoute')}</p>
          <div className={styles.routeHops}>
            {route.map((hop, index) => (
              <React.Fragment key={`${hop}-${index}`}>
                <span className={styles.routeChip}>{hop}</span>
                {index < route.length - 1 && <span className={styles.routeArrow}>→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {(feeEstimate?.length || slippagePercent !== undefined) && (
        <div className={styles.balanceSection}>
          <p className={styles.sectionTitle}>{t('txSimulation.feeAndSlippage')}</p>
          {feeEstimate?.map((fee, index) => (
            <div key={`${fee.label}-${index}`} className={styles.balanceRow}>
              <span className={styles.balanceLabel}>{fee.label}</span>
              <span className={styles.balanceLabel}>{fee.value}</span>
            </div>
          ))}
          {slippagePercent !== undefined && (
            <div className={styles.balanceRow}>
              <span className={styles.balanceLabel}>{t('txSimulation.estimatedSlippage')}</span>
              <span className={hasSlippageWarning ? styles.balanceNegative : styles.balanceLabel}>
                {slippagePercent.toFixed(2)}%{hasSlippageWarning ? ` — ${t('txSimulation.high')}` : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );

  // ---- Loading State ----
  if (isSimulating) {
    return (
      <div className={`${styles.container} ${styles.shimmer}`}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>{t('txSimulation.simulatingTransaction')}</span>
        </div>
      </div>
    );
  }

  // ---- Process/Network Error ----
  if (processError) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>{t('txSimulation.preSubmissionSimulation')}</span>
        </div>
        <div className={`${styles.statusBox} ${styles.statusError}`}>
          <div className={styles.statusIcon}>
            <WarningIcon />
          </div>
          <div className={styles.statusContent}>
            <h4 className={styles.statusTitle}>{t('txSimulation.simulationUnavailable')}</h4>
            <p className={styles.statusDesc}>{processError}</p>
          </div>
        </div>
        {renderBalanceAndRoute()}
        {onReset && (
          <button onClick={onReset} className={styles.resetBtn}>
            {t('txSimulation.clearResults')}
          </button>
        )}
      </div>
    );
  }

  // ---- No Result State ----
  if (!result) return null;

  // ---- Format result severity class ----
  const getStatusClass = () => {
    switch (result.severity) {
      case 'success':
        return styles.statusSuccess;
      case 'warning':
        return styles.statusWarning;
      case 'error':
        return styles.statusError;
      default:
        return '';
    }
  };

  const getIcon = () => {
    switch (result.severity) {
      case 'success':
        return <SuccessIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'error':
        return <ErrorIcon />;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>{t('txSimulation.preSubmissionSimulation')}</span>
        <span className={styles.timestamp}>
          {result.simulatedAt.toLocaleTimeString(i18n.language, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      </div>

      <div className={`${styles.statusBox} ${getStatusClass()}`}>
        <div className={styles.statusIcon}>{getIcon()}</div>
        <div className={styles.statusContent}>
          <h4 className={styles.statusTitle}>{result.title}</h4>
          <p className={styles.statusDesc}>{result.description}</p>
        </div>
      </div>

      {renderBalanceAndRoute()}

      {/* Error Diagnostics List */}
      {result.errors.length > 0 && (
        <div className={styles.errorList}>
          {result.errors.map((err) => (
            <div
              key={`${err.code}-${err.message}-${err.operationIndex}`}
              className={styles.errorItem}
            >
              <span className={styles.errorCode}>{err.code}</span>
              <span className={styles.errorLabel}>{err.message}</span>
              {err.operationIndex !== undefined && (
                <span className={styles.opIndex}>
                  {t('txSimulation.operationIndex', { index: err.operationIndex + 1 })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {onReset && (
        <button onClick={onReset} className={styles.resetBtn}>
          {result.success ? t('txSimulation.clearSimulation') : t('txSimulation.resetAndRetry')}
        </button>
      )}
    </div>
  );
};

export default TransactionSimulationPanel;