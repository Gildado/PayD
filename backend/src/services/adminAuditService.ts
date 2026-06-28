/**
 * adminAuditService
 *
 * Append-only audit log for every administrative action in the platform.
 * Covers employee management, payment approvals, asset operations, config
 * changes, payroll runs, trustline operations, and more.
 *
 * All write methods are fire-and-forget safe — errors are swallowed so a
 * logging failure can never break the main request path.
 */

import { Pool } from 'pg';
import { pool } from '../config/database.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdminActionType =
  // Employee
  | 'employee_created'
  | 'employee_updated'
  | 'employee_deleted'
  // Payment
  | 'payment_approved'
  | 'payment_rejected'
  | 'payment_sent'
  | 'bulk_payment_queued'
  // Asset
  | 'asset_issued'
  | 'asset_frozen'
  | 'asset_unfrozen'
  | 'asset_clawback'
  | 'trustline_authorized'
  | 'trustline_revoked'
  // User / access
  | 'user_invited'
  | 'user_deactivated'
  | 'user_role_changed'
  // Config / org
  | 'config_updated'
  | 'organization_created'
  | 'organization_deleted'
  | 'org_setting_changed'
  // Payroll
  | 'payroll_run_started'
  | 'payroll_run_completed'
  | 'payroll_schedule_created'
  | 'payroll_schedule_updated'
  | 'payroll_schedule_deleted'
  // Catch-all for custom extensions
  | string;

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AdminAuditEntry {
  organizationId: number;
  actionType: AdminActionType;
  resourceType: string;
  resourceId?: string | number;
  oldState?: unknown;
  newState?: unknown;
  actorId?: number;
  actorEmail?: string;
  actorIp?: string;
  userAgent?: string;
  requestId?: string;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
}

export interface AdminAuditRow {
  id: string;
  organization_id: number;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  old_state: unknown;
  new_state: unknown;
  actor_id: number | null;
  actor_email: string | null;
  actor_ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  severity: AuditSeverity;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminAuditFilter {
  actionType?: string;
  resourceType?: string;
  actorId?: number;
  severity?: AuditSeverity;
  fromDate?: Date;
  toDate?: Date;
}

export interface AdminAuditListOptions extends AdminAuditFilter {
  limit?: number;
  offset?: number;
}

export interface AdminAuditListResult {
  rows: AdminAuditRow[];
  total: number;
}

export interface AdminAuditSummary {
  totalActions: number;
  criticalCount: number;
  warningCount: number;
  byActionType: Array<{ action_type: string; count: number }>;
  byResourceType: Array<{ resource_type: string; count: number }>;
  byActor: Array<{ actor_email: string | null; count: number }>;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class AdminAuditService {
  constructor(private readonly db: Pool = pool) {}

  /**
   * Append a single entry to admin_audit_log.
   * Returns the inserted row, or null if the insert failed (never throws).
   */
  async log(entry: AdminAuditEntry): Promise<AdminAuditRow | null> {
    const sql = `
      INSERT INTO admin_audit_log
        (organization_id, action_type, resource_type, resource_id,
         old_state, new_state, actor_id, actor_email, actor_ip,
         user_agent, request_id, severity, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::inet, $10, $11, $12, $13)
      RETURNING *
    `;

    try {
      const result = await this.db.query<AdminAuditRow>(sql, [
        entry.organizationId,
        entry.actionType,
        entry.resourceType,
        entry.resourceId !== undefined ? String(entry.resourceId) : null,
        entry.oldState !== undefined ? JSON.stringify(entry.oldState) : null,
        entry.newState !== undefined ? JSON.stringify(entry.newState) : null,
        entry.actorId ?? null,
        entry.actorEmail ?? null,
        entry.actorIp ?? null,
        entry.userAgent ?? null,
        entry.requestId ?? null,
        entry.severity ?? 'info',
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ]);
      return result.rows[0] ?? null;
    } catch (err) {
      console.error('[AdminAuditService] Failed to write audit entry:', err);
      return null;
    }
  }

  /**
   * Retrieve paginated audit log entries with optional filtering.
   * Results are ordered newest-first.
   */
  async list(
    organizationId: number,
    options: AdminAuditListOptions = {}
  ): Promise<AdminAuditListResult> {
    const limit = Math.min(options.limit ?? 50, 200);
    const offset = Math.max(options.offset ?? 0, 0);

    const { conditions, params } = this._buildFilters(organizationId, options);
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [dataResult, countResult] = await Promise.all([
      this.db.query<AdminAuditRow>(
        `SELECT * FROM admin_audit_log
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM admin_audit_log ${whereClause}`,
        params
      ),
    ]);

    return {
      rows: dataResult.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  }

  /**
   * Returns aggregate counts grouped by action type, resource type, and actor.
   * Useful for dashboard widgets and compliance reports.
   */
  async summary(organizationId: number, filter: AdminAuditFilter = {}): Promise<AdminAuditSummary> {
    const { conditions, params } = this._buildFilters(organizationId, filter);
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [totalRes, byActionRes, byResourceRes, byActorRes] = await Promise.all([
      this.db.query<{ total: string; critical_count: string; warning_count: string }>(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE severity = 'critical') AS critical_count,
           COUNT(*) FILTER (WHERE severity = 'warning')  AS warning_count
         FROM admin_audit_log ${whereClause}`,
        params
      ),
      this.db.query<{ action_type: string; count: string }>(
        `SELECT action_type, COUNT(*) AS count
         FROM admin_audit_log ${whereClause}
         GROUP BY action_type
         ORDER BY count DESC
         LIMIT 20`,
        params
      ),
      this.db.query<{ resource_type: string; count: string }>(
        `SELECT resource_type, COUNT(*) AS count
         FROM admin_audit_log ${whereClause}
         GROUP BY resource_type
         ORDER BY count DESC
         LIMIT 20`,
        params
      ),
      this.db.query<{ actor_email: string | null; count: string }>(
        `SELECT actor_email, COUNT(*) AS count
         FROM admin_audit_log ${whereClause}
         GROUP BY actor_email
         ORDER BY count DESC
         LIMIT 10`,
        params
      ),
    ]);

    const totals = totalRes.rows[0];
    return {
      totalActions: parseInt(totals?.total ?? '0', 10),
      criticalCount: parseInt(totals?.critical_count ?? '0', 10),
      warningCount: parseInt(totals?.warning_count ?? '0', 10),
      byActionType: byActionRes.rows.map((r) => ({
        action_type: r.action_type,
        count: parseInt(r.count, 10),
      })),
      byResourceType: byResourceRes.rows.map((r) => ({
        resource_type: r.resource_type,
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
  async exportCsv(organizationId: number, filter: AdminAuditFilter = {}): Promise<string> {
    const { conditions, params } = this._buildFilters(organizationId, filter);
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await this.db.query<AdminAuditRow>(
      `SELECT * FROM admin_audit_log
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT 10000`,
      params
    );

    const header = [
      'id',
      'organization_id',
      'action_type',
      'resource_type',
      'resource_id',
      'actor_email',
      'actor_ip',
      'severity',
      'request_id',
      'created_at',
    ].join(',');

    const rows = result.rows.map((r) =>
      [
        r.id,
        r.organization_id,
        this._csvEscape(r.action_type),
        this._csvEscape(r.resource_type),
        this._csvEscape(r.resource_id ?? ''),
        this._csvEscape(r.actor_email ?? ''),
        this._csvEscape(r.actor_ip ?? ''),
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
    filter: AdminAuditFilter
  ): { conditions: string[]; params: unknown[] } {
    const conditions: string[] = ['organization_id = $1'];
    const params: unknown[] = [organizationId];

    if (filter.actionType) {
      params.push(filter.actionType);
      conditions.push(`action_type = $${params.length}`);
    }
    if (filter.resourceType) {
      params.push(filter.resourceType);
      conditions.push(`resource_type = $${params.length}`);
    }
    if (filter.actorId !== undefined) {
      params.push(filter.actorId);
      conditions.push(`actor_id = $${params.length}`);
    }
    if (filter.severity) {
      params.push(filter.severity);
      conditions.push(`severity = $${params.length}`);
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

export const adminAuditService = new AdminAuditService();
