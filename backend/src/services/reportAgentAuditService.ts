/**
 * reportAgentAuditService
 *
 * Append-only audit log for every report agent action in the platform.
 * Covers report generation, export, delivery, access, scheduling, and failure events.
 *
 * Follows the same fire-and-forget pattern as AdminAuditService — errors are
 * swallowed so a logging failure never breaks the main request path.
 */

import { Pool } from 'pg';
import { pool } from '../config/database.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReportAgentActionType =
  | 'report_generated'
  | 'report_exported'
  | 'report_delivered'
  | 'report_accessed'
  | 'report_scheduled'
  | 'report_schedule_updated'
  | 'report_schedule_deleted'
  | 'report_failed'
  | 'report_validation_failed'
  | 'report_cache_hit'
  | 'report_cache_miss'
  | string;

export type ReportAgentActorType = 'user' | 'system' | 'api';

export type ReportAuditSeverity = 'info' | 'warning' | 'critical';

export interface ReportAgentAuditEntry {
  organizationId: number;
  actionType: ReportAgentActionType;
  reportId: string;
  reportName?: string;
  agentId?: string;
  actorType: ReportAgentActorType;
  actorId?: number;
  actorEmail?: string;
  format?: string;
  rowCount?: number;
  durationMs?: number;
  status?: 'success' | 'failed';
  errorMessage?: string;
  filters?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  severity?: ReportAuditSeverity;
}

export interface ReportAgentAuditRow {
  id: string;
  organization_id: number;
  action_type: string;
  report_id: string;
  report_name: string | null;
  agent_id: string | null;
  actor_type: ReportAgentActorType;
  actor_id: number | null;
  actor_email: string | null;
  format: string | null;
  row_count: number | null;
  duration_ms: number | null;
  status: string | null;
  error_message: string | null;
  filters: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  severity: ReportAuditSeverity;
  created_at: string;
}

export interface ReportAgentAuditFilter {
  actionType?: string;
  reportId?: string;
  agentId?: string;
  actorType?: ReportAgentActorType;
  actorId?: number;
  severity?: ReportAuditSeverity;
  status?: 'success' | 'failed';
  fromDate?: Date;
  toDate?: Date;
}

export interface ReportAgentAuditListOptions extends ReportAgentAuditFilter {
  limit?: number;
  offset?: number;
}

export interface ReportAgentAuditListResult {
  rows: ReportAgentAuditRow[];
  total: number;
}

export interface ReportAgentAuditSummary {
  totalActions: number;
  successCount: number;
  failedCount: number;
  criticalCount: number;
  warningCount: number;
  avgDurationMs: number | null;
  totalRowsGenerated: number;
  byActionType: Array<{ action_type: string; count: number }>;
  byReport: Array<{ report_id: string; report_name: string | null; count: number }>;
  byActor: Array<{ actor_email: string | null; count: number }>;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class ReportAgentAuditService {
  constructor(private readonly db: Pool = pool) {}

  /**
   * Append a single entry to report_agent_audit_log.
   * Returns the inserted row, or null if the insert failed (never throws).
   */
  async log(entry: ReportAgentAuditEntry): Promise<ReportAgentAuditRow | null> {
    const sql = `
      INSERT INTO report_agent_audit_log
        (organization_id, action_type, report_id, report_name, agent_id,
         actor_type, actor_id, actor_email, format, row_count,
         duration_ms, status, error_message, filters, metadata,
         ip_address, user_agent, request_id, severity)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *
    `;

    try {
      const result = await this.db.query<ReportAgentAuditRow>(sql, [
        entry.organizationId,
        entry.actionType,
        entry.reportId,
        entry.reportName ?? null,
        entry.agentId ?? null,
        entry.actorType,
        entry.actorId ?? null,
        entry.actorEmail ?? null,
        entry.format ?? null,
        entry.rowCount ?? null,
        entry.durationMs ?? null,
        entry.status ?? null,
        entry.errorMessage ?? null,
        entry.filters ? JSON.stringify(entry.filters) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
        entry.requestId ?? null,
        entry.severity ?? 'info',
      ]);
      return result.rows[0] ?? null;
    } catch (err) {
      console.error('[ReportAgentAuditService] Failed to write audit entry:', err);
      return null;
    }
  }

  /**
   * Retrieve paginated audit log entries with optional filtering.
   * Results are ordered newest-first.
   */
  async list(
    organizationId: number,
    options: ReportAgentAuditListOptions = {}
  ): Promise<ReportAgentAuditListResult> {
    const limit = Math.min(options.limit ?? 50, 200);
    const offset = Math.max(options.offset ?? 0, 0);

    const { conditions, params } = this._buildFilters(organizationId, options);
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [dataResult, countResult] = await Promise.all([
      this.db.query<ReportAgentAuditRow>(
        `SELECT * FROM report_agent_audit_log
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM report_agent_audit_log ${whereClause}`,
        params
      ),
    ]);

    return {
      rows: dataResult.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  }

  /**
   * Returns aggregate counts grouped by action type, report, and actor.
   * Includes success/failure rates and average generation duration.
   */
  async summary(
    organizationId: number,
    filter: ReportAgentAuditFilter = {}
  ): Promise<ReportAgentAuditSummary> {
    const { conditions, params } = this._buildFilters(organizationId, filter);
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [totalRes, byActionRes, byReportRes, byActorRes] = await Promise.all([
      this.db.query<{
        total: string;
        success_count: string;
        failed_count: string;
        critical_count: string;
        warning_count: string;
        avg_duration: string | null;
        total_rows: string;
      }>(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'success') AS success_count,
           COUNT(*) FILTER (WHERE status = 'failed')  AS failed_count,
           COUNT(*) FILTER (WHERE severity = 'critical') AS critical_count,
           COUNT(*) FILTER (WHERE severity = 'warning')  AS warning_count,
           AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS avg_duration,
           COALESCE(SUM(row_count), 0) AS total_rows
         FROM report_agent_audit_log ${whereClause}`,
        params
      ),
      this.db.query<{ action_type: string; count: string }>(
        `SELECT action_type, COUNT(*) AS count
         FROM report_agent_audit_log ${whereClause}
         GROUP BY action_type
         ORDER BY count DESC
         LIMIT 20`,
        params
      ),
      this.db.query<{ report_id: string; report_name: string | null; count: string }>(
        `SELECT report_id, report_name, COUNT(*) AS count
         FROM report_agent_audit_log ${whereClause}
         GROUP BY report_id, report_name
         ORDER BY count DESC
         LIMIT 20`,
        params
      ),
      this.db.query<{ actor_email: string | null; count: string }>(
        `SELECT actor_email, COUNT(*) AS count
         FROM report_agent_audit_log ${whereClause}
         GROUP BY actor_email
         ORDER BY count DESC
         LIMIT 10`,
        params
      ),
    ]);

    const totals = totalRes.rows[0];
    return {
      totalActions: parseInt(totals?.total ?? '0', 10),
      successCount: parseInt(totals?.success_count ?? '0', 10),
      failedCount: parseInt(totals?.failed_count ?? '0', 10),
      criticalCount: parseInt(totals?.critical_count ?? '0', 10),
      warningCount: parseInt(totals?.warning_count ?? '0', 10),
      avgDurationMs: totals?.avg_duration ? parseFloat(totals.avg_duration) : null,
      totalRowsGenerated: parseInt(totals?.total_rows ?? '0', 10),
      byActionType: byActionRes.rows.map((r) => ({
        action_type: r.action_type,
        count: parseInt(r.count, 10),
      })),
      byReport: byReportRes.rows.map((r) => ({
        report_id: r.report_id,
        report_name: r.report_name,
        count: parseInt(r.count, 10),
      })),
      byActor: byActorRes.rows.map((r) => ({
        actor_email: r.actor_email,
        count: parseInt(r.count, 10),
      })),
    };
  }

  /**
   * Export all matching rows as a CSV string.
   * Max 10 000 rows per export to guard against memory pressure.
   */
  async exportCsv(
    organizationId: number,
    filter: ReportAgentAuditFilter = {}
  ): Promise<string> {
    const { conditions, params } = this._buildFilters(organizationId, filter);
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await this.db.query<ReportAgentAuditRow>(
      `SELECT * FROM report_agent_audit_log
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT 10000`,
      params
    );

    const header = [
      'id',
      'organization_id',
      'action_type',
      'report_id',
      'report_name',
      'agent_id',
      'actor_type',
      'actor_email',
      'format',
      'row_count',
      'duration_ms',
      'status',
      'error_message',
      'severity',
      'request_id',
      'created_at',
    ].join(',');

    const rows = result.rows.map((r) =>
      [
        r.id,
        r.organization_id,
        this._csvEscape(r.action_type),
        this._csvEscape(r.report_id),
        this._csvEscape(r.report_name ?? ''),
        this._csvEscape(r.agent_id ?? ''),
        this._csvEscape(r.actor_type),
        this._csvEscape(r.actor_email ?? ''),
        this._csvEscape(r.format ?? ''),
        r.row_count ?? '',
        r.duration_ms ?? '',
        this._csvEscape(r.status ?? ''),
        this._csvEscape(r.error_message ?? ''),
        this._csvEscape(r.severity),
        this._csvEscape(r.request_id ?? ''),
        this._csvEscape(r.created_at),
      ].join(',')
    );

    return [header, ...rows].join('\n');
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _buildFilters(
    organizationId: number,
    filter: ReportAgentAuditFilter
  ): { conditions: string[]; params: unknown[] } {
    const conditions: string[] = ['organization_id = $1'];
    const params: unknown[] = [organizationId];

    if (filter.actionType) {
      params.push(filter.actionType);
      conditions.push(`action_type = $${params.length}`);
    }
    if (filter.reportId) {
      params.push(filter.reportId);
      conditions.push(`report_id = $${params.length}`);
    }
    if (filter.agentId) {
      params.push(filter.agentId);
      conditions.push(`agent_id = $${params.length}`);
    }
    if (filter.actorType) {
      params.push(filter.actorType);
      conditions.push(`actor_type = $${params.length}`);
    }
    if (filter.actorId !== undefined) {
      params.push(filter.actorId);
      conditions.push(`actor_id = $${params.length}`);
    }
    if (filter.severity) {
      params.push(filter.severity);
      conditions.push(`severity = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filter.fromDate) {
      params.push(filter.fromDate.toISOString());
      conditions.push(`created_at >= $${params.length}`);
    }
    if (filter.toDate) {
      params.push(filter.toDate.toISOString());
      conditions.push(`created_at <= $${params.length}`);
    }

    return { conditions, params };
  }

  private _csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

export const reportAgentAuditService = new ReportAgentAuditService();
