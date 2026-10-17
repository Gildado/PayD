/**
 * FX Rate Manipulation and Staleness Detection Agent.
 *
 * Detects stale FX rate payloads, invalid rates, and abnormal rate jumps
 * between consecutive payloads before the rates are used in conversions.
 *
 * Resolves Issue #1198.
 */

import { randomUUID } from 'node:crypto';
import type { AnomalyEvent, AnomalyEventHandler } from '../types/anomalyEvent.js';
import type { OrgUsdRatesPayload } from './fxRateService.js';

export interface FxRateAnomalyOptions {
  /** Maximum age of a rate payload before it is stale, in milliseconds. Default: 900,000 (15 minutes). */
  maxStalenessMs?: number;
  /** Maximum relative change for one currency between consecutive payloads. Default: 0.05 (5%). */
  maxDeviationRatio?: number;
  /** Optional callback or event handler for downstream alerting. */
  onAnomaly?: AnomalyEventHandler;
}

function readNumberEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return process.env[name] !== undefined && Number.isFinite(parsed) ? parsed : fallback;
}

export class FxRateAnomalyDetectionAgent {
  readonly id = 'fx-rate-anomaly-detection';
  private readonly maxStalenessMs: number;
  private readonly maxDeviationRatio: number;
  private readonly onAnomaly?: AnomalyEventHandler;

  constructor(options: FxRateAnomalyOptions = {}) {
    this.maxStalenessMs =
      options.maxStalenessMs ?? readNumberEnv('FX_RATE_MAX_STALENESS_MS', 900_000);
    this.maxDeviationRatio =
      options.maxDeviationRatio ?? readNumberEnv('FX_RATE_MAX_DEVIATION_RATIO', 0.05);
    this.onAnomaly = options.onAnomaly;
  }

  /**
   * Evaluates the current rate payload for staleness and invalid values, and
   * compares it with the previous payload to flag abnormal rate jumps.
   */
  async evaluatePayload(params: {
    current: OrgUsdRatesPayload;
    previous?: OrgUsdRatesPayload;
    now?: number;
  }): Promise<AnomalyEvent[]> {
    const { current, previous } = params;
    const now = params.now ?? Date.now();
    const fetchedAt = new Date(current.fetchedAt).getTime();
    const anomalies: AnomalyEvent[] = [];

    if (!Number.isFinite(fetchedAt) || now - fetchedAt > this.maxStalenessMs) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        severity: 'warning',
        reason: 'fx_rate_stale',
        title: 'Stale FX Rate Payload',
        description: `Rates from ${current.provider} were fetched at ${current.fetchedAt} and exceed the ${this.maxStalenessMs} ms staleness limit`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          provider: current.provider,
          fetchedAt: current.fetchedAt,
          maxStalenessMs: this.maxStalenessMs,
        },
      });
    }

    const invalidCurrencies = Object.entries(current.rates)
      .filter(([, rate]) => !Number.isFinite(rate) || rate <= 0)
      .map(([currency]) => currency);

    if (invalidCurrencies.length > 0) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        severity: 'critical',
        reason: 'fx_rate_invalid',
        title: 'Invalid FX Rate Values',
        description: `Rates from ${current.provider} contain non-positive or non-finite values for ${invalidCurrencies.join(', ')}`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          provider: current.provider,
          currencies: invalidCurrencies,
        },
      });
    }

    if (previous) {
      for (const [currency, rate] of Object.entries(current.rates)) {
        const previousRate = previous.rates[currency];
        if (!previousRate || previousRate <= 0 || !Number.isFinite(rate) || rate <= 0) {
          continue;
        }
        const deviationRatio = Math.abs(rate - previousRate) / previousRate;
        if (deviationRatio > this.maxDeviationRatio) {
          anomalies.push({
            id: randomUUID(),
            agentId: this.id,
            severity: 'critical',
            reason: 'fx_rate_deviation',
            title: 'Abnormal FX Rate Movement',
            description: `${currency} moved ${Math.round(deviationRatio * 10000) / 100}% between consecutive rate payloads, above the ${this.maxDeviationRatio * 100}% limit`,
            detectedAt: new Date(now).toISOString(),
            metadata: {
              provider: current.provider,
              currency,
              previousRate,
              currentRate: rate,
              deviationRatio: Math.round(deviationRatio * 10000) / 10000,
              maxDeviationRatio: this.maxDeviationRatio,
            },
          });
        }
      }
    }

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
}

export const fxRateAnomalyDetectionAgent = new FxRateAnomalyDetectionAgent();
