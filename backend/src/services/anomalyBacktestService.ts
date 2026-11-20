/**
 * Historical backtesting harness for anomaly detection rules (#1217).
 *
 * Replays historical payment data through detection rules to measure
 * precision/recall before deploying threshold changes to production.
 * This lets operators tune thresholds with confidence rather than guessing.
 *
 * Usage:
 *   const harness = new BacktestHarness();
 *   const result = await harness.run(rules, historicalData, knownAnomalies);
 *   console.log(result.metrics); // precision, recall, F1
 */

import logger from '../utils/logger.js';

export interface BacktestRule {
  rule: string;
  threshold: number;
  evaluate: (event: HistoricalEvent) => boolean;
}

export interface HistoricalEvent {
  id: string;
  orgId: string;
  amount: number;
  timestamp: string;
  /** Ground truth: was this event actually anomalous? */
  isAnomaly: boolean;
  /** Additional fields for rule evaluation. */
  [key: string]: unknown;
}

export interface BacktestMetrics {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface BacktestResult {
  metrics: BacktestMetrics;
  /** Events that triggered a rule. */
  flagged: HistoricalEvent[];
  /** Events that were flagged but weren't actually anomalies. */
  falsePositives: HistoricalEvent[];
  /** Events that were anomalies but weren't flagged. */
  falseNegatives: HistoricalEvent[];
}

export class BacktestHarness {
  /**
   * Run a set of rules against historical data and compute metrics.
   */
  async run(
    rules: BacktestRule[],
    data: HistoricalEvent[],
  ): Promise<BacktestResult> {
    const flagged: HistoricalEvent[] = [];
    const falsePositives: HistoricalEvent[] = [];
    const falseNegatives: HistoricalEvent[] = [];
    let truePositives = 0;
    let trueNegatives = 0;

    for (const event of data) {
      const triggered = rules.some((rule) => rule.evaluate(event));
      const wasAnomaly = event.isAnomaly;

      if (triggered && wasAnomaly) {
        truePositives++;
        flagged.push(event);
      } else if (triggered && !wasAnomaly) {
        falsePositives.push(event);
        flagged.push(event);
      } else if (!triggered && wasAnomaly) {
        falseNegatives.push(event);
      } else {
        trueNegatives++;
      }
    }

    const totalFlagged = truePositives + falsePositives;
    const totalAnomalies = truePositives + falseNegatives;

    const precision = totalFlagged > 0 ? truePositives / totalFlagged : 0;
    const recall = totalAnomalies > 0 ? truePositives / totalAnomalies : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    const metrics: BacktestMetrics = {
      truePositives,
      falsePositives: falsePositives.length,
      trueNegatives,
      falseNegatives: falseNegatives.length,
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      f1Score: Math.round(f1Score * 1000) / 1000,
    };

    logger.info(
      { metrics, totalEvents: data.length },
      'Backtest completed',
    );

    return { metrics, flagged, falsePositives, falseNegatives };
  }
}
