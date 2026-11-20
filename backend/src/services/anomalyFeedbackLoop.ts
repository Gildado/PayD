/**
 * False-positive feedback loop for anomaly agents (#1215).
 *
 * Collects operator feedback on anomaly detections (true positive / false
 * positive) and adjusts detection thresholds to reduce future false
 * positives while maintaining true-positive detection rates.
 *
 * Per-source adaptive thresholds: if an agent consistently produces false
 * positives, its sensitivity is reduced; if it misses true positives,
 * sensitivity is increased.
 */

import logger from '../utils/logger.js';

export type FeedbackLabel = 'true_positive' | 'false_positive' | 'benign';

export interface FeedbackEntry {
  anomalyId: string;
  source: string;
  label: FeedbackLabel;
  feedbackBy: string;
  feedbackAt: string;
  notes?: string;
}

export interface ThresholdAdjustment {
  source: string;
  metric: string;
  previousValue: number;
  newValue: number;
  reason: string;
  adjustedAt: string;
}

export interface FeedbackLoopOptions {
  /** Minimum feedback entries per source before adjusting thresholds. Default: 10. */
  minFeedbackForAdjustment?: number;
  /** Maximum threshold multiplier (cap on sensitivity reduction). Default: 2.0. */
  maxThresholdMultiplier?: number;
  /** Minimum threshold multiplier (cap on sensitivity increase). Default: 0.5. */
  minThresholdMultiplier?: number;
  /** FP rate above which to reduce sensitivity. Default: 0.5. */
  fpRateThreshold?: number;
  /** TP rate below which to increase sensitivity. Default: 0.3. */
  tpRateThreshold?: number;
  /** Step size for threshold adjustments. Default: 0.1. */
  adjustmentStep?: number;
}

const DEFAULTS = {
  minFeedbackForAdjustment: 10,
  maxThresholdMultiplier: 2.0,
  minThresholdMultiplier: 0.5,
  fpRateThreshold: 0.5,
  tpRateThreshold: 0.3,
  adjustmentStep: 0.1,
};

interface SourceStats {
  total: number;
  truePositives: number;
  falsePositives: number;
  benign: number;
  thresholdMultiplier: number;
}

export class AnomalyFeedbackLoop {
  private readonly minFeedbackForAdjustment: number;
  private readonly maxThresholdMultiplier: number;
  private readonly minThresholdMultiplier: number;
  private readonly fpRateThreshold: number;
  private readonly tpRateThreshold: number;
  private readonly adjustmentStep: number;

  private readonly feedbackLog: FeedbackEntry[] = [];
  private readonly sourceStats = new Map<string, SourceStats>();
  private readonly adjustments: ThresholdAdjustment[] = [];

  constructor(options: FeedbackLoopOptions = {}) {
    this.minFeedbackForAdjustment =
      options.minFeedbackForAdjustment ?? DEFAULTS.minFeedbackForAdjustment;
    this.maxThresholdMultiplier =
      options.maxThresholdMultiplier ?? DEFAULTS.maxThresholdMultiplier;
    this.minThresholdMultiplier =
      options.minThresholdMultiplier ?? DEFAULTS.minThresholdMultiplier;
    this.fpRateThreshold = options.fpRateThreshold ?? DEFAULTS.fpRateThreshold;
    this.tpRateThreshold = options.tpRateThreshold ?? DEFAULTS.tpRateThreshold;
    this.adjustmentStep = options.adjustmentStep ?? DEFAULTS.adjustmentStep;
  }

  /**
   * Record operator feedback and adjust thresholds if enough data.
   */
  submitFeedback(entry: Omit<FeedbackEntry, 'feedbackAt'>): ThresholdAdjustment[] {
    const feedback: FeedbackEntry = {
      ...entry,
      feedbackAt: new Date().toISOString(),
    };
    this.feedbackLog.push(feedback);

    const stats = this.sourceStats.get(feedback.source) ?? {
      total: 0,
      truePositives: 0,
      falsePositives: 0,
      benign: 0,
      thresholdMultiplier: 1.0,
    };

    stats.total++;
    if (feedback.label === 'true_positive') stats.truePositives++;
    else if (feedback.label === 'false_positive') stats.falsePositives++;
    else stats.benign++;

    this.sourceStats.set(feedback.source, stats);

    // Check if we have enough data to adjust
    if (stats.total < this.minFeedbackForAdjustment) {
      return [];
    }

    return this.maybeAdjustThreshold(feedback.source, stats);
  }

  private maybeAdjustThreshold(source: string, stats: SourceStats): ThresholdAdjustment[] {
    const adjustments: ThresholdAdjustment[] = [];
    const fpRate = stats.total > 0 ? stats.falsePositives / stats.total : 0;
    const tpRate = stats.total > 0 ? stats.truePositives / stats.total : 0;

    let newMultiplier = stats.thresholdMultiplier;
    let reason = '';

    if (fpRate > this.fpRateThreshold && stats.thresholdMultiplier < this.maxThresholdMultiplier) {
      // Too many false positives — reduce sensitivity (increase threshold)
      newMultiplier = Math.min(
        stats.thresholdMultiplier + this.adjustmentStep,
        this.maxThresholdMultiplier,
      );
      reason = `FP rate ${(fpRate * 100).toFixed(1)}% exceeds threshold — reducing sensitivity`;
    } else if (tpRate < this.tpRateThreshold && stats.thresholdMultiplier > this.minThresholdMultiplier) {
      // Too few true positives — increase sensitivity (decrease threshold)
      newMultiplier = Math.max(
        stats.thresholdMultiplier - this.adjustmentStep,
        this.minThresholdMultiplier,
      );
      reason = `TP rate ${(tpRate * 100).toFixed(1)}% below threshold — increasing sensitivity`;
    }

    if (newMultiplier !== stats.thresholdMultiplier) {
      const adjustment: ThresholdAdjustment = {
        source,
        metric: 'threshold_multiplier',
        previousValue: stats.thresholdMultiplier,
        newValue: newMultiplier,
        reason,
        adjustedAt: new Date().toISOString(),
      };
      stats.thresholdMultiplier = newMultiplier;
      this.adjustments.push(adjustment);
      adjustments.push(adjustment);

      logger.info({ adjustment }, 'Anomaly detection threshold adjusted via feedback loop');
    }

    return adjustments;
  }

  /**
   * Get the current threshold multiplier for a source (for detection agents to use).
   */
  getThresholdMultiplier(source: string): number {
    return this.sourceStats.get(source)?.thresholdMultiplier ?? 1.0;
  }

  /**
   * Get feedback statistics for a source.
   */
  getSourceStats(source: string): SourceStats | undefined {
    return this.sourceStats.get(source);
  }

  /**
   * Get all threshold adjustments made.
   */
  getAdjustments(): ThresholdAdjustment[] {
    return [...this.adjustments];
  }

  reset(): void {
    this.feedbackLog.length = 0;
    this.sourceStats.clear();
    this.adjustments.length = 0;
  }
}
