/**
 * Notification flooding/abuse detection agent (#1209).
 *
 * Detects abnormal notification volume that could indicate abuse or a bug —
 * e.g. a user receiving hundreds of notifications in a short window, or
 * a template sending far more than its historical baseline. Emits structured
 * anomaly events consumable by downstream alerting.
 *
 * Detection logic is decoupled from notificationQueueService's plumbing so
 * it's unit-testable without a database or live endpoint.
 */

import logger from '../utils/logger.js';

export type AnomalySeverity = 'warning' | 'critical';

export interface NotificationEvent {
  notificationId: string;
  userId: string;
  templateId: string;
  channel: 'email' | 'push' | 'inapp' | 'webhook';
  timestamp: number;
  organizationId?: string;
}

export interface NotificationAnomalyEvent {
  severity: AnomalySeverity;
  reason: 'user_flood' | 'template_flood' | 'channel_abuse';
  detail: string;
  detectedAt: string;
  metadata: Record<string, unknown>;
}

export type AnomalyEventHandler = (event: NotificationAnomalyEvent) => void | Promise<void>;

export interface NotificationDetectionOptions {
  /** Notifications per user within the window that triggers a flood alert. Default: 20. */
  userFloodCountThreshold?: number;
  /** Window for user flood detection in ms. Default: 60_000 (1 min). */
  userFloodWindowMs?: number;
  /** Notifications per template within the window that triggers a flood alert. Default: 100. */
  templateFloodCountThreshold?: number;
  /** Window for template flood detection in ms. Default: 300_000 (5 min). */
  templateFloodWindowMs?: number;
  /** Notifications per channel within the window that triggers channel abuse. Default: 200. */
  channelAbuseCountThreshold?: number;
  /** Window for channel abuse detection in ms. Default: 300_000 (5 min). */
  channelAbuseWindowMs?: number;
  onAnomaly?: AnomalyEventHandler;
}

const DEFAULTS = {
  userFloodCountThreshold: 20,
  userFloodWindowMs: 60_000,
  templateFloodCountThreshold: 100,
  templateFloodWindowMs: 300_000,
  channelAbuseCountThreshold: 200,
  channelAbuseWindowMs: 300_000,
};

interface ActivityWindow {
  timestamps: number[];
}

export class NotificationFloodingDetectionAgent {
  private readonly userFloodCountThreshold: number;
  private readonly userFloodWindowMs: number;
  private readonly templateFloodCountThreshold: number;
  private readonly templateFloodWindowMs: number;
  private readonly channelAbuseCountThreshold: number;
  private readonly channelAbuseWindowMs: number;
  private readonly onAnomaly: AnomalyEventHandler;

  /** Recent notification timestamps per user. */
  private readonly userActivity = new Map<string, ActivityWindow>();
  /** Recent notification timestamps per template. */
  private readonly templateActivity = new Map<string, ActivityWindow>();
  /** Recent notification timestamps per channel. */
  private readonly channelActivity = new Map<string, ActivityWindow>();

  constructor(options: NotificationDetectionOptions = {}) {
    this.userFloodCountThreshold =
      options.userFloodCountThreshold ?? DEFAULTS.userFloodCountThreshold;
    this.userFloodWindowMs = options.userFloodWindowMs ?? DEFAULTS.userFloodWindowMs;
    this.templateFloodCountThreshold =
      options.templateFloodCountThreshold ?? DEFAULTS.templateFloodCountThreshold;
    this.templateFloodWindowMs = options.templateFloodWindowMs ?? DEFAULTS.templateFloodWindowMs;
    this.channelAbuseCountThreshold =
      options.channelAbuseCountThreshold ?? DEFAULTS.channelAbuseCountThreshold;
    this.channelAbuseWindowMs = options.channelAbuseWindowMs ?? DEFAULTS.channelAbuseWindowMs;
    this.onAnomaly =
      options.onAnomaly ?? ((event) => logger.warn({ event }, 'Notification flooding anomaly'));
  }

  private trackAndCount(map: Map<string, ActivityWindow>, key: string, now: number, windowMs: number): number {
    const window = map.get(key) ?? { timestamps: [] };
    window.timestamps.push(now);
    const cutoff = now - windowMs;
    window.timestamps = window.timestamps.filter((t) => t > cutoff);
    map.set(key, window);
    return window.timestamps.length;
  }

  /**
   * Evaluates one notification event and returns zero or more anomalies.
   */
  async evaluate(event: NotificationEvent): Promise<NotificationAnomalyEvent[]> {
    const anomalies: NotificationAnomalyEvent[] = [];
    const now = event.timestamp;
    const detectedAt = new Date(now).toISOString();

    // User flood detection
    const userCount = this.trackAndCount(this.userActivity, event.userId, now, this.userFloodWindowMs);
    if (userCount >= this.userFloodCountThreshold) {
      anomalies.push({
        severity: 'critical',
        reason: 'user_flood',
        detail: `User ${event.userId} received ${userCount} notifications in ${this.userFloodWindowMs / 1000}s`,
        detectedAt,
        metadata: {
          userId: event.userId,
          count: userCount,
          windowMs: this.userFloodWindowMs,
          threshold: this.userFloodCountThreshold,
        },
      });
    }

    // Template flood detection
    const templateCount = this.trackAndCount(
      this.templateActivity,
      event.templateId,
      now,
      this.templateFloodWindowMs,
    );
    if (templateCount >= this.templateFloodCountThreshold) {
      anomalies.push({
        severity: 'warning',
        reason: 'template_flood',
        detail: `Template ${event.templateId} sent ${templateCount} notifications in ${this.templateFloodWindowMs / 1000}s`,
        detectedAt,
        metadata: {
          templateId: event.templateId,
          count: templateCount,
          windowMs: this.templateFloodWindowMs,
          threshold: this.templateFloodCountThreshold,
        },
      });
    }

    // Channel abuse detection
    const channelCount = this.trackAndCount(
      this.channelActivity,
      event.channel,
      now,
      this.channelAbuseWindowMs,
    );
    if (channelCount >= this.channelAbuseCountThreshold) {
      anomalies.push({
        severity: 'warning',
        reason: 'channel_abuse',
        detail: `Channel ${event.channel} processed ${channelCount} notifications in ${this.channelAbuseWindowMs / 1000}s`,
        detectedAt,
        metadata: {
          channel: event.channel,
          count: channelCount,
          windowMs: this.channelAbuseWindowMs,
          threshold: this.channelAbuseCountThreshold,
        },
      });
    }

    for (const anomaly of anomalies) {
      await this.onAnomaly(anomaly);
    }

    return anomalies;
  }
}
