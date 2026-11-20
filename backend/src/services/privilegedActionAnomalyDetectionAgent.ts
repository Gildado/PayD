/**
 * Privileged action anomaly detection agent (#1206).
 *
 * Detects clusters of privileged admin actions outside normal patterns
 * from adminAuditService.ts. Evaluates each admin action against
 * configurable thresholds and emits structured anomaly events.
 *
 * Detection signals:
 * - `burst_cluster`: unusually high volume of admin actions in a short window
 * - `unusual_hour`: admin action outside expected working hours
 * - `high_risk_action`: sensitive action (role change, contract upgrade, etc.)
 */

import logger from '../utils/logger.js';

export type PrivilegedAnomalyType = 'burst_cluster' | 'unusual_hour' | 'high_risk_action';

export interface AdminAction {
  adminUserId: string;
  organizationId: number;
  actionType: string;
  targetType: string;
  ipAddress: string;
  performedAt: number;
}

export interface PrivilegedAnomalyEvent {
  agentId: 'privileged_action_anomaly';
  anomalyType: PrivilegedAnomalyType;
  severity: 'warning' | 'critical';
  adminUserId: string;
  organizationId: number;
  detail: string;
  detectedAt: string;
  metadata: Record<string, unknown>;
}

export type PrivilegedAnomalyHandler = (event: PrivilegedAnomalyEvent) => void | Promise<void>;

export interface PrivilegedActionAnomalyOptions {
  /** Admin actions in this window that trigger burst detection. Default: 60_000 (1 min). */
  burstWindowMs?: number;
  /** Count threshold for burst detection. Default: 5. */
  burstCountThreshold?: number;
  /** Expected working hours (UTC) — actions outside trigger unusual_hour. Default: [6, 22]. */
  expectedHours?: [number, number];
  /** Action types considered high-risk. */
  highRiskActions?: string[];
  /** Whether to enable hour-based detection. Default: true. */
  enableHourDetection?: boolean;
  onAnomaly?: PrivilegedAnomalyHandler;
}

interface AdminActivity {
  timestamps: number[];
}

const DEFAULT_HIGH_RISK_ACTIONS = [
  'role_change',
  'contract_upgrade',
  'key_rotation',
  'permission_grant',
  'funds_withdrawal',
  'user_ban',
  'settings_update',
  'api_key_create',
];

const DEFAULTS = {
  burstWindowMs: 60_000,
  burstCountThreshold: 5,
  expectedHours: [6, 22] as [number, number],
  enableHourDetection: true,
};

export class PrivilegedActionAnomalyDetectionAgent {
  private readonly burstWindowMs: number;
  private readonly burstCountThreshold: number;
  private readonly expectedHours: [number, number];
  private readonly highRiskActions: Set<string>;
  private readonly enableHourDetection: boolean;
  private readonly onAnomaly: PrivilegedAnomalyHandler;

  /** Recent action timestamps per admin, for burst detection. */
  private readonly adminActivity = new Map<string, AdminActivity>();

  constructor(options: PrivilegedActionAnomalyOptions = {}) {
    this.burstWindowMs = options.burstWindowMs ?? DEFAULTS.burstWindowMs;
    this.burstCountThreshold = options.burstCountThreshold ?? DEFAULTS.burstCountThreshold;
    this.expectedHours = options.expectedHours ?? DEFAULTS.expectedHours;
    this.highRiskActions = new Set(
      options.highRiskActions ?? DEFAULT_HIGH_RISK_ACTIONS,
    );
    this.enableHourDetection = options.enableHourDetection ?? DEFAULTS.enableHourDetection;
    this.onAnomaly =
      options.onAnomaly ??
      ((event) => logger.warn({ event }, 'Privileged action anomaly detected'));
  }

  /**
   * Evaluates one admin action, updating rolling state and emitting
   * zero or more anomaly events.
   */
  async evaluate(action: AdminAction): Promise<PrivilegedAnomalyEvent[]> {
    const anomalies: PrivilegedAnomalyEvent[] = [];
    const now = Date.now();
    const detectedAt = new Date(now).toISOString();

    // 1. Burst cluster detection
    let activity = this.adminActivity.get(action.adminUserId);
    if (!activity) {
      activity = { timestamps: [] };
      this.adminActivity.set(action.adminUserId, activity);
    }
    activity.timestamps.push(action.performedAt);
    activity.timestamps = activity.timestamps.filter(
      (ts) => now - ts < this.burstWindowMs,
    );

    if (activity.timestamps.length >= this.burstCountThreshold) {
      anomalies.push({
        agentId: 'privileged_action_anomaly',
        anomalyType: 'burst_cluster',
        severity: 'critical',
        adminUserId: action.adminUserId,
        organizationId: action.organizationId,
        detail: `${activity.timestamps.length} admin actions in ${this.burstWindowMs}ms exceeds threshold of ${this.burstCountThreshold}`,
        detectedAt,
        metadata: {
          count: activity.timestamps.length,
          windowMs: this.burstWindowMs,
          actionTypes: activity.timestamps.length,
        },
      });
    }

    // 2. Unusual hour detection
    if (this.enableHourDetection) {
      const hour = new Date(action.performedAt).getUTCHours();
      const [startHour, endHour] = this.expectedHours;

      if (hour < startHour || hour >= endHour) {
        anomalies.push({
          agentId: 'privileged_action_anomaly',
          anomalyType: 'unusual_hour',
          severity: 'warning',
          adminUserId: action.adminUserId,
          organizationId: action.organizationId,
          detail: `Admin action "${action.actionType}" at ${hour}:00 UTC outside expected hours ${startHour}:00-${endHour}:00`,
          detectedAt,
          metadata: { hour, expectedHours: this.expectedHours, actionType: action.actionType },
        });
      }
    }

    // 3. High-risk action detection
    if (this.highRiskActions.has(action.actionType)) {
      anomalies.push({
        agentId: 'privileged_action_anomaly',
        anomalyType: 'high_risk_action',
        severity: 'warning',
        adminUserId: action.adminUserId,
        organizationId: action.organizationId,
        detail: `High-risk admin action "${action.actionType}" on ${action.targetType}`,
        detectedAt,
        metadata: { actionType: action.actionType, targetType: action.targetType, ipAddress: action.ipAddress },
      });
    }

    for (const anomaly of anomalies) {
      await this.onAnomaly(anomaly);
    }

    return anomalies;
  }
}
