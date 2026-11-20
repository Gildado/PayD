/**
 * Claimable Balance Abuse Detection Agent.
 *
 * Detects abnormal claimable balance patterns, including dust spam attacks,
 * rapid creation bursts, excessive single-balance amounts, and abnormal
 * expiration windows.
 *
 * Resolves Issue #1203.
 */

import { randomUUID } from 'node:crypto';
import type { AnomalyEvent, AnomalyEventHandler } from '../types/anomalyEvent.js';
import type { CreateClaimableBalanceInput } from './claimableBalanceService.js';

export interface ClaimableBalanceAbuseOptions {
  /** Amounts below this threshold count as micro/dust balances. Default: 0.001. */
  dustAmountThreshold?: number;
  /** Single balance amount threshold that triggers a critical alert. Default: 50,000. */
  criticalAmountThreshold?: number;
  /** Maximum balances created per organization/sponsor within window. Default: 10. */
  maxCreationsPerWindow?: number;
  /** Sliding window duration for creation burst detection in milliseconds. Default: 60,000ms. */
  burstWindowMs?: number;
  /** Minimum recommended expiration duration in days. Default: 1. */
  minValidExpirationDays?: number;
  /** Optional callback or event handler for downstream alerting. */
  onAnomaly?: AnomalyEventHandler;
}

export class ClaimableBalanceAbuseDetectionAgent {
  readonly id = 'claimable-balance-abuse-detection';
  private readonly dustAmountThreshold: number;
  private readonly criticalAmountThreshold: number;
  private readonly maxCreationsPerWindow: number;
  private readonly burstWindowMs: number;
  private readonly minValidExpirationDays: number;
  private readonly onAnomaly?: AnomalyEventHandler;

  // Sliding window tracking creations: Map<orgOrSponsorKey, number[]>
  private readonly creationTimestamps = new Map<string, number[]>();

  constructor(options: ClaimableBalanceAbuseOptions = {}) {
    this.dustAmountThreshold =
      options.dustAmountThreshold ??
      (process.env.CLAIMABLE_DUST_THRESHOLD
        ? Number(process.env.CLAIMABLE_DUST_THRESHOLD)
        : 0.001);

    this.criticalAmountThreshold =
      options.criticalAmountThreshold ??
      (process.env.CLAIMABLE_CRITICAL_AMOUNT_THRESHOLD
        ? Number(process.env.CLAIMABLE_CRITICAL_AMOUNT_THRESHOLD)
        : 50_000);

    this.maxCreationsPerWindow =
      options.maxCreationsPerWindow ??
      (process.env.CLAIMABLE_MAX_CREATIONS_PER_WINDOW
        ? Number(process.env.CLAIMABLE_MAX_CREATIONS_PER_WINDOW)
        : 10);

    this.burstWindowMs =
      options.burstWindowMs ??
      (process.env.CLAIMABLE_BURST_WINDOW_MS
        ? Number(process.env.CLAIMABLE_BURST_WINDOW_MS)
        : 60_000);

    this.minValidExpirationDays = options.minValidExpirationDays ?? 1;
    this.onAnomaly = options.onAnomaly;
  }

  /**
   * Evaluates a claimable balance creation request for abusive or anomalous patterns.
   */
  async evaluateBalanceCreation(params: {
    input: CreateClaimableBalanceInput;
    balanceId?: string;
    now?: number;
  }): Promise<AnomalyEvent[]> {
    const { input, balanceId } = params;
    const now = params.now ?? Date.now();
    const anomalies: AnomalyEvent[] = [];

    const amountNum = parseFloat(input.amount);
    const trackingKey = `org-${input.organization_id}`;

    // 1. Dust Balance Spam Check
    if (!isNaN(amountNum) && amountNum <= this.dustAmountThreshold) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        organizationId: input.organization_id,
        severity: 'warning',
        reason: 'dust_balance_spam',
        title: 'Micro/Dust Claimable Balance Spam Detected',
        description: `Claimable balance created with micro-amount ${input.amount} ${input.asset_code} (<= ${this.dustAmountThreshold})`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          balanceId,
          amount: input.amount,
          assetCode: input.asset_code,
          claimant: input.claimant_public_key,
          threshold: this.dustAmountThreshold,
        },
      });
    }

    // 2. Critical High-Value Amount Outlier Check
    if (!isNaN(amountNum) && amountNum >= this.criticalAmountThreshold) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        organizationId: input.organization_id,
        severity: 'critical',
        reason: 'excessive_amount_outlier',
        title: 'High-Value Claimable Balance Outlier Created',
        description: `Balance amount ${input.amount} ${input.asset_code} exceeds critical threshold ${this.criticalAmountThreshold}`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          balanceId,
          amount: input.amount,
          assetCode: input.asset_code,
          claimant: input.claimant_public_key,
          threshold: this.criticalAmountThreshold,
        },
      });
    }

    // 3. Abnormal Expiration Window Check
    if (input.expires_in_days !== undefined && input.expires_in_days < this.minValidExpirationDays) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        organizationId: input.organization_id,
        severity: 'warning',
        reason: 'abnormal_expiration_window',
        title: 'Abnormally Short Claimable Balance Expiration',
        description: `Balance set to expire in ${input.expires_in_days} days (below recommended minimum of ${this.minValidExpirationDays} day)`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          balanceId,
          expiresInDays: input.expires_in_days,
          thresholdDays: this.minValidExpirationDays,
        },
      });
    }

    // 4. Creation Burst / Flooding Check
    const timestamps = this.creationTimestamps.get(trackingKey) || [];
    const windowStart = now - this.burstWindowMs;
    const recent = timestamps.filter((t) => t >= windowStart);
    recent.push(now);
    this.creationTimestamps.set(trackingKey, recent);

    if (recent.length >= this.maxCreationsPerWindow) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        organizationId: input.organization_id,
        severity: 'warning',
        reason: 'creation_burst_flood',
        title: 'Rapid Claimable Balance Creation Burst',
        description: `Organization ${input.organization_id} created ${recent.length} claimable balances within ${Math.round(this.burstWindowMs / 1000)} seconds`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          organizationId: input.organization_id,
          creationsCount: recent.length,
          windowSeconds: Math.round(this.burstWindowMs / 1000),
          threshold: this.maxCreationsPerWindow,
        },
      });
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

  /** Clears in-memory creation tracking (useful in tests). */
  resetActivity(): void {
    this.creationTimestamps.clear();
  }
}

export const claimableBalanceAbuseDetectionAgent = new ClaimableBalanceAbuseDetectionAgent();
