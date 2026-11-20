/**
 * Freeze Pattern Anomaly Detection Agent.
 *
 * Detects abnormal frequency of freeze/unfreeze actions on one account and
 * clustering of freeze actions across accounts for the same asset.
 *
 * Resolves Issue #1196.
 */

import { randomUUID } from 'node:crypto';
import type { AnomalyEvent, AnomalyEventHandler } from '../types/anomalyEvent.js';
import type { FreezeLogRecord } from './freezeService.js';

export interface FreezePatternOptions {
  /** Sliding window length in milliseconds. Default: 3,600,000 (1 hour). */
  windowMs?: number;
  /** Freeze/unfreeze actions on one account and asset within the window that count as abnormal. Default: 5. */
  maxActionsPerAccountPerWindow?: number;
  /** Distinct accounts acted on for one asset within the window that count as clustering. Default: 3. */
  maxAccountsPerAssetPerWindow?: number;
  /** Optional callback or event handler for downstream alerting. */
  onAnomaly?: AnomalyEventHandler;
}

function readNumberEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return process.env[name] !== undefined && Number.isFinite(parsed) ? parsed : fallback;
}

function groupLogs(
  logs: FreezeLogRecord[],
  keyOf: (log: FreezeLogRecord) => string
): Map<string, FreezeLogRecord[]> {
  const groups = new Map<string, FreezeLogRecord[]>();
  for (const log of logs) {
    const key = keyOf(log);
    const group = groups.get(key);
    if (group) {
      group.push(log);
    } else {
      groups.set(key, [log]);
    }
  }
  return groups;
}

export class FreezePatternAnomalyDetectionAgent {
  readonly id = 'freeze-pattern-anomaly-detection';
  private readonly windowMs: number;
  private readonly maxActionsPerAccountPerWindow: number;
  private readonly maxAccountsPerAssetPerWindow: number;
  private readonly onAnomaly?: AnomalyEventHandler;

  constructor(options: FreezePatternOptions = {}) {
    this.windowMs = options.windowMs ?? readNumberEnv('FREEZE_ANOMALY_WINDOW_MS', 3_600_000);
    this.maxActionsPerAccountPerWindow =
      options.maxActionsPerAccountPerWindow ?? readNumberEnv('FREEZE_ANOMALY_MAX_ACTIONS', 5);
    this.maxAccountsPerAssetPerWindow =
      options.maxAccountsPerAssetPerWindow ?? readNumberEnv('FREEZE_ANOMALY_MAX_ACCOUNTS', 3);
    this.onAnomaly = options.onAnomaly;
  }

  /**
   * Evaluates freeze-log records for frequency and clustering anomalies inside the window.
   */
  async evaluateLogs(params: { logs: FreezeLogRecord[]; now?: number }): Promise<AnomalyEvent[]> {
    const now = params.now ?? Date.now();
    const windowStart = now - this.windowMs;
    const recent = params.logs.filter((log) => {
      const createdAt = new Date(log.created_at).getTime();
      return createdAt >= windowStart && createdAt <= now;
    });
    const anomalies: AnomalyEvent[] = [];

    const accountGroups = groupLogs(
      recent,
      (log) => `${log.target_account}|${log.asset_code}|${log.asset_issuer}`
    );
    for (const logs of accountGroups.values()) {
      if (logs.length < this.maxActionsPerAccountPerWindow) {
        continue;
      }
      const { target_account, asset_code, asset_issuer } = logs[0];
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        severity: 'warning',
        reason: 'freeze_action_frequency_spike',
        title: 'Abnormal Freeze Action Frequency',
        description: `Account ${target_account} had ${logs.length} freeze/unfreeze actions for ${asset_code} within ${this.windowMs} ms`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          targetAccount: target_account,
          assetCode: asset_code,
          assetIssuer: asset_issuer,
          actionCount: logs.length,
          threshold: this.maxActionsPerAccountPerWindow,
          windowMs: this.windowMs,
        },
      });
    }

    const assetGroups = groupLogs(recent, (log) => `${log.asset_code}|${log.asset_issuer}`);
    for (const logs of assetGroups.values()) {
      const accounts = new Set(logs.map((log) => log.target_account));
      if (accounts.size < this.maxAccountsPerAssetPerWindow) {
        continue;
      }
      const { asset_code, asset_issuer } = logs[0];
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        severity: 'critical',
        reason: 'freeze_account_clustering',
        title: 'Freeze Clustering Across Accounts',
        description: `${accounts.size} distinct accounts were frozen or unfrozen for ${asset_code} within ${this.windowMs} ms`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          assetCode: asset_code,
          assetIssuer: asset_issuer,
          distinctAccounts: accounts.size,
          threshold: this.maxAccountsPerAssetPerWindow,
          windowMs: this.windowMs,
        },
      });
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

export const freezePatternAnomalyDetectionAgent = new FreezePatternAnomalyDetectionAgent();
