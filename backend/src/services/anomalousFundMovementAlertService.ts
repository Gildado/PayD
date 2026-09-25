/**
 * Post-mainnet monitoring for anomalous fund movements (#1621).
 *
 * PayD's contracts hold and move real organization funds on mainnet, so
 * an unusually large withdrawal/transfer — or a burst of them from the
 * same address in a short window — is exactly the shape of event an
 * operator needs to know about immediately, not discover in a report the
 * next day.
 *
 * This service is deliberately decoupled from the indexer's DB/RPC
 * plumbing (SorobanEventIndexer): it takes already-decoded fund-movement
 * events and evaluates them against per-contract rolling statistics, so
 * the detection logic itself is unit-testable without a database or a
 * live Soroban RPC endpoint. `SorobanEventIndexer.storeEvents()` is the
 * integration point — see the call there.
 */

import logger from '../utils/logger.js';

export type AlertSeverity = 'warning' | 'critical';

/** The subset of a decoded contract event this service cares about. */
export interface FundMovementEvent {
  contractId: string;
  eventType: string;
  fromAddress: string;
  amount: number;
  ledgerSequence: number;
  txHash?: string;
}

export interface FundMovementAlert {
  severity: AlertSeverity;
  reason: 'large_amount' | 'statistical_outlier' | 'rapid_succession';
  contractId: string;
  fromAddress: string;
  amount: number;
  detail: string;
  triggeredAt: string;
}

export type FundMovementAlertHandler = (
  alert: FundMovementAlert
) => void | Promise<void>;

export interface AnomalousFundMovementAlertServiceOptions {
  /** Absolute amount (in the event's native unit) that always alerts, regardless of history. Default: 1_000_000. */
  criticalAmountThreshold?: number;
  /** Number of recent amounts per contract kept for the rolling baseline. Default: 50. */
  rollingWindowSize?: number;
  /** Minimum samples in the rolling window before statistical outlier detection kicks in. Default: 10. */
  minSamplesForBaseline?: number;
  /** Standard deviations above the rolling mean that counts as an outlier. Default: 4. */
  outlierZScoreThreshold?: number;
  /** Movements from the same address within this window count toward rapid-succession detection. Default: 60_000 (1 minute). */
  rapidSuccessionWindowMs?: number;
  /** Number of movements from the same address within the window that triggers an alert. Default: 5. */
  rapidSuccessionCountThreshold?: number;
  onAlert?: FundMovementAlertHandler;
}

interface AddressActivity {
  timestamps: number[];
}

const DEFAULTS = {
  criticalAmountThreshold: 1_000_000,
  rollingWindowSize: 50,
  minSamplesForBaseline: 10,
  outlierZScoreThreshold: 4,
  rapidSuccessionWindowMs: 60_000,
  rapidSuccessionCountThreshold: 5,
};

export class AnomalousFundMovementAlertService {
  private readonly criticalAmountThreshold: number;
  private readonly rollingWindowSize: number;
  private readonly minSamplesForBaseline: number;
  private readonly outlierZScoreThreshold: number;
  private readonly rapidSuccessionWindowMs: number;
  private readonly rapidSuccessionCountThreshold: number;
  private readonly onAlert: FundMovementAlertHandler;

  /** Recent amounts per contract, oldest first, capped at rollingWindowSize. */
  private readonly amountHistory = new Map<string, number[]>();
  /** Recent movement timestamps per (contract, address), for rapid-succession detection. */
  private readonly addressActivity = new Map<string, AddressActivity>();

  constructor(options: AnomalousFundMovementAlertServiceOptions = {}) {
    this.criticalAmountThreshold =
      options.criticalAmountThreshold ?? DEFAULTS.criticalAmountThreshold;
    this.rollingWindowSize = options.rollingWindowSize ?? DEFAULTS.rollingWindowSize;
    this.minSamplesForBaseline =
      options.minSamplesForBaseline ?? DEFAULTS.minSamplesForBaseline;
    this.outlierZScoreThreshold =
      options.outlierZScoreThreshold ?? DEFAULTS.outlierZScoreThreshold;
    this.rapidSuccessionWindowMs =
      options.rapidSuccessionWindowMs ?? DEFAULTS.rapidSuccessionWindowMs;
    this.rapidSuccessionCountThreshold =
      options.rapidSuccessionCountThreshold ?? DEFAULTS.rapidSuccessionCountThreshold;
    this.onAlert =
      options.onAlert ??
      ((alert) => logger.warn({ alert }, 'Anomalous fund movement alert'));
  }

  /**
   * Evaluates one fund-movement event, updating rolling statistics and
   * raising zero or more alerts (an event can trigger more than one
   * reason at once, e.g. both large_amount and rapid_succession).
   */
  async evaluate(event: FundMovementEvent): Promise<FundMovementAlert[]> {
    const alerts: FundMovementAlert[] = [];
    const now = Date.now();
    const triggeredAt = new Date(now).toISOString();

    if (event.amount >= this.criticalAmountThreshold) {
      alerts.push({
        severity: 'critical',
        reason: 'large_amount',
        contractId: event.contractId,
        fromAddress: event.fromAddress,
        amount: event.amount,
        detail: `Amount ${event.amount} meets or exceeds the critical threshold of ${this.criticalAmountThreshold}`,
        triggeredAt,
      });
    }

    const history = this.amountHistory.get(event.contractId) ?? [];
    if (history.length >= this.minSamplesForBaseline) {
      const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
      const variance =
        history.reduce((sum, v) => sum + (v - mean) ** 2, 0) / history.length;
      const stddev = Math.sqrt(variance);

      if (stddev > 0) {
        const zScore = (event.amount - mean) / stddev;
        if (zScore >= this.outlierZScoreThreshold) {
          alerts.push({
            severity: 'warning',
            reason: 'statistical_outlier',
            contractId: event.contractId,
            fromAddress: event.fromAddress,
            amount: event.amount,
            detail: `Amount ${event.amount} is ${zScore.toFixed(1)} standard deviations above the rolling mean of ${mean.toFixed(2)} (n=${history.length})`,
            triggeredAt,
          });
        }
      }
    }

    history.push(event.amount);
    if (history.length > this.rollingWindowSize) {
      history.shift();
    }
    this.amountHistory.set(event.contractId, history);

    const activityKey = `${event.contractId}:${event.fromAddress}`;
    const activity = this.addressActivity.get(activityKey) ?? { timestamps: [] };
    activity.timestamps = activity.timestamps.filter(
      (t) => now - t <= this.rapidSuccessionWindowMs
    );
    activity.timestamps.push(now);
    this.addressActivity.set(activityKey, activity);

    if (activity.timestamps.length >= this.rapidSuccessionCountThreshold) {
      alerts.push({
        severity: 'critical',
        reason: 'rapid_succession',
        contractId: event.contractId,
        fromAddress: event.fromAddress,
        amount: event.amount,
        detail: `${activity.timestamps.length} movements from ${event.fromAddress} within ${this.rapidSuccessionWindowMs}ms`,
        triggeredAt,
      });
    }

    for (const alert of alerts) {
      await this.onAlert(alert);
    }

    return alerts;
  }

  /** Test/ops helper: clears all rolling state (does not affect config). */
  reset(): void {
    this.amountHistory.clear();
    this.addressActivity.clear();
  }
}

let singleton: AnomalousFundMovementAlertService | null = null;

export const getAnomalousFundMovementAlertService =
  (): AnomalousFundMovementAlertService => {
    if (!singleton) {
      singleton = new AnomalousFundMovementAlertService();
    }
    return singleton;
  };
