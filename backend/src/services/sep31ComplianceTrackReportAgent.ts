/**
 * SEP-31 Compliance Tracking Report Agent (#1313)
 *
 * Reports on SEP-31 transaction compliance status.
 * Sources data from the `sep31_cross_border_transactions` table managed by
 * sep31TrackingService.ts (cross-border sender transactions with an
 * anchor + Stellar hop ledger).
 *
 * Output schema:
 *   - summary: total, completed, pending, error, unknown, onChain count /
 *     rate, unique senders/anchors, window
 *   - byStatus: distribution of transaction statuses
 *   - byAnchor: per-anchor-domain compliance breakdown
 *   - trends: daily SEP-31 transaction volume
 *   - complianceFlags: actionable records missing on-chain presence (or a
 *     status), surfaced for review
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface Sep31ComplianceFilters {
  organizationId?: number;
  status?: string;
  anchorDomain?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface Sep31StatusStat {
  status: string;
  count: number;
}

export interface Sep31AnchorStat {
  anchorDomain: string;
  total: number;
  completed: number;
  pending: number;
  error: number;
  onChainCount: number;
}

export interface Sep31TrendDatum {
  period: string;
  total: number;
  completed: number;
}

export interface Sep31ComplianceFlag {
  senderPublicKey: string;
  anchorDomain: string;
  anchorTransactionId: string | null;
  status: string | null;
  onChain: boolean;
  flags: string[];
  message: string;
  createdAt: string;
}

export interface Sep31ComplianceTrackReport {
  schemaVersion: string;
  summary: {
    total: number;
    completed: number;
    pending: number;
    error: number;
    unknown: number;
    onChainCount: number;
    onChainRate: number;
    uniqueSenders: number;
    uniqueAnchors: number;
    periodStart: string | null;
    periodEnd: string | null;
  };
  byStatus: Sep31StatusStat[];
  byAnchor: Sep31AnchorStat[];
  trends: Sep31TrendDatum[];
  complianceFlags: Sep31ComplianceFlag[];
}

export class Sep31ComplianceTrackReportAgent implements IReportAgent {
  id = 'sep31-compliance-tracking';
  name = 'SEP-31 Compliance Tracking Report';
  description = 'Reports on SEP-31 transaction compliance status';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as Sep31ComplianceFilters | undefined;
    const limit = Math.min(f?.limit ?? 20, 100);

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (f?.organizationId) {
      conditions.push(`organization_id = $${idx}`);
      params.push(f.organizationId);
      idx++;
    }
    if (f?.status) {
      conditions.push(`status = $${idx}`);
      params.push(f.status);
      idx++;
    }
    if (f?.anchorDomain) {
      conditions.push(`anchor_domain = $${idx}`);
      params.push(f.anchorDomain);
      idx++;
    }
    if (f?.startDate) {
      conditions.push(`created_at >= $${idx}`);
      params.push(f.startDate);
      idx++;
    }
    if (f?.endDate) {
      conditions.push(`created_at <= $${idx}`);
      params.push(f.endDate);
      idx++;
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1) Summary
    const summaryResult = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status IN ('error', 'failed'))::int AS error,
        COUNT(*) FILTER (WHERE status IS NULL OR status = '')::int AS unknown,
        COUNT(*) FILTER (WHERE stellar_transaction_id IS NOT NULL)::int AS on_chain_count,
        COUNT(DISTINCT sender_public_key)::int AS unique_senders,
        COUNT(DISTINCT anchor_domain)::int AS unique_anchors,
        MIN(created_at) AS period_start,
        MAX(created_at) AS period_end
      FROM sep31_cross_border_transactions
      ${where}`,
      params
    );

    const summaryRow = summaryResult.rows[0] ?? {};
    const total = summaryRow.total ?? 0;
    const onChainCount = summaryRow.on_chain_count ?? 0;

    // 2) By status
    const statusResult = await this.pool.query(
      `SELECT status, COUNT(*)::int AS count
      FROM sep31_cross_border_transactions
      ${where}
      GROUP BY status`,
      params
    );

    const byStatus: Sep31StatusStat[] = statusResult.rows.map((row) => ({
      status: row.status ?? 'unknown',
      count: row.count,
    }));

    // 3) By anchor domain
    const anchorResult = await this.pool.query(
      `SELECT
        anchor_domain,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status IN ('error', 'failed'))::int AS error,
        COUNT(*) FILTER (WHERE stellar_transaction_id IS NOT NULL)::int AS on_chain_count
      FROM sep31_cross_border_transactions
      ${where}
      GROUP BY anchor_domain
      ORDER BY total DESC
      LIMIT $${idx}`,
      [...params, limit]
    );

    const byAnchor: Sep31AnchorStat[] = anchorResult.rows.map((row) => ({
      anchorDomain: row.anchor_domain,
      total: row.total,
      completed: row.completed,
      pending: row.pending,
      error: row.error,
      onChainCount: row.on_chain_count,
    }));

    // 4) Daily trends
    const trendResult = await this.pool.query(
      `SELECT
        DATE_TRUNC('day', created_at) AS period,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
      FROM sep31_cross_border_transactions
      ${where}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY period DESC
      LIMIT $${idx}`,
      [...params, limit]
    );

    const trends: Sep31TrendDatum[] = trendResult.rows.map((row) => ({
      period: new Date(row.period).toISOString().split('T')[0],
      total: row.total,
      completed: row.completed,
    }));

    // 5) Compliance flags: records missing on-chain presence or a status
    const complianceWhere = `${where}${
      where ? ' AND ' : 'WHERE '
    }(stellar_transaction_id IS NULL OR status IS NULL OR status = '')`;
    const flagResult = await this.pool.query(
      `SELECT
        sender_public_key, anchor_domain, anchor_transaction_id,
        stellar_transaction_id, status, created_at
      FROM sep31_cross_border_transactions
      ${complianceWhere}
      ORDER BY created_at DESC
      LIMIT $${idx}`,
      [...params, limit]
    );

    const complianceFlags: Sep31ComplianceFlag[] = flagResult.rows.map((row) => {
      const flags: string[] = [];
      if (!row.stellar_transaction_id) flags.push('off-chain-only');
      if (!row.status || row.status === '') flags.push('missing-status');
      const flagLabel = flags.map((fl) => fl.replace(/-/g, ' ')).join(', ');
      return {
        senderPublicKey: row.sender_public_key,
        anchorDomain: row.anchor_domain,
        anchorTransactionId: row.anchor_transaction_id,
        status: row.status,
        onChain: !!row.stellar_transaction_id,
        flags,
        message: `${row.sender_public_key}'s transaction via ${row.anchor_domain} is flagged: ${flagLabel}.`,
        createdAt: new Date(row.created_at).toISOString(),
      };
    });

    const report: Sep31ComplianceTrackReport = {
      schemaVersion: '1.0',
      summary: {
        total,
        completed: summaryRow.completed ?? 0,
        pending: summaryRow.pending ?? 0,
        error: summaryRow.error ?? 0,
        unknown: summaryRow.unknown ?? 0,
        onChainCount,
        onChainRate: total > 0 ? Number(((onChainCount / total) * 100).toFixed(2)) : 0,
        uniqueSenders: summaryRow.unique_senders ?? 0,
        uniqueAnchors: summaryRow.unique_anchors ?? 0,
        periodStart: summaryRow.period_start ? new Date(summaryRow.period_start).toISOString() : null,
        periodEnd: summaryRow.period_end ? new Date(summaryRow.period_end).toISOString() : null,
      },
      byStatus,
      byAnchor,
      trends,
      complianceFlags,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: total,
        processedRecords: total,
        failedRecords: summaryRow.error ?? 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'sep31-compliance-tracking',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
