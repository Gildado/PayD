/**
 * Fee Estimation Drift Detection Agent.
 *
 * Detects anomalous fee spikes, fee-to-congestion inversions, sudden volatility,
 * and underestimation risks in Stellar fee recommendations.
 *
 * Resolves Issue #1201.
 */

import { randomUUID } from 'node:crypto';
import type { AnomalyEvent, AnomalyEventHandler } from '../types/anomalyEvent.js';
import type { FeeRecommendation, HorizonFeeStats } from './feeEstimationService.js';

export interface FeeEstimationDriftOptions {
  /** Multiplier above rolling mean fee that constitutes anomalous drift. Default: 3.0 (3x). */
  driftMultiplierThreshold?: number;
  /** Absolute ceiling in Stroops before triggering critical alert. Default: 10,000 Stroops. */
  maxAllowedFeeStroops?: number;
  /** Ledger capacity usage ratio above which low fees count as inversion risk. Default: 0.85. */
  minCapacityInversionUsage?: number;
  /** Number of recent fee recommendations retained for rolling baseline. Default: 20. */
  rollingWindowSize?: number;
  /** Minimum samples required before statistical drift alerts fire. Default: 5. */
  minSamplesForBaseline?: number;
  /** Optional callback or event handler for downstream alerting. */
  onAnomaly?: AnomalyEventHandler;
}

export class FeeEstimationDriftDetectionAgent {
  readonly id = 'fee-estimation-drift-detection';
  private readonly driftMultiplierThreshold: number;
  private readonly maxAllowedFeeStroops: number;
  private readonly minCapacityInversionUsage: number;
  private readonly rollingWindowSize: number;
  private readonly minSamplesForBaseline: number;
  private readonly onAnomaly?: AnomalyEventHandler;

  // In-memory rolling history of fee samples: { fee: number; timestamp: number }
  private readonly feeHistory: Array<{ fee: number; timestamp: number }> = [];

  constructor(options: FeeEstimationDriftOptions = {}) {
    this.driftMultiplierThreshold =
      options.driftMultiplierThreshold ??
      (process.env.FEE_DRIFT_MULTIPLIER_THRESHOLD
        ? Number(process.env.FEE_DRIFT_MULTIPLIER_THRESHOLD)
        : 3.0);

    this.maxAllowedFeeStroops =
      options.maxAllowedFeeStroops ??
      (process.env.MAX_ALLOWED_FEE_STROOPS
        ? Number(process.env.MAX_ALLOWED_FEE_STROOPS)
        : 10_000);

    this.minCapacityInversionUsage = options.minCapacityInversionUsage ?? 0.85;
    this.rollingWindowSize = options.rollingWindowSize ?? 20;
    this.minSamplesForBaseline = options.minSamplesForBaseline ?? 5;
    this.onAnomaly = options.onAnomaly;
  }

  /**
   * Evaluates a fee recommendation and network fee stats for anomalies and drift.
   */
  async evaluateRecommendation(params: {
    recommendation: FeeRecommendation;
    stats?: HorizonFeeStats;
    now?: number;
  }): Promise<AnomalyEvent[]> {
    const { recommendation, stats } = params;
    const now = params.now ?? Date.now();
    const anomalies: AnomalyEvent[] = [];
    const fee = recommendation.recommendedFee;

    // 1. Absolute Maximum Fee Ceiling Check
    if (fee >= this.maxAllowedFeeStroops) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        severity: 'critical',
        reason: 'absolute_fee_surge',
        title: 'Critical Network Fee Surge Detected',
        description: `Recommended fee ${fee} Stroops exceeds absolute ceiling ${this.maxAllowedFeeStroops} Stroops`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          recommendedFee: fee,
          ceiling: this.maxAllowedFeeStroops,
          congestionLevel: recommendation.congestionLevel,
          lastLedger: recommendation.lastLedger,
        },
      });
    }

    // 2. Statistical Rolling Drift Check
    if (this.feeHistory.length >= this.minSamplesForBaseline) {
      const sum = this.feeHistory.reduce((acc, h) => acc + h.fee, 0);
      const baselineMean = sum / this.feeHistory.length;

      if (fee >= baselineMean * this.driftMultiplierThreshold) {
        anomalies.push({
          id: randomUUID(),
          agentId: this.id,
          severity: 'warning',
          reason: 'fee_surge_drift',
          title: 'Fee Recommendation Divergence from Rolling Baseline',
          description: `Recommended fee ${fee} Stroops is ${(fee / baselineMean).toFixed(1)}x above rolling average (${Math.round(baselineMean)} Stroops)`,
          detectedAt: new Date(now).toISOString(),
          metadata: {
            recommendedFee: fee,
            baselineMean: Math.round(baselineMean),
            driftRatio: Math.round((fee / baselineMean) * 100) / 100,
            thresholdMultiplier: this.driftMultiplierThreshold,
            sampleCount: this.feeHistory.length,
          },
        });
      }
    }

    // 3. Congestion / Fee Inversion Anomaly
    // If ledger capacity is saturated (> 85%) but fee remains low (<= baseFee + 10 Stroops), transactions will stall
    if (
      recommendation.ledgerCapacityUsage >= this.minCapacityInversionUsage &&
      fee <= recommendation.baseFee + 10
    ) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        severity: 'warning',
        reason: 'congestion_underestimation_inversion',
        title: 'Fee Inversion Under High Congestion',
        description: `Network capacity usage is high (${Math.round(recommendation.ledgerCapacityUsage * 100)}%), but recommended fee is only ${fee} Stroops, risking transaction drops`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          ledgerCapacityUsage: recommendation.ledgerCapacityUsage,
          recommendedFee: fee,
          baseFee: recommendation.baseFee,
          thresholdUsage: this.minCapacityInversionUsage,
        },
      });
    }

    // 4. Low Congestion Overpayment Anomaly
    if (recommendation.ledgerCapacityUsage < 0.15 && fee >= 500) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        severity: 'info',
        reason: 'low_congestion_overpayment',
        title: 'Fee Overpayment Under Low Congestion',
        description: `Network capacity is idle (${Math.round(recommendation.ledgerCapacityUsage * 100)}%), but recommended fee is elevated at ${fee} Stroops`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          ledgerCapacityUsage: recommendation.ledgerCapacityUsage,
          recommendedFee: fee,
        },
      });
    }

    // Update rolling history (bounded by rollingWindowSize)
    this.feeHistory.push({ fee, timestamp: now });
    if (this.feeHistory.length > this.rollingWindowSize) {
      this.feeHistory.shift();
    }

    // Notify handler if registered
    if (this.onAnomaly && anomalies.length > 0) {
      for (const anomaly of anomalies) {
        try {
          await this.onAnomaly(anomaly);
        } catch {
          // ignore delivery failures
        }
      }
    }

    return anomalies;
  }

  /** Clears rolling baseline history (useful in tests). */
  resetRollingWindow(): void {
    this.feeHistory.length = 0;
  }
}

export const feeEstimationDriftDetectionAgent = new FeeEstimationDriftDetectionAgent();
