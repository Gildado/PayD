/**
 * FeeEstimationConfirmModal
 *
 * A responsive modal that displays fee estimation for bulk payroll transactions
 * before the user confirms submission. Provides transparency about network costs
 * and allows for fee-aware decision making.
 *
 * Features:
 * - Real-time fee updates based on current network congestion
 * - Transaction count estimation based on payment operations
 * - Cost breakdown and safety margins
 * - Responsive design (mobile-first)
 * - Full accessibility (ARIA labels, keyboard navigation, focus management)
 * - Internationalization support
 *
 * Issue: https://github.com/Gildado/PayD/issues/166
 */

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle, TrendingUp, Clock, DollarSign, Info } from 'lucide-react';
import { Button } from '@stellar/design-system';
import { useFeeEstimation } from '../hooks/useFeeEstimation';
import { stroopsToXLM } from '../services/feeEstimation';
import type { BatchBudgetEstimate } from '../services/feeEstimation';
import styles from './FeeEstimationConfirmModal.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FeeEstimationConfirmModalProps {
  /** Number of payment operations in the batch */
  paymentCount: number;
  /** Total amount being sent (in the payment's base unit) */
  totalAmount: string;
  /** Primary currency of the payments (e.g., 'XLM', 'USDC') */
  currency: string;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when user confirms the fee estimate and wants to proceed */
  onConfirm: () => void;
  /** Callback when user cancels/closes the modal */
  onCancel: () => void;
  /** Optional: Custom CSS class for styling */
  className?: string;
  /** Optional: Label for confirm button (default: "Confirm & Continue") */
  confirmLabel?: string;
  /** Optional: Label for cancel button (default: "Cancel") */
  cancelLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loading skeleton placeholder while fee data is being fetched
 */
const FeeLoadingSkeleton: React.FC = () => (
  <div className={styles.skeleton} aria-busy="true" aria-label="Loading fee information">
    <div className={styles.skeletonPulse} />
    <div className={`${styles.skeletonPulse} ${styles.skeletonLineShort}`} />
  </div>
);

/**
 * Error state when fee estimation fails
 */
interface FeeErrorStateProps {
  error: Error | null;
  onRetry: () => void;
}

const FeeErrorState: React.FC<FeeErrorStateProps> = ({ error, onRetry }) => {
  const { t } = useTranslation();
  return (
    <div className={styles.errorContainer} role="alert" aria-label="Fee estimation error">
      <div className={styles.errorIcon}>
        <AlertTriangle size={24} />
      </div>
      <div className={styles.errorContent}>
        <h3 className={styles.errorTitle}>
          {t('feeEstimation.error.title', 'Failed to estimate fees')}
        </h3>
        <p className={styles.errorMessage}>
          {error?.message ||
            t('feeEstimation.error.message', 'Unable to fetch current network fees')}
        </p>
        <Button variant="secondary" onClick={onRetry} size="sm" className={styles.retryButton}>
          {t('common.retry', 'Retry')}
        </Button>
      </div>
    </div>
  );
};

/**
 * Congestion badge showing current network status
 */
interface CongestionBadgeProps {
  level: 'low' | 'moderate' | 'high';
  usage: number;
}

const CongestionBadge: React.FC<CongestionBadgeProps> = ({ level, usage }) => {
  const { t } = useTranslation();

  const labelMap: Record<string, string> = {
    low: t('feeEstimation.congestion.low', 'Low'),
    moderate: t('feeEstimation.congestion.moderate', 'Moderate'),
    high: t('feeEstimation.congestion.high', 'High'),
  };

  const colorMap: Record<string, string> = {
    low: styles.congestionLow,
    moderate: styles.congestionModerate,
    high: styles.congestionHigh,
  };

  return (
    <div
      className={`${styles.congestionBadge} ${colorMap[level]}`}
      role="status"
      aria-label={`Network congestion: ${labelMap[level]}`}
    >
      <TrendingUp size={16} />
      <span>{labelMap[level]}</span>
      <span className={styles.usagePercent}>{(usage * 100).toFixed(1)}%</span>
    </div>
  );
};

/**
 * Fee breakdown row showing a single fee metric
 */
interface FeeRowProps {
  label: string;
  value: string;
  subtext?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}

const FeeRow: React.FC<FeeRowProps> = ({ label, value, subtext, icon, highlight }) => (
  <div className={`${styles.feeRow} ${highlight ? styles.feeRowHighlight : ''}`}>
    <div className={styles.feeRowLabel}>
      {icon && <span className={styles.feeRowIcon}>{icon}</span>}
      <div>
        <p className={styles.feeLabel}>{label}</p>
        {subtext && <p className={styles.feeSubtext}>{subtext}</p>}
      </div>
    </div>
    <p className={styles.feeValue}>{value}</p>
  </div>
);

/**
 * Info tooltip component for additional context
 */
interface InfoTooltipProps {
  children: React.ReactNode;
  tooltipText: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ children, tooltipText }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setShowTooltip(true), 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowTooltip(false);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className={styles.tooltipWrapper}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {showTooltip && (
        <div className={styles.tooltip} role="tooltip">
          {tooltipText}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const FeeEstimationConfirmModal: React.FC<FeeEstimationConfirmModalProps> = ({
  paymentCount,
  totalAmount,
  currency,
  isOpen,
  onConfirm,
  onCancel,
  className,
  confirmLabel,
  cancelLabel,
}) => {
  const { t } = useTranslation();
  const { feeRecommendation, isLoading, isError, error, refetch } = useFeeEstimation();
  const modalRef = useRef<HTMLDivElement>(null);

  // Estimate transaction count: 1 main transfer + N recipient transfers
  // We use a conservative estimate of N+1 transactions
  const estimatedTransactionCount = Math.ceil(paymentCount * 1.5);

  // Calculate batch budget estimate
  const batchEstimate = useMemo((): BatchBudgetEstimate | null => {
    if (!feeRecommendation) return null;

    const feePerTx = feeRecommendation.recommendedFee;
    const safetyMargin =
      feeRecommendation.congestionLevel === 'high'
        ? 1.5
        : feeRecommendation.congestionLevel === 'moderate'
          ? 1.2
          : 1.0;

    const totalBudget = estimatedTransactionCount * feePerTx * safetyMargin;

    return {
      transactionCount: estimatedTransactionCount,
      feePerTransaction: feePerTx,
      totalBudget: Math.ceil(totalBudget),
      totalBudgetXLM: stroopsToXLM(Math.ceil(totalBudget)),
      feePerTransactionXLM: stroopsToXLM(feePerTx),
      safetyMargin,
      congestionLevel: feeRecommendation.congestionLevel,
    };
  }, [feeRecommendation, estimatedTransactionCount]);

  // Keyboard event handler for Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={styles.backdrop}
        onClick={handleBackdropClick}
        role="presentation"
        aria-hidden="true"
      />

      {/* Modal dialog */}
      <div
        className={`${styles.modal} ${className || ''}`}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fee-estimation-title"
        aria-describedby="fee-estimation-description"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h2 id="fee-estimation-title" className={styles.title}>
              {t('feeEstimation.confirmModal.title', 'Network Fee Estimation')}
            </h2>
            <p id="fee-estimation-description" className={styles.subtitle}>
              {t(
                'feeEstimation.confirmModal.subtitle',
                'Review estimated fees before confirming your bulk payout'
              )}
            </p>
          </div>
          <button
            className={styles.closeButton}
            onClick={onCancel}
            aria-label={t('common.close', 'Close')}
            title={t('common.close', 'Close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Payment Summary Card */}
          <div className={styles.summaryCard}>
            <h3 className={styles.cardTitle}>
              {t('feeEstimation.confirmModal.paymentSummary', 'Payment Summary')}
            </h3>
            <div className={styles.summaryGrid}>
              <FeeRow
                label={t('feeEstimation.confirmModal.paymentCount', 'Total Payments')}
                value={`${paymentCount}`}
              />
              <FeeRow
                label={t('feeEstimation.confirmModal.totalAmount', 'Total Amount')}
                value={`${totalAmount} ${currency}`}
              />
              <FeeRow
                label={t('feeEstimation.confirmModal.estimatedTxCount', 'Est. Transactions')}
                value={`${estimatedTransactionCount}`}
                subtext={t(
                  'feeEstimation.confirmModal.estimatedTxCountHelp',
                  'Including on-chain processing'
                )}
              />
            </div>
          </div>

          {/* Network Status Card */}
          {isLoading ? (
            <FeeLoadingSkeleton />
          ) : isError || !feeRecommendation ? (
            <FeeErrorState
              error={error}
              onRetry={() => {
                void refetch();
              }}
            />
          ) : (
            <>
              <div className={styles.statusCard}>
                <div className={styles.statusHeader}>
                  <h3 className={styles.cardTitle}>
                    {t('feeEstimation.confirmModal.networkStatus', 'Network Status')}
                  </h3>
                  <CongestionBadge
                    level={feeRecommendation.congestionLevel}
                    usage={feeRecommendation.ledgerCapacityUsage}
                  />
                </div>

                <div className={styles.feeBreakdown}>
                  <FeeRow
                    icon={<DollarSign size={16} />}
                    label={t('feeEstimation.confirmModal.baseFee', 'Base Fee')}
                    value={`${stroopsToXLM(feeRecommendation.baseFee).value} XLM`}
                    subtext={`${feeRecommendation.baseFee} stroops`}
                  />

                  <FeeRow
                    icon={<TrendingUp size={16} />}
                    label={t('feeEstimation.confirmModal.recommendedFee', 'Recommended Fee')}
                    value={`${stroopsToXLM(feeRecommendation.recommendedFee).value} XLM`}
                    subtext={`${feeRecommendation.recommendedFee} stroops per transaction`}
                  />

                  {feeRecommendation.congestionLevel !== 'low' && (
                    <FeeRow
                      icon={<AlertTriangle size={16} />}
                      label={t('feeEstimation.confirmModal.safetyMargin', 'Safety Margin')}
                      value={`${(batchEstimate?.safetyMargin || 1.0).toFixed(1)}x`}
                      subtext={t(
                        'feeEstimation.confirmModal.safetyMarginHelp',
                        'Applied due to network congestion'
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Fee Estimate Card */}
              {batchEstimate && (
                <div className={styles.estimateCard}>
                  <div className={styles.estimateHeader}>
                    <h3 className={styles.cardTitle}>
                      {t('feeEstimation.confirmModal.estimatedCost', 'Estimated Cost')}
                    </h3>
                    <InfoTooltip
                      tooltipText={t(
                        'feeEstimation.confirmModal.estimateCostTooltip',
                        'This is an estimate based on current network conditions. Actual fees may vary slightly.'
                      )}
                    >
                      <Info size={16} className={styles.infoIcon} />
                    </InfoTooltip>
                  </div>

                  <div className={styles.estimateAmount}>
                    <p className={styles.estimateLabel}>
                      {t('feeEstimation.confirmModal.totalFee', 'Total Fee')}
                    </p>
                    <p className={styles.estimateValue}>{batchEstimate.totalBudgetXLM.value} XLM</p>
                    <p className={styles.estimateSubtext}>({batchEstimate.totalBudget} stroops)</p>
                  </div>

                  <div className={styles.estimateFine}>
                    <p className={styles.fineText}>
                      {t('feeEstimation.confirmModal.feePerTx', 'Fee per transaction')}:{' '}
                      <span className={styles.fineHighlight}>
                        {batchEstimate.feePerTransactionXLM.value} XLM
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Warning for high congestion */}
              {feeRecommendation.congestionLevel === 'high' && (
                <div className={styles.warningCard} role="alert">
                  <AlertTriangle size={20} />
                  <div className={styles.warningContent}>
                    <p className={styles.warningTitle}>
                      {t('feeEstimation.confirmModal.highCongestion', 'High Network Congestion')}
                    </p>
                    <p className={styles.warningMessage}>
                      {t(
                        'feeEstimation.confirmModal.highCongestionMessage',
                        'Network congestion is high. Fees may increase. Consider retrying in a few minutes.'
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Info section */}
              <div className={styles.infoSection}>
                <div className={styles.infoItem}>
                  <Clock size={16} />
                  <p className={styles.infoText}>
                    {t(
                      'feeEstimation.confirmModal.processingTime',
                      'Processing typically takes 5-30 seconds depending on network conditions.'
                    )}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer/Actions */}
        <div className={styles.footer}>
          <Button
            variant="secondary"
            onClick={onCancel}
            size="lg"
            className={styles.buttonSecondary}
            aria-label={cancelLabel || t('common.cancel', 'Cancel')}
          >
            {cancelLabel || t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            size="lg"
            disabled={isLoading || isError}
            className={styles.buttonPrimary}
            aria-label={
              confirmLabel || t('feeEstimation.confirmModal.confirm', 'Confirm & Continue')
            }
          >
            {confirmLabel || t('feeEstimation.confirmModal.confirm', 'Confirm & Continue')}
          </Button>
        </div>
      </div>
    </>
  );
};

export default FeeEstimationConfirmModal;
