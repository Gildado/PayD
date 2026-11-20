/**
 * Webhook Delivery Health Report Agent
 *
 * Generates a report on webhook delivery success rates and recurring failure patterns,
 * sourcing data from the webhook_delivery_logs table via WebhookService patterns.
 *
 * Output schema:
 *   - summary: total deliveries, success rate, failure rate, average attempts
 *   - byEventType: success rate breakdown per event type
 *   - bySubscription: success rate breakdown per subscription/endpoint
 *   - failurePatterns: common error messages and their frequencies
 *   - recentFailures: last N failure records with error details
 *   - historicalTrends: daily success rates over time period
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface WebhookDeliveryHealthFilters {
  organizationId: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface EventTypeBreakdown {
  eventType: string;
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  avgAttempts: number;
}

export interface SubscriptionBreakdown {
  subscriptionId: string;
  url: string;
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  avgAttempts: number;
  lastDelivery: Date | null;
}

export interface FailurePattern {
  errorMessage: string;
  count: number;
  percentage: number;
  exampleSubscriptionId: string;
  exampleEventType: string;
  lastOccurred: Date;
}

export interface FailureRecord {
  id: number;
  subscriptionId: string;
  eventType: string;
  errorMessage: string;
  attemptNumber: number;
  deliveredAt: Date;
}

export interface DailyTrend {
  date: string;
  total: number;
  successful: number;
  failed: number;
  successRate: number;
}

export interface WebhookDeliveryHealthReport {
  summary: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    successRate: number;
    failureRate: number;
    avgAttempts: number;
    timePeriod: {
      start: string;
      end: string;
    };
  };
  byEventType: EventTypeBreakdown[];
  bySubscription: SubscriptionBreakdown[];
  failurePatterns: FailurePattern[];
  recentFailures: FailureRecord[];
  historicalTrends: DailyTrend[];
}

export class WebhookDeliveryHealthReportAgent implements IReportAgent {
  id = 'webhook-delivery-health';
  name = 'Webhook Delivery Health Report';
  description = 'Reports on webhook delivery success rates and recurring failure patterns';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as WebhookDeliveryHealthFilters | undefined;
    const organizationId = f?.organizationId ?? 0;
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const startDate = f?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = f?.endDate || new Date().toISOString().split('T')[0];
    const failureLimit = f?.limit ?? 20;

    const conditions = ['ws.organization_id = $1', 'wd.delivered_at >= $2', 'wd.delivered_at <= $3'];
    const params: any[] = [organizationId, `${startDate} 00:00:00`, `${endDate} 23:59:59`];

    const where = conditions.join(' AND ');

    // Get total deliveries and success rate
    const summaryResult = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total_deliveries,
        COUNT(CASE WHEN wd.response_status BETWEEN 200 AND 299 THEN 1 END)::int AS successful_deliveries,
        COUNT(CASE WHEN wd.response_status IS NULL OR wd.response_status < 200 OR wd.response_status >= 300 THEN 1 END)::int AS failed_deliveries,
        COALESCE(AVG(wd.attempt_number), 0) AS avg_attempts
      FROM webhook_delivery_logs wd
      JOIN webhook_subscriptions ws ON wd.subscription_id = ws.id
      WHERE ${where}`,
      params
    );

    const total = summaryResult.rows[0]?.total_deliveries || 0;
    const successful = summaryResult.rows[0]?.successful_deliveries || 0;
    const failed = summaryResult.rows[0]?.failed_deliveries || 0;
    const avgAttempts = parseFloat(summaryResult.rows[0]?.avg_attempts || '0');
    const successRate = total > 0 ? Math.round((successful / total) * 10000) / 100 : 0;
    const failureRate = total > 0 ? Math.round((failed / total) * 10000) / 100 : 0;

    // Breakdown by event type
    const eventTypeResult = await this.pool.query(
      `SELECT
        wd.event_type,
        COUNT(*)::int AS total,
        COUNT(CASE WHEN wd.response_status BETWEEN 200 AND 299 THEN 1 END)::int AS successful,
        COUNT(CASE WHEN wd.response_status IS NULL OR wd.response_status < 200 OR wd.response_status >= 300 THEN 1 END)::int AS failed,
        COALESCE(AVG(wd.attempt_number), 0) AS avg_attempts
      FROM webhook_delivery_logs wd
      JOIN webhook_subscriptions ws ON wd.subscription_id = ws.id
      WHERE ${where}
      GROUP BY wd.event_type
      ORDER BY total DESC`,
      params
    );

    const byEventType: EventTypeBreakdown[] = eventTypeResult.rows.map((row) => {
      const eventTotal = row.total;
      const eventSuccessful = row.successful;
      return {
        eventType: row.event_type,
        total: eventTotal,
        successful: eventSuccessful,
        failed: row.failed,
        successRate: eventTotal > 0 ? Math.round((eventSuccessful / eventTotal) * 10000) / 100 : 0,
        avgAttempts: parseFloat(row.avg_attempts),
      };
    });

    // Breakdown by subscription
    const subscriptionResult = await this.pool.query(
      `SELECT
        wd.subscription_id,
        ws.url,
        COUNT(*)::int AS total,
        COUNT(CASE WHEN wd.response_status BETWEEN 200 AND 299 THEN 1 END)::int AS successful,
        COUNT(CASE WHEN wd.response_status IS NULL OR wd.response_status < 200 OR wd.response_status >= 300 THEN 1 END)::int AS failed,
        COALESCE(AVG(wd.attempt_number), 0) AS avg_attempts,
        MAX(wd.delivered_at) AS last_delivery
      FROM webhook_delivery_logs wd
      JOIN webhook_subscriptions ws ON wd.subscription_id = ws.id
      WHERE ${where}
      GROUP BY wd.subscription_id, ws.url
      ORDER BY total DESC`,
      params
    );

    const bySubscription: SubscriptionBreakdown[] = subscriptionResult.rows.map((row) => {
      const subTotal = row.total;
      const subSuccessful = row.successful;
      return {
        subscriptionId: row.subscription_id,
        url: row.url,
        total: subTotal,
        successful: subSuccessful,
        failed: row.failed,
        successRate: subTotal > 0 ? Math.round((subSuccessful / subTotal) * 10000) / 100 : 0,
        avgAttempts: parseFloat(row.avg_attempts),
        lastDelivery: row.last_delivery,
      };
    });

    // Failure patterns (common error messages)
    const failurePatternResult = await this.pool.query(
      `SELECT
        wd.error_message,
        COUNT(*)::int AS count,
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() AS percentage,
        MAX(wd.subscription_id) AS example_subscription_id,
        MAX(wd.event_type) AS example_event_type,
        MAX(wd.delivered_at) AS last_occurred
      FROM webhook_delivery_logs wd
      JOIN webhook_subscriptions ws ON wd.subscription_id = ws.id
      WHERE ${where} AND (wd.response_status IS NULL OR wd.response_status < 200 OR wd.response_status >= 300)
        AND wd.error_message IS NOT NULL
      GROUP BY wd.error_message
      ORDER BY count DESC
      LIMIT 10`,
      params
    );

    const failurePatterns: FailurePattern[] = failurePatternResult.rows.map((row) => ({
      errorMessage: row.error_message,
      count: row.count,
      percentage: Math.round(row.percentage * 100) / 100,
      exampleSubscriptionId: row.example_subscription_id,
      exampleEventType: row.example_event_type,
      lastOccurred: row.last_occurred,
    }));

    // Recent failures
    const recentFailuresResult = await this.pool.query(
      `SELECT
        wd.id,
        wd.subscription_id,
        wd.event_type,
        wd.error_message,
        wd.attempt_number,
        wd.delivered_at
      FROM webhook_delivery_logs wd
      JOIN webhook_subscriptions ws ON wd.subscription_id = ws.id
      WHERE ${where} AND (wd.response_status IS NULL OR wd.response_status < 200 OR wd.response_status >= 300)
      ORDER BY wd.delivered_at DESC
      LIMIT $${params.length + 1}`,
      [...params, failureLimit]
    );

    const recentFailures: FailureRecord[] = recentFailuresResult.rows.map((row) => ({
      id: row.id,
      subscriptionId: row.subscription_id,
      eventType: row.event_type,
      errorMessage: row.error_message,
      attemptNumber: row.attempt_number,
      deliveredAt: row.delivered_at,
    }));

    // Historical trends (daily success rates)
    const trendsResult = await this.pool.query(
      `SELECT
        DATE(wd.delivered_at) AS date,
        COUNT(*)::int AS total,
        COUNT(CASE WHEN wd.response_status BETWEEN 200 AND 299 THEN 1 END)::int AS successful,
        COUNT(CASE WHEN wd.response_status IS NULL OR wd.response_status < 200 OR wd.response_status >= 300 THEN 1 END)::int AS failed
      FROM webhook_delivery_logs wd
      JOIN webhook_subscriptions ws ON wd.subscription_id = ws.id
      WHERE ${where}
      GROUP BY DATE(wd.delivered_at)
      ORDER BY date`,
      params
    );

    const historicalTrends: DailyTrend[] = trendsResult.rows.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      total: row.total,
      successful: row.successful,
      failed: row.failed,
      successRate: row.total > 0 ? Math.round((row.successful / row.total) * 10000) / 100 : 0,
    }));

    const report: WebhookDeliveryHealthReport = {
      summary: {
        totalDeliveries: total,
        successfulDeliveries: successful,
        failedDeliveries: failed,
        successRate,
        failureRate,
        avgAttempts,
        timePeriod: {
          start: startDate,
          end: endDate,
        },
      },
      byEventType,
      bySubscription,
      failurePatterns,
      recentFailures,
      historicalTrends,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: total,
        processedRecords: total,
        failedRecords: failed,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'webhook-delivery-health',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}