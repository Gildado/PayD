/**
 * Notification Engagement Report Agent (#1308)
 *
 * Generates a report on notification open/click engagement across channels
 * (email, push), sourcing data from the notifications table via
 * NotificationTrackingService patterns.
 *
 * Output schema:
 *   - summary: total, sent, failed, pending counts; delivery rate; by-type breakdown
 *   - byEmployee: per-employee notification stats
 *   - recentFailures: last N failure records with error messages
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface NotificationEngagementFilters {
  organizationId: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface NotificationTypeBreakdown {
  type: 'email' | 'push';
  total: number;
  sent: number;
  failed: number;
  pending: number;
  deliveryRate: number;
}

export interface EmployeeNotificationStats {
  employeeId: number;
  total: number;
  sent: number;
  failed: number;
  deliveryRate: number;
}

export interface NotificationFailureRecord {
  id: number;
  transactionId: number;
  employeeId: number;
  notificationType: 'email' | 'push';
  errorMessage: string | null;
  createdAt: Date;
}

export interface NotificationEngagementReport {
  summary: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    deliveryRate: number;
    byType: NotificationTypeBreakdown[];
  };
  byEmployee: EmployeeNotificationStats[];
  recentFailures: NotificationFailureRecord[];
}

export class NotificationEngagementReportAgent implements IReportAgent {
  id = 'notification-engagement';
  name = 'Notification Engagement Report';
  description = 'Reports on notification delivery engagement across email and push channels';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as NotificationEngagementFilters | undefined;
    const organizationId = f?.organizationId ?? 0;
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const startDate = f?.startDate;
    const endDate = f?.endDate;
    const failureLimit = f?.limit ?? 10;

    const conditions = ['organization_id = $1'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const where = conditions.join(' AND ');

    // Aggregate totals and by-type breakdown
    const summaryResult = await this.pool.query(
      `SELECT
        notification_type,
        status,
        COUNT(*)::int AS count
      FROM notifications
      WHERE ${where}
      GROUP BY notification_type, status`,
      params
    );

    const byTypeMap = new Map<string, { sent: number; failed: number; pending: number }>();
    let total = 0;
    let sent = 0;
    let failed = 0;
    let pending = 0;

    for (const row of summaryResult.rows) {
      const t = row.notification_type as string;
      const s = row.status as string;
      const c = row.count as number;
      total += c;

      if (!byTypeMap.has(t)) {
        byTypeMap.set(t, { sent: 0, failed: 0, pending: 0 });
      }
      const bucket = byTypeMap.get(t)!;
      if (s === 'sent') { sent += c; bucket.sent += c; }
      else if (s === 'failed') { failed += c; bucket.failed += c; }
      else if (s === 'pending') { pending += c; bucket.pending += c; }
    }

    const byType: NotificationTypeBreakdown[] = [];
    for (const [type, counts] of byTypeMap) {
      const typeTotal = counts.sent + counts.failed + counts.pending;
      byType.push({
        type: type as 'email' | 'push',
        total: typeTotal,
        sent: counts.sent,
        failed: counts.failed,
        pending: counts.pending,
        deliveryRate: typeTotal > 0 ? Math.round((counts.sent / typeTotal) * 10000) / 100 : 0,
      });
    }

    // Per-employee stats
    const empResult = await this.pool.query(
      `SELECT
        employee_id,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
      FROM notifications
      WHERE ${where}
      GROUP BY employee_id
      ORDER BY total DESC`,
      params
    );

    const byEmployee: EmployeeNotificationStats[] = empResult.rows.map((row) => ({
      employeeId: row.employee_id,
      total: row.total,
      sent: row.sent,
      failed: row.failed,
      deliveryRate: row.total > 0 ? Math.round((row.sent / row.total) * 10000) / 100 : 0,
    }));

    // Recent failures
    const failResult = await this.pool.query(
      `SELECT id, transaction_id, employee_id, notification_type, error_message, created_at
      FROM notifications
      WHERE ${where} AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT $${paramIndex}`,
      [...params, failureLimit]
    );

    const recentFailures: NotificationFailureRecord[] = failResult.rows.map((row) => ({
      id: row.id,
      transactionId: row.transaction_id,
      employeeId: row.employee_id,
      notificationType: row.notification_type,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));

    const report: NotificationEngagementReport = {
      summary: {
        total,
        sent,
        failed,
        pending,
        deliveryRate: total > 0 ? Math.round((sent / total) * 10000) / 100 : 0,
        byType,
      },
      byEmployee,
      recentFailures,
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
        schema: 'notification-engagement',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
