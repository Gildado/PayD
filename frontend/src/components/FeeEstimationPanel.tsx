/**
 * FeeEstimationPanel
 *
 * Displays real‑time Stellar network fee statistics, congestion indicators,
 * fee recommendations, and a batch payment budget estimator.
 *
 * Issue: https://github.com/Gildado/PayD/issues/42
 */

import React, { useState } from "react";
import { useFeeEstimation } from "../hooks/useFeeEstimation";
import type { BatchBudgetEstimate } from "../services/feeEstimation";
import styles from "./FeeEstimationPanel.module.css";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Sub‑components
// ---------------------------------------------------------------------------

/** Skeleton placeholder while data is loading */
const SkeletonCard: React.FC = () => (
  <div className={styles.card}>
    <div className={`${styles.skeleton} ${styles.skeletonLineShort}`} />
    <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
    <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
    <div className={`${styles.skeleton} ${styles.skeletonLineShort}`} />
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const FeeEstimationPanel: React.FC = () => {
  const {
    feeRecommendation,
    isLoading,
    isError,
    error,
    refetch,
    estimateBatch,
  } = useFeeEstimation();
  const { t } = useTranslation();

  // Batch estimator local state
  const [txCount, setTxCount] = useState<string>("");
  const [batchResult, setBatchResult] = useState<BatchBudgetEstimate | null>(
    null,
  );
  const [batchLoading, setBatchLoading] = useState(false);

  const handleEstimateBatch = async () => {
    const count = parseInt(txCount, 10);
    if (!count || count <= 0) return;
    setBatchLoading(true);
    try {
      const result = await estimateBatch(count);
      setBatchResult(result);
    } finally {
      setBatchLoading(false);
    }
  };

  // ---- Congestion helpers ----
  const congestionClassName = (level: string) => {
    switch (level) {
      case "low":
        return styles.congestionLow;
      case "moderate":
        return styles.congestionModerate;
      case "high":
        return styles.congestionHigh;
      default:
        return "";
    }
  };

  const congestionLabel = (level: string) => {
    switch (level) {
      case "low":
        return t("feeEstimation.low");
      case "moderate":
        return t("feeEstimation.moderate");
      case "high":
        return t("feeEstimation.high");
      default:
        return level;
    }
  };

  const capacityBarColor = (usage: number) => {
    if (usage < 0.25) return "#10b981";
    if (usage < 0.75) return "#f59e0b";
    return "#ef4444";
  };

  // ---- Render ----
  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>{t("feeEstimation.title")}</h1>
        {!isLoading && !isError && (
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} />
            {t("feeEstimation.live")}
          </span>
        )}
      </div>

      <div className={styles.grid}>
        {/* ---- Loading State ---- */}
        {isLoading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {/* ---- Error State ---- */}
        {isError && (
          <div className={`${styles.card} ${styles.errorCard}`}>
            <p>{error?.message || t("feeEstimation.error")}</p>
            <button
              className={styles.retryBtn}
              onClick={() => {
                void refetch();
              }}
            >
              {t("feeEstimation.retry")}
            </button>
          </div>
        )}

        {/* ---- Data ---- */}
        {feeRecommendation && (
          <>
            {/* Network Status */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                {t("feeEstimation.networkStatus")}
              </h2>

              <div className={styles.statRow}>
                <span className={styles.statLabel}>
                  {t("feeEstimation.congestion")}
                </span>
                <span
                  className={`${styles.congestionBadge} ${congestionClassName(feeRecommendation.congestionLevel)}`}
                >
                  {congestionLabel(feeRecommendation.congestionLevel)}
                </span>
              </div>

              <div className={styles.statRow}>
                <span className={styles.statLabel}>
                  {t("feeEstimation.lastLedger")}
                </span>
                <span className={styles.statValue}>
                  #{feeRecommendation.lastLedger.toLocaleString()}
                </span>
              </div>

              {/* Capacity bar */}
              <div style={{ marginTop: "0.5rem" }}>
                <span className={styles.statLabel}>
                  {t("feeEstimation.ledgerCapacityUsage")}
                </span>
                <div className={styles.capacityBarOuter}>
                  <div
                    className={styles.capacityBarInner}
                    style={{
                      width: `${Math.min(feeRecommendation.ledgerCapacityUsage * 100, 100)}%`,
                      background: capacityBarColor(
                        feeRecommendation.ledgerCapacityUsage,
                      ),
                    }}
                  />
                </div>
                <div className={styles.capacityLabel}>
                  <span>0%</span>
                  <span>
                    {(feeRecommendation.ledgerCapacityUsage * 100).toFixed(1)}%
                  </span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Fee Recommendations */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                {t("feeEstimation.recommendedFee")}
              </h2>

              <div className={styles.statRow}>
                <span className={styles.statLabel}>
                  {t("feeEstimation.baseFee")}
                </span>
                <span className={styles.statValue}>
                  {feeRecommendation.baseFee.toLocaleString()} stroops
                  <span className={styles.statSub}>
                    {t("feeEstimation.feeInXlm", {
                      amount: feeRecommendation.baseFeeXLM,
                    })}
                  </span>
                </span>
              </div>

              <div className={styles.statRow}>
                <span className={styles.statLabel}>
                  {t("feeEstimation.recommendedFee")}
                </span>
                <span className={styles.statValue}>
                  {feeRecommendation.recommendedFee.toLocaleString()} stroops
                  <span className={styles.statSub}>
                    {t("feeEstimation.feeInXlm", {
                      amount: feeRecommendation.recommendedFeeXLM,
                    })}
                  </span>
                </span>
              </div>

              <div className={styles.statRow}>
                <span className={styles.statLabel}>
                  {t("feeEstimation.maxFee")}
                </span>
                <span className={styles.statValue}>
                  {feeRecommendation.maxFee.toLocaleString()} stroops
                  <span className={styles.statSub}>
                    {t("feeEstimation.feeInXlm", {
                      amount: feeRecommendation.maxFeeXLM,
                    })}
                  </span>
                </span>
              </div>
            </div>

            {/* Fee Bump Alert */}
            {feeRecommendation.shouldBumpFee && (
              <div className={styles.alertBanner}>
                <span className={styles.alertIcon}>⚠️</span>
                <div className={styles.alertContent}>
                  <h4>{t("feeEstimation.alertTitle")}</h4>
                  <p>
                    {t("feeEstimation.alertBody", {
                      usage: (
                        feeRecommendation.ledgerCapacityUsage * 100
                      ).toFixed(1),
                      fee: feeRecommendation.recommendedFee.toLocaleString(),
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* Batch Budget Estimator */}
            <div className={`${styles.card} ${styles.batchCard}`}>
              <h2 className={styles.cardTitle}>
                {t("feeEstimation.batchTitle")}
              </h2>

              <div className={styles.batchInputRow}>
                <label className={styles.statLabel} htmlFor="txCount">
                  {t("feeEstimation.batchLabel")}
                </label>
                <input
                  id="txCount"
                  className={styles.batchInput}
                  type="number"
                  min="1"
                  placeholder={t("feeEstimation.batchPlaceholder")}
                  value={txCount}
                  onChange={(e) => {
                    setTxCount(e.target.value);
                    setBatchResult(null);
                  }}
                />
                <button
                  className={styles.batchBtn}
                  onClick={() => {
                    void handleEstimateBatch();
                  }}
                  disabled={batchLoading || !txCount || parseInt(txCount) <= 0}
                >
                  {batchLoading
                    ? t("feeEstimation.batchCalculating")
                    : t("feeEstimation.batchEstimate")}
                </button>
              </div>

              {batchResult && (
                <div className={styles.batchResults}>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>
                      {t("feeEstimation.batchTransactions")}
                    </span>
                    <span className={styles.statValue}>
                      {batchResult.transactionCount}
                    </span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>
                      {t("feeEstimation.batchFeePerTransaction")}
                    </span>
                    <span className={styles.statValue}>
                      {batchResult.feePerTransaction.toLocaleString()} stroops
                      <span className={styles.statSub}>
                        ({batchResult.feePerTransactionXLM} XLM)
                      </span>
                    </span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>
                      {t("feeEstimation.batchTotalBudget")}
                    </span>
                    <span className={styles.statValue}>
                      {batchResult.totalBudget.toLocaleString()} stroops
                      <span className={styles.statSub}>
                        ({batchResult.totalBudgetXLM} XLM)
                      </span>
                    </span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>
                      {t("feeEstimation.batchSafetyMargin")}
                    </span>
                    <span className={styles.statValue}>
                      {batchResult.safetyMargin}×
                      <span className={styles.statSub}>
                        ({congestionLabel(batchResult.congestionLevel)}{" "}
                        congestion)
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FeeEstimationPanel;
