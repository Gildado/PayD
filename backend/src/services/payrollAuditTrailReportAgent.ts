/**
 * Payroll Audit Trail Summary Agent (#1309)
 *
 * Condenses raw payroll audit logs into a reviewable narrative summary.
 * Sources data from payroll_audit_logs via PayrollAuditService patterns.
 *
 * Output schema:
 *   - summary: totalActions, byAction, byActorType, success/fail counts, totalAmount
 *   - timeline: chronological list of key audit events
 *   - flaggedItems: transactions with failures or status changes
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface AuditTrailFilters {
  organizationId: number;
  startDate?: string;
  endDate?: string;
}

export interface AuditActionBreakdown {
  action: string;
  count: number;
}

export interface AuditActorBreakdown {
  actorType: string;
  count: number;
}

export interface AuditTimelineEntry {
  id: number;
  action: string;
  actorType: string;
  actorEmail: string | null;
  employeeId: number | null;
  amount: string | null;
  txHash: string | null;
  oldStatus: string | null;
  newStatus: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface AuditTrailReport {
  summary: {
    totalActions: number;
    byAction: AuditActionBreakdown[];
    byActorType: AuditActorBreakdown[];
    successfulTransactions: number;
    failedTransactions: number;
    totalAmountTransacted: string;
  };
  timeline: AuditTimelineEntry[];
  flaggedItems: AuditTimelineEntry[];
}

export class PayrollAuditTrailReportAgent implements IReportAgent {
  id = 'payroll-audit-trail';
  name = 'Payroll Audit Trail Summary';
  description = 'Condenses raw payroll audit logs into a reviewable narrative summary';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as AuditTrailFilters | undefined;
    const organizationId = f?.organizationId ?? 0;
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const startDate = f?.startDate;
    const endDate = f?.endDate;

    const conditions = ['pal.organization_id = $1'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (startDate) {
      conditions.push(`pal.created_at >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`pal.created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const where = conditions.join(' AND ');

    // Aggregate: total, byAction, byActorType
    const aggResult = await this.pool.query(
      `SELECT
        action,
        actor_type,
        COUNT(*)::int AS count
      FROM payroll_audit_logs pal
      WHERE ${where}
      GROUP BY action, actor_type
      ORDER BY count DESC`,
      params
    );

    const actionMap = new Map<string, number>();
    const actorMap = new Map<string, number>();
    let totalActions = 0;

    for (const row of aggResult.rows) {
      totalActions += row.count;
      actionMap.set(row.action, (actionMap.get(row.action) ?? 0) + row.count);
      actorMap.set(row.actor_type, (actorMap.get(row.actor_type) ?? 0) + row.count);
    }

    const byAction: AuditActionBreakdown[] = Array.from(actionMap.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);

    const byActorType: AuditActorBreakdown[] = Array.from(actorMap.entries())
      .map(([actorType, count]) => ({ actorType, count }))
      .sort((a, b) => b.count - a.count);

    // Transaction success/fail counts and total amount
    const txResult = await this.pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE action = 'transaction_succeeded')::int AS successful,
        COUNT(*) FILTER (WHERE action = 'transaction_failed')::int AS failed,
        COALESCE(SUM(CASE WHEN action = 'transaction_succeeded' THEN CAST(amount AS numeric) ELSE 0 END), 0)::numeric(18,2) AS total_amount
      FROM payroll_audit_logs pal
      WHERE ${where}`,
      params
    );

    const successfulTransactions = txResult.rows[0]?.successful ?? 0;
    const failedTransactions = txResult.rows[0]?.failed ?? 0;
    const totalAmountTransacted = String(txResult.rows[0]?.total_amount ?? '0');

    // Timeline (last 50 key events)
    const timelineResult = await this.pool.query(
      `SELECT
        pal.id, pal.action, pal.actor_type, pal.actor_email,
        pal.employee_id, pal.amount, pal.tx_hash,
        pal.old_status, pal.new_status, pal.error_message, pal.created_at
      FROM payroll_audit_logs pal
      WHERE ${where}
      ORDER BY pal.created_at DESC
      LIMIT 50`,
      params
    );

    const timeline: AuditTimelineEntry[] = timelineResult.rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorType: row.actor_type,
      actorEmail: row.actor_email,
      employeeId: row.employee_id,
      amount: row.amount,
      txHash: row.tx_hash,
      oldStatus: row.old_status,
      newStatus: row.new_status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));

    // Flagged items: failures and status changes
    const flaggedResult = await this.pool.query(
      `SELECT
        pal.id, pal.action, pal.actor_type, pal.actor_email,
        pal.employee_id, pal.amount, pal.tx_hash,
        pal.old_status, pal.new_status, pal.error_message, pal.created_at
      FROM payroll_audit_logs pal
      WHERE ${where}
        AND (pal.action = 'transaction_failed' OR pal.action = 'item_status_changed' OR pal.action = 'run_status_changed')
      ORDER BY pal.created_at DESC
      LIMIT 20`,
      params
    );

    const flaggedItems: AuditTimelineEntry[] = flaggedResult.rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorType: row.actor_type,
      actorEmail: row.actor_email,
      employeeId: row.employee_id,
      amount: row.amount,
      txHash: row.tx_hash,
      oldStatus: row.old_status,
      newStatus: row.new_status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));

    const report: AuditTrailReport = {
      summary: {
        totalActions,
        byAction,
        byActorType,
        successfulTransactions,
        failedTransactions,
        totalAmountTransacted,
      },
      timeline,
      flaggedItems,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: totalActions,
        processedRecords: totalActions,
        failedRecords: failedTransactions,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'payroll-audit-trail',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
