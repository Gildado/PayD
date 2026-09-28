/**
 * Bulk Payment Batch Outcome Report Agent (#1315)
 *
 * Generates a report on success/failure breakdowns across bulk payment
 * batches, sourcing data from bulk_payment_batches and bulk_payment_items.
 *
 * Output schema:
 *   - summary: total batches, total items, success/failure rates
 *   - batchBreakdown: per-batch stats
 *   - recentFailures: latest failed items with error messages
 *   - successRateOverTime: daily success rate trend
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface BulkPaymentBatchFilters {
  organizationId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface BatchOutcome {
  batchId: string;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  successRate: number;
  assetCode: string;
  status: string;
  createdAt: Date;
}

export interface BatchFailureRecord {
  id: number;
  batchId: string;
  destination: string;
  amount: string;
  errorMessage: string | null;
  createdAt: Date;
}

export interface DailySuccessRate {
  date: string;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  successRate: number;
}

export interface BulkPaymentBatchReport {
  summary: {
    totalBatches: number;
    totalItems: number;
    successfulItems: number;
    failedItems: number;
    overallSuccessRate: number;
  };
  batchBreakdown: BatchOutcome[];
  recentFailures: BatchFailureRecord[];
  successRateOverTime: DailySuccessRate[];
}

export class BulkPaymentBatchReportAgent implements IReportAgent {
  id = 'bulk-payment-batch';
  name = 'Bulk Payment Batch Outcome Report';
  description = 'Reports success/failure breakdowns across bulk payment batches';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as BulkPaymentBatchFilters | undefined;
    const limit = f?.limit ?? 20;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (f?.organizationId) {
      conditions.push(`b.organization_id = $${paramIndex++}`);
      params.push(f.organizationId);
    }
    if (f?.startDate) {
      conditions.push(`b.created_at >= $${paramIndex++}`);
      params.push(f.startDate);
    }
    if (f?.endDate) {
      conditions.push(`b.created_at <= $${paramIndex++}`);
      params.push(f.endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Per-batch outcomes
    const batchResult = await this.pool.query(
      `SELECT b.batch_id,
              b.total_items,
              b.successful_items,
              b.failed_items,
              b.asset_code,
              b.status,
              b.created_at
       FROM bulk_payment_batches b
       ${where}
       ORDER BY b.created_at DESC
       LIMIT $${paramIndex}`,
      [...params, limit]
    );

    const batchBreakdown: BatchOutcome[] = batchResult.rows.map((row) => ({
      batchId: row.batch_id,
      totalItems: row.total_items,
      successfulItems: row.successful_items,
      failedItems: row.failed_items,
      successRate: row.total_items > 0
        ? Math.round((row.successful_items / row.total_items) * 10000) / 100
        : 0,
      assetCode: row.asset_code,
      status: row.status,
      createdAt: row.created_at,
    }));

    // Summary totals
    let totalBatches = 0;
    let totalItems = 0;
    let successfulItems = 0;
    let failedItems = 0;

    const summaryResult = await this.pool.query(
      `SELECT COUNT(*)::int AS total_batches,
              COALESCE(SUM(total_items), 0)::int AS total_items,
              COALESCE(SUM(successful_items), 0)::int AS successful_items,
              COALESCE(SUM(failed_items), 0)::int AS failed_items
       FROM bulk_payment_batches b
       ${where}`,
      params
    );

    if (summaryResult.rows.length > 0) {
      totalBatches = summaryResult.rows[0].total_batches;
      totalItems = summaryResult.rows[0].total_items;
      successfulItems = summaryResult.rows[0].successful_items;
      failedItems = summaryResult.rows[0].failed_items;
    }

    // Recent failures
    const failResult = await this.pool.query(
      `SELECT i.id, i.batch_id, i.destination, i.amount, i.error_message, b.created_at
       FROM bulk_payment_items i
       JOIN bulk_payment_batches b ON i.batch_id = b.batch_id
       WHERE i.status = 'failed' ${f?.organizationId ? 'AND b.organization_id = $1' : ''}
       ORDER BY b.created_at DESC
       LIMIT $${paramIndex + (f?.organizationId ? 1 : 0)}`,
      f?.organizationId ? [f.organizationId, limit] : [limit]
    );

    const recentFailures: BatchFailureRecord[] = failResult.rows.map((row) => ({
      id: row.id,
      batchId: row.batch_id,
      destination: row.destination,
      amount: row.amount,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));

    // Daily success rate trend (last 30 days)
    const trendResult = await this.pool.query(
      `SELECT DATE(b.created_at) AS date,
              COUNT(*)::int AS total_items,
              COUNT(*) FILTER (WHERE i.status = 'success')::int AS successful_items,
              COUNT(*) FILTER (WHERE i.status = 'failed')::int AS failed_items
       FROM bulk_payment_items i
       JOIN bulk_payment_batches b ON i.batch_id = b.batch_id
       ${where}
       GROUP BY DATE(b.created_at)
       ORDER BY date DESC
       LIMIT 30`,
      params
    );

    const successRateOverTime: DailySuccessRate[] = trendResult.rows.map((row) => ({
      date: row.date,
      totalItems: row.total_items,
      successfulItems: row.successful_items,
      failedItems: row.failed_items,
      successRate: row.total_items > 0
        ? Math.round((row.successful_items / row.total_items) * 10000) / 100
        : 0,
    }));

    const report: BulkPaymentBatchReport = {
      summary: {
        totalBatches,
        totalItems,
        successfulItems,
        failedItems,
        overallSuccessRate: totalItems > 0
          ? Math.round((successfulItems / totalItems) * 10000) / 100
          : 0,
      },
      batchBreakdown,
      recentFailures,
      successRateOverTime,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: totalItems,
        processedRecords: totalItems,
        failedRecords: failedItems,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'bulk-payment-batch',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
