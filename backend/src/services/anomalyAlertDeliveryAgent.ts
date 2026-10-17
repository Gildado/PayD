/**
 * Real-time anomaly alert delivery agent (#1213).
 *
 * Shared infrastructure that takes structured anomaly events from any
 * detection agent and delivers them to configured channels (Slack,
 * email, webhook). This is the delivery layer that makes raw signals
 * actionable rather than noisy.
 *
 * Delivery is fire-and-forget per channel with configurable retry.
 */

import logger from '../utils/logger.js';

export type AlertChannelType = 'slack' | 'email' | 'webhook';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AnomalyEvent {
  id: string;
  source: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  detectedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AlertChannelConfig {
  type: AlertChannelType;
  /** Slack webhook URL, email address, or webhook URL. */
  endpoint: string;
  /** Optional secret for HMAC signing (webhook). */
  secret?: string;
  /** Minimum severity to deliver to this channel. Default: 'warning'. */
  minSeverity?: AlertSeverity;
  /** Maximum retry attempts on failure. Default: 3. */
  maxRetries?: number;
}

export interface DeliveryResult {
  channelType: AlertChannelType;
  endpoint: string;
  success: boolean;
  error?: string;
  attempts: number;
}

export interface AlertDeliveryOptions {
  channels: AlertChannelConfig[];
  /** Custom delivery function for testing. */
  deliver?: (channel: AlertChannelConfig, event: AnomalyEvent) => Promise<void>;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

function meetsMinSeverity(event: AnomalyEvent, min: AlertSeverity): boolean {
  return SEVERITY_ORDER[event.severity] >= SEVERITY_ORDER[min];
}

export class AnomalyAlertDeliveryAgent {
  private readonly channels: AlertChannelConfig[];
  private readonly deliverFn: (channel: AlertChannelConfig, event: AnomalyEvent) => Promise<void>;

  constructor(options: AlertDeliveryOptions) {
    this.channels = options.channels;
    this.deliverFn = options.deliver ?? this.defaultDeliver.bind(this);
  }

  async deliver(event: AnomalyEvent): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    for (const channel of this.channels) {
      const minSeverity = channel.minSeverity ?? 'warning';
      if (!meetsMinSeverity(event, minSeverity)) {
        continue;
      }

      const maxRetries = channel.maxRetries ?? 3;
      let attempts = 0;
      let success = false;
      let lastError: string | undefined;

      for (attempts = 1; attempts <= maxRetries; attempts++) {
        try {
          await this.deliverFn(channel, event);
          success = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          if (attempts < maxRetries) {
            await new Promise((r) => setTimeout(r, 100 * attempts));
          }
        }
      }

      results.push({
        channelType: channel.type,
        endpoint: channel.endpoint,
        success,
        error: success ? undefined : lastError,
        attempts,
      });

      if (!success) {
        logger.error(
          { channelType: channel.type, endpoint: channel.endpoint, error: lastError },
          'Alert delivery failed after retries',
        );
      }
    }

    return results;
  }

  private async defaultDeliver(channel: AlertChannelConfig, event: AnomalyEvent): Promise<void> {
    switch (channel.type) {
      case 'slack':
        await this.deliverSlack(channel, event);
        break;
      case 'email':
        await this.deliverEmail(channel, event);
        break;
      case 'webhook':
        await this.deliverWebhook(channel, event);
        break;
    }
  }

  private async deliverSlack(channel: AlertChannelConfig, event: AnomalyEvent): Promise<void> {
    const emoji = event.severity === 'critical' ? '🚨' : event.severity === 'warning' ? '⚠️' : 'ℹ️';
    const res = await fetch(channel.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${emoji} *[${event.severity.toUpperCase()}]* ${event.title}\n${event.description}\nSource: ${event.source}`,
      }),
    });
    if (!res.ok) throw new Error(`Slack delivery failed: ${res.status}`);
  }

  private async deliverEmail(channel: AlertChannelConfig, event: AnomalyEvent): Promise<void> {
    // Email delivery would integrate with the configured SMTP/email service.
    // For now, log the intent — actual SMTP wiring is environment-specific.
    logger.info(
      { to: channel.endpoint, subject: event.title, severity: event.severity },
      'Alert email queued',
    );
  }

  private async deliverWebhook(channel: AlertChannelConfig, event: AnomalyEvent): Promise<void> {
    const body = JSON.stringify(event);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (channel.secret) {
      const { createHmac } = await import('crypto');
      headers['x-signature'] = createHmac('sha256', channel.secret).update(body).digest('hex');
    }
    const res = await fetch(channel.endpoint, { method: 'POST', headers, body });
    if (!res.ok) throw new Error(`Webhook delivery failed: ${res.status}`);
  }
}
