/**
 * Email Delivery Tracking Service (#1050)
 * 
 * Implements email delivery tracking, open/click tracking, and bounce handling
 * for all transactional emails (notifications, alerts, reports).
 * 
 * Features:
 * - Webhook handlers for email provider delivery events (SendGrid/Resend)
 * - Delivery status tracking per email
 * - Bounce categorization (hard/soft)
 * - Automatic invalid email flagging after hard bounce
 * - Delivery rate metrics for Prometheus
 */

import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import { Counter, Gauge } from 'prom-client';

// Email delivery status
export enum EmailDeliveryStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  OPENED = 'opened',
  CLICKED = 'clicked',
  BOUNCED = 'bounced',
  FAILED = 'failed',
}

// Bounce types
export enum BounceType {
  HARD = 'hard',
  SOFT = 'soft',
}

// Prometheus Metrics
export const emailDeliveryCounter = new Counter({
  name: 'payd_email_delivery_total',
  help: 'Total number of emails by delivery status',
  labelNames: ['status', 'provider'],
});

export const emailBounceCounter = new Counter({
  name: 'payd_email_bounces_total',
  help: 'Total number of email bounces',
  labelNames: ['bounce_type', 'provider'],
});

export const emailDeliveryRateGauge = new Gauge({
  name: 'payd_email_delivery_rate',
  help: 'Email delivery rate (delivered / sent)',
  labelNames: ['provider'],
});

export const emailBounceRateGauge = new Gauge({
  name: 'payd_email_bounce_rate',
  help: 'Email bounce rate (bounced / sent)',
  labelNames: ['provider'],
});

interface EmailDeliveryEvent {
  messageId: string;
  email: string;
  status: EmailDeliveryStatus;
  provider: 'sendgrid' | 'resend';
  bounceType?: BounceType;
  bounceReason?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface EmailDeliveryStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  deliveryRate: number;
  bounceRate: number;
}

export class EmailDeliveryTrackingService {
  private static instance: EmailDeliveryTrackingService;

  // Soft bounce retry configuration
  private readonly SOFT_BOUNCE_MAX_RETRIES = 3;
  private readonly SOFT_BOUNCE_RETRY_DELAY_MS = [
    5 * 60 * 1000,  // 5 minutes
    30 * 60 * 1000, // 30 minutes
    2 * 60 * 60 * 1000, // 2 hours
  ];

  private constructor() {
    // Initialize periodic metrics update
    setInterval(() => this.updateDeliveryMetrics(), 60000); // Every minute
  }

  static getInstance(): EmailDeliveryTrackingService {
    if (!EmailDeliveryTrackingService.instance) {
      EmailDeliveryTrackingService.instance = new EmailDeliveryTrackingService();
    }
    return EmailDeliveryTrackingService.instance;
  }

  /**
   * Track email sent event
   */
  async trackEmailSent(
    messageId: string,
    email: string,
    provider: 'sendgrid' | 'resend',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO email_delivery_logs (message_id, email, status, provider, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (message_id) DO UPDATE SET updated_at = NOW()`,
        [messageId, email, EmailDeliveryStatus.SENT, provider, JSON.stringify(metadata || {})]
      );

      emailDeliveryCounter.labels(EmailDeliveryStatus.SENT, provider).inc();

      logger.info('Email sent tracked', {
        messageId,
        email,
        provider,
      });
    } catch (error) {
      logger.error('Failed to track email sent', { error, messageId, email });
    }
  }

  /**
   * Process email delivery webhook event
   */
  async processDeliveryEvent(event: EmailDeliveryEvent): Promise<void> {
    try {
      // Update delivery status in database
      await pool.query(
        `UPDATE email_delivery_logs 
         SET status = $1, bounce_type = $2, bounce_reason = $3, metadata = metadata || $4, updated_at = NOW()
         WHERE message_id = $5`,
        [
          event.status,
          event.bounceType || null,
          event.bounceReason || null,
          JSON.stringify({ ...event.metadata, last_event_at: event.timestamp }),
          event.messageId,
        ]
      );

      // Update metrics
      emailDeliveryCounter.labels(event.status, event.provider).inc();

      // Handle bounces
      if (event.status === EmailDeliveryStatus.BOUNCED) {
        await this.handleBounce(event);
      }

      logger.info('Email delivery event processed', {
        messageId: event.messageId,
        status: event.status,
        provider: event.provider,
      });
    } catch (error) {
      logger.error('Failed to process delivery event', { error, event });
    }
  }

  /**
   * Handle email bounce
   */
  private async handleBounce(event: EmailDeliveryEvent): Promise<void> {
    const bounceType = event.bounceType || BounceType.SOFT;

    emailBounceCounter.labels(bounceType, event.provider).inc();

    if (bounceType === BounceType.HARD) {
      // Hard bounce: mark email as invalid permanently
      await this.flagEmailAsInvalid(event.email, event.bounceReason || 'Hard bounce');

      logger.warn('Email flagged as invalid due to hard bounce', {
        email: event.email,
        reason: event.bounceReason,
        messageId: event.messageId,
      });
    } else {
      // Soft bounce: schedule retry with backoff
      await this.scheduleSoftBounceRetry(event);

      logger.info('Soft bounce detected, retry scheduled', {
        email: event.email,
        reason: event.bounceReason,
        messageId: event.messageId,
      });
    }
  }

  /**
   * Flag email address as invalid
   */
  private async flagEmailAsInvalid(email: string, reason: string): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO invalid_emails (email, reason, flagged_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (email) DO UPDATE SET reason = $2, flagged_at = NOW()`,
        [email, reason]
      );

      // Also update employee records if applicable
      await pool.query(
        `UPDATE employees 
         SET email_status = 'invalid', email_invalid_reason = $2, updated_at = NOW()
         WHERE email = $1`,
        [email, reason]
      );

      logger.warn('Email address flagged as invalid', { email, reason });
    } catch (error) {
      logger.error('Failed to flag email as invalid', { error, email });
    }
  }

  /**
   * Schedule retry for soft bounce
   */
  private async scheduleSoftBounceRetry(event: EmailDeliveryEvent): Promise<void> {
    try {
      // Get retry count
      const retryResult = await pool.query(
        'SELECT retry_count FROM email_delivery_logs WHERE message_id = $1',
        [event.messageId]
      );

      const retryCount = retryResult.rows[0]?.retry_count || 0;

      if (retryCount >= this.SOFT_BOUNCE_MAX_RETRIES) {
        logger.warn('Max soft bounce retries exceeded, treating as hard bounce', {
          messageId: event.messageId,
          email: event.email,
          retries: retryCount,
        });

        await this.flagEmailAsInvalid(event.email, `Soft bounce retry limit exceeded (${retryCount} attempts)`);
        return;
      }

      // Calculate retry delay
      const delayMs = this.SOFT_BOUNCE_RETRY_DELAY_MS[retryCount] || this.SOFT_BOUNCE_RETRY_DELAY_MS[this.SOFT_BOUNCE_RETRY_DELAY_MS.length - 1];
      const retryAt = new Date(Date.now() + delayMs);

      // Update retry schedule
      await pool.query(
        `UPDATE email_delivery_logs 
         SET retry_count = retry_count + 1, retry_scheduled_at = $1, updated_at = NOW()
         WHERE message_id = $2`,
        [retryAt, event.messageId]
      );

      logger.info('Soft bounce retry scheduled', {
        messageId: event.messageId,
        email: event.email,
        retryCount: retryCount + 1,
        retryAt: retryAt.toISOString(),
      });
    } catch (error) {
      logger.error('Failed to schedule soft bounce retry', { error, event });
    }
  }

  /**
   * Check if email is valid (not flagged as invalid)
   */
  async isEmailValid(email: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT 1 FROM invalid_emails WHERE email = $1',
        [email]
      );
      return result.rows.length === 0;
    } catch (error) {
      logger.error('Failed to check email validity', { error, email });
      return true; // Fail open to not block email sending
    }
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(provider?: 'sendgrid' | 'resend'): Promise<EmailDeliveryStats> {
    try {
      const query = provider
        ? 'SELECT status, COUNT(*) as count FROM email_delivery_logs WHERE provider = $1 GROUP BY status'
        : 'SELECT status, COUNT(*) as count FROM email_delivery_logs GROUP BY status';

      const params = provider ? [provider] : [];
      const result = await pool.query(query, params);

      const stats: EmailDeliveryStats = {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        failed: 0,
        deliveryRate: 0,
        bounceRate: 0,
      };

      result.rows.forEach((row) => {
        const count = parseInt(row.count);
        switch (row.status) {
          case EmailDeliveryStatus.SENT:
            stats.sent = count;
            break;
          case EmailDeliveryStatus.DELIVERED:
            stats.delivered = count;
            break;
          case EmailDeliveryStatus.OPENED:
            stats.opened = count;
            break;
          case EmailDeliveryStatus.CLICKED:
            stats.clicked = count;
            break;
          case EmailDeliveryStatus.BOUNCED:
            stats.bounced = count;
            break;
          case EmailDeliveryStatus.FAILED:
            stats.failed = count;
            break;
        }
      });

      if (stats.sent > 0) {
        stats.deliveryRate = (stats.delivered / stats.sent) * 100;
        stats.bounceRate = (stats.bounced / stats.sent) * 100;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get delivery stats', { error });
      throw error;
    }
  }

  /**
   * Get delivery status by message ID (notification ID)
   */
  async getDeliveryStatusByMessageId(messageId: string): Promise<any | null> {
    try {
      const result = await pool.query(
        `SELECT message_id, email, status, provider, bounce_type, bounce_reason, retry_count, metadata, created_at, updated_at
         FROM email_delivery_logs
         WHERE message_id = $1`,
        [messageId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get delivery status by message ID', { error, messageId });
      throw error;
    }
  }

  /**
   * Get email activity for a specific employee
   */
  async getEmailActivity(email: string, limit = 50): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT message_id, status, provider, bounce_type, bounce_reason, retry_count, created_at, updated_at
         FROM email_delivery_logs
         WHERE email = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [email, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get email activity', { error, email });
      throw error;
    }
  }

  /**
   * Update delivery metrics for Prometheus
   */
  private async updateDeliveryMetrics(): Promise<void> {
    try {
      const providers: Array<'sendgrid' | 'resend'> = ['sendgrid', 'resend'];

      for (const provider of providers) {
        const stats = await this.getDeliveryStats(provider);

        emailDeliveryRateGauge.labels(provider).set(stats.deliveryRate);
        emailBounceRateGauge.labels(provider).set(stats.bounceRate);
      }
    } catch (error) {
      logger.error('Failed to update delivery metrics', { error });
    }
  }
}

export const emailDeliveryTracking = EmailDeliveryTrackingService.getInstance();
