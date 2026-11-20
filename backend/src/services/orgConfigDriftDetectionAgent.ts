/**
 * Org-level configuration drift detection agent (#1207).
 *
 * Detects org settings changes that deviate from baseline configuration
 * from orgAuditService.ts. Evaluates each config change against a stored
 * baseline and emits structured anomaly events.
 *
 * Detection signals:
 * - `baseline_drift`: setting value differs from the recorded baseline
 * - `rapid_changes`: multiple config changes in a short window
 * - `high_risk_setting`: change to a security-critical setting
 */

import logger from '../utils/logger.js';

export type ConfigDriftAnomalyType = 'baseline_drift' | 'rapid_changes' | 'high_risk_setting';

export interface OrgConfigChange {
  organizationId: number;
  settingKey: string;
  oldValue: string | null;
  newValue: string;
  changedBy: string;
  changedAt: number;
}

export interface ConfigDriftAnomalyEvent {
  agentId: 'org_config_drift';
  anomalyType: ConfigDriftAnomalyType;
  severity: 'warning' | 'critical';
  organizationId: number;
  detail: string;
  detectedAt: string;
  metadata: Record<string, unknown>;
}

export type ConfigDriftAnomalyHandler = (event: ConfigDriftAnomalyEvent) => void | Promise<void>;

export interface OrgConfigDriftDetectionOptions {
  /** Config changes in this window that trigger rapid_changes. Default: 300_000 (5 min). */
  rapidChangeWindowMs?: number;
  /** Count threshold for rapid_changes. Default: 5. */
  rapidChangeCountThreshold?: number;
  /** Setting keys considered high-risk when changed. */
  highRiskSettings?: string[];
  /** Setting keys to track for baseline drift. Empty = track all. */
  trackedSettings?: string[];
  onAnomaly?: ConfigDriftAnomalyHandler;
}

interface OrgChangeActivity {
  timestamps: number[];
}

const DEFAULT_HIGH_RISK_SETTINGS = [
  'require_mfa',
  'password_policy',
  'session_timeout',
  'ip_allowlist',
  'webhook_secret',
  'api_key_expiry',
  'payment_limit',
  'role_permissions',
  'sso_enabled',
  'audit_retention_days',
];

const DEFAULTS = {
  rapidChangeWindowMs: 300_000,
  rapidChangeCountThreshold: 5,
};

export class OrgConfigDriftDetectionAgent {
  private readonly rapidChangeWindowMs: number;
  private readonly rapidChangeCountThreshold: number;
  private readonly highRiskSettings: Set<string>;
  private readonly trackedSettings: Set<string> | null;
  private readonly onAnomaly: ConfigDriftAnomalyHandler;

  /** Baseline config values per (org, setting). */
  private readonly baselines = new Map<string, string>();
  /** Recent change timestamps per org, for rapid_changes detection. */
  private readonly orgActivity = new Map<number, OrgChangeActivity>();

  constructor(options: OrgConfigDriftDetectionOptions = {}) {
    this.rapidChangeWindowMs = options.rapidChangeWindowMs ?? DEFAULTS.rapidChangeWindowMs;
    this.rapidChangeCountThreshold =
      options.rapidChangeCountThreshold ?? DEFAULTS.rapidChangeCountThreshold;
    this.highRiskSettings = new Set(
      options.highRiskSettings ?? DEFAULT_HIGH_RISK_SETTINGS,
    );
    this.trackedSettings = options.trackedSettings?.length
      ? new Set(options.trackedSettings)
      : null;
    this.onAnomaly =
      options.onAnomaly ??
      ((event) => logger.warn({ event }, 'Org config drift anomaly'));
  }

  /**
   * Records the baseline value for a setting. Subsequent changes to this
   * setting will be compared against this baseline.
   */
  setBaseline(organizationId: number, settingKey: string, value: string): void {
    this.baselines.set(`${organizationId}:${settingKey}`, value);
  }

  /**
   * Evaluates one config change, updating state and emitting
   * zero or more anomaly events.
   */
  async evaluate(change: OrgConfigChange): Promise<ConfigDriftAnomalyEvent[]> {
    // Skip settings not in the tracked list (if one is configured)
    if (this.trackedSettings && !this.trackedSettings.has(change.settingKey)) {
      return [];
    }

    const anomalies: ConfigDriftAnomalyEvent[] = [];
    const now = Date.now();
    const detectedAt = new Date(now).toISOString();
    const baselineKey = `${change.organizationId}:${change.settingKey}`;

    // 1. Baseline drift detection
    const baseline = this.baselines.get(baselineKey);
    if (baseline !== undefined && baseline !== change.newValue) {
      anomalies.push({
        agentId: 'org_config_drift',
        anomalyType: 'baseline_drift',
        severity: 'warning',
        organizationId: change.organizationId,
        detail: `Setting "${change.settingKey}" changed from baseline "${baseline}" to "${change.newValue}"`,
        detectedAt,
        metadata: {
          settingKey: change.settingKey,
          baselineValue: baseline,
          newValue: change.newValue,
          changedBy: change.changedBy,
        },
      });
    }

    // Update baseline to the new value (so we track the latest expected state)
    this.baselines.set(baselineKey, change.newValue);

    // 2. Rapid changes detection
    let activity = this.orgActivity.get(change.organizationId);
    if (!activity) {
      activity = { timestamps: [] };
      this.orgActivity.set(change.organizationId, activity);
    }
    activity.timestamps.push(change.changedAt);
    activity.timestamps = activity.timestamps.filter(
      (ts) => now - ts < this.rapidChangeWindowMs,
    );

    if (activity.timestamps.length >= this.rapidChangeCountThreshold) {
      anomalies.push({
        agentId: 'org_config_drift',
        anomalyType: 'rapid_changes',
        severity: 'critical',
        organizationId: change.organizationId,
        detail: `${activity.timestamps.length} config changes in ${this.rapidChangeWindowMs}ms exceeds threshold of ${this.rapidChangeCountThreshold}`,
        detectedAt,
        metadata: { count: activity.timestamps.length, windowMs: this.rapidChangeWindowMs },
      });
    }

    // 3. High-risk setting detection
    if (this.highRiskSettings.has(change.settingKey)) {
      anomalies.push({
        agentId: 'org_config_drift',
        anomalyType: 'high_risk_setting',
        severity: 'warning',
        organizationId: change.organizationId,
        detail: `High-risk setting "${change.settingKey}" changed from "${change.oldValue}" to "${change.newValue}"`,
        detectedAt,
        metadata: {
          settingKey: change.settingKey,
          oldValue: change.oldValue,
          newValue: change.newValue,
          changedBy: change.changedBy,
        },
      });
    }

    for (const anomaly of anomalies) {
      await this.onAnomaly(anomaly);
    }

    return anomalies;
  }
}
