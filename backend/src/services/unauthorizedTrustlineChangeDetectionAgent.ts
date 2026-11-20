/**
 * Unauthorized Trustline Change Detection Agent.
 *
 * Detects trustline modifications not initiated through the normal organization
 * workflow, including unapproved asset codes, direct workflow bypasses (none -> established
 * without pending state), and rapid trustline churn.
 *
 * Resolves Issue #1202.
 */

import { randomUUID } from 'node:crypto';
import type { AnomalyEvent, AnomalyEventHandler } from '../types/anomalyEvent.js';
import type { TrustlineStatus } from './trustlineService.js';

export interface UnauthorizedTrustlineOptions {
  /** Whitelist of approved asset codes. Default: ['USDC', 'EURC', 'XLM', 'ORGUSD', 'PAYD', 'USD']. */
  approvedAssetCodes?: string[];
  /** Optional whitelist of approved asset issuer public keys. */
  approvedIssuers?: string[];
  /** Whether trustlines must transition through 'pending' before 'established'. Default: true. */
  requirePendingStatus?: boolean;
  /** Maximum trustline changes per wallet within window before flagging churn. Default: 4. */
  rapidChangeThreshold?: number;
  /** Window duration in milliseconds for rapid churn tracking. Default: 60,000ms (1 minute). */
  rapidChangeWindowMs?: number;
  /** Optional callback or event handler for downstream alerting. */
  onAnomaly?: AnomalyEventHandler;
}

export class UnauthorizedTrustlineChangeDetectionAgent {
  readonly id = 'unauthorized-trustline-change-detection';
  private readonly approvedAssetCodes: Set<string>;
  private readonly approvedIssuers?: Set<string>;
  private readonly requirePendingStatus: boolean;
  private readonly rapidChangeThreshold: number;
  private readonly rapidChangeWindowMs: number;
  private readonly onAnomaly?: AnomalyEventHandler;

  // In-memory sliding window of trustline modification timestamps per wallet: Map<walletAddress, number[]>
  private readonly walletActivity = new Map<string, number[]>();

  constructor(options: UnauthorizedTrustlineOptions = {}) {
    const defaultCodes = ['USDC', 'EURC', 'XLM', 'ORGUSD', 'PAYD', 'USD'];
    const codes =
      options.approvedAssetCodes ??
      (process.env.APPROVED_ASSET_CODES
        ? process.env.APPROVED_ASSET_CODES.split(',').map((c) => c.trim().toUpperCase())
        : defaultCodes);

    this.approvedAssetCodes = new Set(codes.map((c) => c.toUpperCase()));

    if (options.approvedIssuers && options.approvedIssuers.length > 0) {
      this.approvedIssuers = new Set(options.approvedIssuers);
    }

    this.requirePendingStatus = options.requirePendingStatus ?? true;
    this.rapidChangeThreshold =
      options.rapidChangeThreshold ??
      (process.env.RAPID_TRUSTLINE_THRESHOLD
        ? Number(process.env.RAPID_TRUSTLINE_THRESHOLD)
        : 4);

    this.rapidChangeWindowMs =
      options.rapidChangeWindowMs ??
      (process.env.RAPID_TRUSTLINE_WINDOW_MS
        ? Number(process.env.RAPID_TRUSTLINE_WINDOW_MS)
        : 60_000);

    this.onAnomaly = options.onAnomaly;
  }

  /**
   * Evaluates a trustline modification or discovery event against organization security policies.
   */
  async evaluateTrustlineChange(params: {
    employeeId: number;
    organizationId: number;
    walletAddress: string;
    assetCode: string;
    assetIssuer: string;
    status: TrustlineStatus;
    previousStatus?: TrustlineStatus;
    now?: number;
  }): Promise<AnomalyEvent[]> {
    const {
      employeeId,
      organizationId,
      walletAddress,
      assetCode,
      assetIssuer,
      status,
      previousStatus = 'none',
    } = params;
    const now = params.now ?? Date.now();
    const anomalies: AnomalyEvent[] = [];

    const normalizedCode = assetCode.trim().toUpperCase();

    // 1. Unapproved Asset Code Detection
    if (!this.approvedAssetCodes.has(normalizedCode)) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        organizationId,
        severity: 'critical',
        reason: 'unapproved_asset_trustline',
        title: 'Unauthorized / Unapproved Asset Trustline Detected',
        description: `Wallet "${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}" modified trustline for unapproved asset code "${normalizedCode}" (Issuer: ${assetIssuer || 'native'})`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          employeeId,
          walletAddress,
          assetCode: normalizedCode,
          assetIssuer,
          status,
          approvedCodes: Array.from(this.approvedAssetCodes),
        },
      });
    }

    // 2. Unapproved Issuer Check
    if (this.approvedIssuers && assetIssuer && !this.approvedIssuers.has(assetIssuer)) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        organizationId,
        severity: 'critical',
        reason: 'unapproved_asset_issuer',
        title: 'Trustline Linked to Unrecognized Asset Issuer',
        description: `Trustline for "${normalizedCode}" uses unrecognized issuer address "${assetIssuer}"`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          employeeId,
          walletAddress,
          assetCode: normalizedCode,
          assetIssuer,
          status,
        },
      });
    }

    // 3. Workflow Bypass: direct transition from 'none' -> 'established' without 'pending'
    if (this.requirePendingStatus && previousStatus === 'none' && status === 'established') {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        organizationId,
        severity: 'warning',
        reason: 'workflow_bypass_direct_establishment',
        title: 'Trustline Established Outside Standard Org Workflow',
        description: `Trustline for "${normalizedCode}" transitioned directly from 'none' to 'established' without organization prompt/pending state`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          employeeId,
          walletAddress,
          assetCode: normalizedCode,
          previousStatus,
          currentStatus: status,
        },
      });
    }

    // 4. Rapid Trustline Churn / Modifications
    const timestamps = this.walletActivity.get(walletAddress) || [];
    const windowStart = now - this.rapidChangeWindowMs;
    const recent = timestamps.filter((t) => t >= windowStart);
    recent.push(now);
    this.walletActivity.set(walletAddress, recent);

    if (recent.length >= this.rapidChangeThreshold) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        organizationId,
        severity: 'warning',
        reason: 'rapid_trustline_churn',
        title: 'Rapid Trustline Modification Burst Detected',
        description: `Wallet "${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}" experienced ${recent.length} trustline operations within ${Math.round(this.rapidChangeWindowMs / 1000)} seconds`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          walletAddress,
          employeeId,
          modificationCount: recent.length,
          windowSeconds: Math.round(this.rapidChangeWindowMs / 1000),
          threshold: this.rapidChangeThreshold,
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

  /** Clears in-memory wallet tracking (useful in tests). */
  resetActivity(): void {
    this.walletActivity.clear();
  }
}

export const unauthorizedTrustlineChangeDetectionAgent =
  new UnauthorizedTrustlineChangeDetectionAgent();
