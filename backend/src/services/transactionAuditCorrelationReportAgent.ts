/**
 * Transaction Audit Correlation Report Agent (#1311)
 *
 * Correlates transaction audit records across services into one report.
 * Sources data from the `transaction_audit_logs` table managed by
 * transactionAuditService.ts (append-only on-chain audit records).
 *
 * Output schema:
 *   - summary: totalRecords, successful, failed, successRate,
 *     uniqueSourceAccounts, totalFees, avgFee, fee range, window
 *   - bySourceAccount: per-account transaction + outcome + fee breakdown
 *   - statusBreakdown: successful/failed counts and percentages
 *   - trends: daily audit volume and outcome trends
 *   - correlations: accounts that produced BOTH successful and failed records
 *     (mixed outcomes across services) plus narrative insights
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface TransactionAuditCorrelationFilters {
  organizationId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface SourceAccountStat {
  sourceAccount: string;
  transactionCount: number;
  successful: number;
  failed: number;
  totalFees: number;
}

export interface StatusBreakdown {
  status: 'successful' | 'failed';
  count: number;
  percentage: number;
}

export interface AuditTrendDatum {
  period: string;
  total: number;
  successful: number;
  failed: number;
}

export interface AuditCorrelation {
  sourceAccount: string;
  transactionCount: number;
  successful: number;
  failed: number;
  mixedOutcomeRatio: number;
  insight: string;
}

export interface TransactionAuditCorrelationReport {
  schemaVersion: string;
  summary: {
    totalRecords: number;
    successful: number;
    failed: number;
    successRate: number;
    uniqueSourceAccounts: number;
    totalFees: number;
    avgFee: number;
    minFee: number;
    maxFee: number;
    periodStart: string | null;
    periodEnd: string | null;
  };
  bySourceAccount: SourceAccountStat[];
  statusBreakdown: StatusBreakdown[];
  trends: AuditTrendDatum[];
  correlations: AuditCorrelation[];
}

export class TransactionAuditCorrelationReportAgent implements IReportAgent {
  id = 'transaction-audit-correlation';
  name = 'Transaction Audit Correlation Report';
  description = 'Correlates transaction audit records across services into one report';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as TransactionAuditCorrelationFilters | undefined;
    const organizationId = f?.organizationId;
    const limit = Math.min(f?.limit ?? 20, 100);

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (organizationId) {
      conditions.push(
        `source_account IN (
          SELECT wallet_address FROM employees
          WHERE organization_id = $${idx} AND wallet_address IS NOT NULL AND deleted_at IS NULL
        )`
      );
      params.push(organizationId);
      idx++;
    }
    if (f?.startDate) {
      conditions.push(`stellar_created_at >= $${idx}`);
      params.push(f.startDate);
      idx++;
    }
    if (f?.endDate) {
      conditions.push(`stellar_created_at <= $${idx}`);
      params.push(f.endDate);
      idx++;
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1) Overall summary
    const summaryResult = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total_records,
        COUNT(*) FILTER (WHERE successful)::int AS successful,
        COUNT(*) FILTER (WHERE NOT successful)::int AS failed,
        COUNT(DISTINCT source_account)::int AS unique_source_accounts,
        COALESCE(SUM(fee_charged), 0)::numeric(18,2) AS total_fees,
        COALESCE(AVG(fee_charged), 0)::numeric(18,2) AS avg_fee,
        COALESCE(MIN(fee_charged), 0)::numeric(18,2) AS min_fee,
        COALESCE(MAX(fee_charged), 0)::numeric(18,2) AS max_fee,
        MIN(stellar_created_at) AS period_start,
        MAX(stellar_created_at) AS period_end
      FROM transaction_audit_logs
      ${where}`,
      params
    );

    const summaryRow = summaryResult.rows[0] ?? {};
    const totalRecords = summaryRow.total_records ?? 0;
    const successful = summaryRow.successful ?? 0;
    const failed = summaryRow.failed ?? 0;
    const uniqueSourceAccounts = summaryRow.unique_source_accounts ?? 0;

    // 2) Per source-account aggregation (correlation candidates)
    const sourceResult = await this.pool.query(
      `SELECT
        source_account,
        COUNT(*)::int AS transaction_count,
        COUNT(*) FILTER (WHERE successful)::int AS successful,
        COUNT(*) FILTER (WHERE NOT successful)::int AS failed,
        COALESCE(SUM(fee_charged), 0)::numeric(18,2) AS total_fees
      FROM transaction_audit_logs
      ${where}
      GROUP BY source_account
      ORDER BY transaction_count DESC
      LIMIT $${idx}`,
      [...params, limit]
    );

    const bySourceAccount: SourceAccountStat[] = sourceResult.rows.map((row) => ({
      sourceAccount: row.source_account,
      transactionCount: row.transaction_count,
      successful: row.successful,
      failed: row.failed,
      totalFees: parseFloat(row.total_fees),
    }));

    // 3) Status breakdown
    const statusResult = await this.pool.query(
      `SELECT successful, COUNT(*)::int AS count
      FROM transaction_audit_logs
      ${where}
      GROUP BY successful`,
      params
    );

    const statusMap = new Map<boolean, number>();
    for (const row of statusResult.rows) {
      statusMap.set(!!row.successful, row.count);
    }
    const successCount = statusMap.get(true) ?? 0;
    const failCount = statusMap.get(false) ?? 0;
    const statusTotal = successCount + failCount;
    const statusBreakdown: StatusBreakdown[] = [
      {
        status: 'successful',
        count: successCount,
        percentage: statusTotal > 0 ? Number(((successCount / statusTotal) * 100).toFixed(2)) : 0,
      },
      {
        status: 'failed',
        count: failCount,
        percentage: statusTotal > 0 ? Number(((failCount / statusTotal) * 100).toFixed(2)) : 0,
      },
    ];

    // 4) Daily trends
    const trendResult = await this.pool.query(
      `SELECT
        DATE_TRUNC('day', stellar_created_at) AS period,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE successful)::int AS successful,
        COUNT(*) FILTER (WHERE NOT successful)::int AS failed
      FROM transaction_audit_logs
      ${where}
      GROUP BY DATE_TRUNC('day', stellar_created_at)
      ORDER BY period DESC
      LIMIT $${idx}`,
      [...params, limit]
    );

    const trends: AuditTrendDatum[] = trendResult.rows.map((row) => ({
      period: new Date(row.period).toISOString().split('T')[0],
      total: row.total,
      successful: row.successful,
      failed: row.failed,
    }));

    // 5) Correlations: accounts with mixed outcomes (both successful & failed)
    const correlationResult = await this.pool.query(
      `SELECT
        source_account,
        COUNT(*)::int AS transaction_count,
        COUNT(*) FILTER (WHERE successful)::int AS successful,
        COUNT(*) FILTER (WHERE NOT successful)::int AS failed
      FROM transaction_audit_logs
      ${where}
      GROUP BY source_account
      HAVING COUNT(*) FILTER (WHERE successful) > 0 AND COUNT(*) FILTER (WHERE NOT successful) > 0
      ORDER BY transaction_count DESC
      LIMIT $${idx}`,
      [...params, limit]
    );

    const correlations: AuditCorrelation[] = correlationResult.rows.map((row) => ({
      sourceAccount: row.source_account,
      transactionCount: row.transaction_count,
      successful: row.successful,
      failed: row.failed,
      mixedOutcomeRatio:
        row.transaction_count > 0
          ? Number((row.failed / row.transaction_count).toFixed(2))
          : 0,
      insight:
        row.failed > row.successful
          ? `${row.source_account} fails ${row.failed}/${row.transaction_count} audit records — investigate the failing flow across services.`
          : `${row.source_account} mixes successful and failed audit records — verify end-to-end consistency.`,
    }));

    const totalFees = parseFloat(summaryRow.total_fees ?? '0');
    const avgFee = parseFloat(summaryRow.avg_fee ?? '0');
    const report: TransactionAuditCorrelationReport = {
      schemaVersion: '1.0',
      summary: {
        totalRecords,
        successful,
        failed,
        successRate:
          totalRecords > 0 ? Number(((successful / totalRecords) * 100).toFixed(2)) : 0,
        uniqueSourceAccounts,
        totalFees,
        avgFee,
        minFee: parseFloat(summaryRow.min_fee ?? '0'),
        maxFee: parseFloat(summaryRow.max_fee ?? '0'),
        periodStart: summaryRow.period_start ? new Date(summaryRow.period_start).toISOString() : null,
        periodEnd: summaryRow.period_end ? new Date(summaryRow.period_end).toISOString() : null,
      },
      bySourceAccount,
      statusBreakdown,
      trends,
      correlations,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords,
        processedRecords: totalRecords,
        failedRecords: failed,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'transaction-audit-correlation',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
