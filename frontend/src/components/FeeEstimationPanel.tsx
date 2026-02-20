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
    const { feeRecommendation, isLoading, isError, error, refetch, estimateBatch } =
        useFeeEstimation();

    // Batch estimator local state
    const [txCount, setTxCount] = useState<string>("");
    const [batchResult, setBatchResult] = useState<BatchBudgetEstimate | null>(null);
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
                return "Low";
            case "moderate":
                return "Moderate";
            case "high":
                return "High";
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
                <h1 className={styles.title}>Fee Estimator</h1>
                {!isLoading && !isError && (
                    <span className={styles.liveBadge}>
                        <span className={styles.liveDot} />
                        LIVE
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
                        <p>
                            {error?.message || "Failed to fetch fee statistics from Horizon."}
                        </p>
                        <button
                            className={styles.retryBtn}
                            onClick={() => {
                                void refetch();
                            }}
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* ---- Data ---- */}
                {feeRecommendation && (
                    <>
                        {/* Network Status */}
                        <div className={styles.card}>
                            <h2 className={styles.cardTitle}>Network Status</h2>

                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Congestion</span>
                                <span
                                    className={`${styles.congestionBadge} ${congestionClassName(feeRecommendation.congestionLevel)}`}
                                >
                                    {congestionLabel(feeRecommendation.congestionLevel)}
                                </span>
                            </div>

                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Last Ledger</span>
                                <span className={styles.statValue}>
                                    #{feeRecommendation.lastLedger.toLocaleString()}
                                </span>
                            </div>

                            {/* Capacity bar */}
                            <div style={{ marginTop: "0.5rem" }}>
                                <span className={styles.statLabel}>Ledger Capacity Usage</span>
                                <div className={styles.capacityBarOuter}>
                                    <div
                                        className={styles.capacityBarInner}
                                        style={{
                                            width: `${Math.min(feeRecommendation.ledgerCapacityUsage * 100, 100)}%`,
                                            background: capacityBarColor(feeRecommendation.ledgerCapacityUsage),
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
                            <h2 className={styles.cardTitle}>Fee Recommendation</h2>

                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Base Fee</span>
                                <span className={styles.statValue}>
                                    {feeRecommendation.baseFee.toLocaleString()} stroops
                                    <span className={styles.statSub}>
                                        ({feeRecommendation.baseFeeXLM} XLM)
                                    </span>
                                </span>
                            </div>

                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Recommended Fee</span>
                                <span className={styles.statValue}>
                                    {feeRecommendation.recommendedFee.toLocaleString()} stroops
                                    <span className={styles.statSub}>
                                        ({feeRecommendation.recommendedFeeXLM} XLM)
                                    </span>
                                </span>
                            </div>

                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Max Fee (p99)</span>
                                <span className={styles.statValue}>
                                    {feeRecommendation.maxFee.toLocaleString()} stroops
                                    <span className={styles.statSub}>
                                        ({feeRecommendation.maxFeeXLM} XLM)
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Fee Bump Alert */}
                        {feeRecommendation.shouldBumpFee && (
                            <div className={styles.alertBanner}>
                                <span className={styles.alertIcon}>⚠️</span>
                                <div className={styles.alertContent}>
                                    <h4>High Congestion — Fee Bump Recommended</h4>
                                    <p>
                                        The network is experiencing high traffic (
                                        {(feeRecommendation.ledgerCapacityUsage * 100).toFixed(1)}%
                                        capacity). Consider using the recommended fee of{" "}
                                        <strong>
                                            {feeRecommendation.recommendedFee.toLocaleString()} stroops
                                        </strong>{" "}
                                        or higher to ensure timely processing of payroll transactions.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Batch Budget Estimator */}
                        <div className={`${styles.card} ${styles.batchCard}`}>
                            <h2 className={styles.cardTitle}>Batch Payment Budget Estimator</h2>

                            <div className={styles.batchInputRow}>
                                <label className={styles.statLabel} htmlFor="txCount">
                                    Number of transactions:
                                </label>
                                <input
                                    id="txCount"
                                    className={styles.batchInput}
                                    type="number"
                                    min="1"
                                    placeholder="e.g. 50"
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
                                    {batchLoading ? "Calculating…" : "Estimate"}
                                </button>
                            </div>

                            {batchResult && (
                                <div className={styles.batchResults}>
                                    <div className={styles.statRow}>
                                        <span className={styles.statLabel}>Transactions</span>
                                        <span className={styles.statValue}>
                                            {batchResult.transactionCount}
                                        </span>
                                    </div>
                                    <div className={styles.statRow}>
                                        <span className={styles.statLabel}>Fee per Transaction</span>
                                        <span className={styles.statValue}>
                                            {batchResult.feePerTransaction.toLocaleString()} stroops
                                            <span className={styles.statSub}>
                                                ({batchResult.feePerTransactionXLM} XLM)
                                            </span>
                                        </span>
                                    </div>
                                    <div className={styles.statRow}>
                                        <span className={styles.statLabel}>Total Budget</span>
                                        <span className={styles.statValue}>
                                            {batchResult.totalBudget.toLocaleString()} stroops
                                            <span className={styles.statSub}>
                                                ({batchResult.totalBudgetXLM} XLM)
                                            </span>
                                        </span>
                                    </div>
                                    <div className={styles.statRow}>
                                        <span className={styles.statLabel}>Safety Margin</span>
                                        <span className={styles.statValue}>
                                            {batchResult.safetyMargin}×
                                            <span className={styles.statSub}>
                                                ({congestionLabel(batchResult.congestionLevel)} congestion)
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
