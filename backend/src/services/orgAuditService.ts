/**
 * orgAuditService
 *
 * Writes append-only records to the org_audit_log table whenever an
 * organization's name, tenant settings, or issuer account changes.
 *
 * All methods are fire-and-forget safe: errors are logged but never
 * re-thrown so that a logging failure cannot break the main request path.
 */

import { Pool } from 'pg';
import { pool } from '../config/database.js';

export type OrgChangeType =
  | 'name_updated'
  | 'setting_upserted'
  | 'setting_deleted'
  | 'issuer_updated'
  | 'org_created'
  | 'org_deleted';

export interface OrgAuditEntry {
  organizationId: number;
  changeType: OrgChangeType;
  configKey?: string;
  oldValue?: unknown;
  newValue?: unknown;
  actorId?: number;
  actorEmail?: string;
  actorIp?: string;
}

export interface OrgAuditRow {
  id: string;
  organization_id: number;
  change_type: string;
  config_key: string | null;
  old_value: unknown;
  new_value: unknown;
  actor_id: number | null;
  actor_email: string | null;
  actor_ip: string | null;
  created_at: string;
}

export class OrgAuditService {
  constructor(private readonly db: Pool = pool) {}

  /**
   * Append a single entry to the org_audit_log table.
   * Returns the inserted row, or null if the insert failed.
   */
  async log(entry: OrgAuditEntry): Promise<OrgAuditRow | null> {
    const query = `
      INSERT INTO org_audit_log
        (organization_id, change_type, config_key, old_value, new_value,
         actor_id, actor_email, actor_ip)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet)
      RETURNING *
    `;

    try {
      const result = await this.db.query<OrgAuditRow>(query, [
        entry.organizationId,
        entry.changeType,
        entry.configKey ?? null,
        entry.oldValue !== undefined ? JSON.stringify(entry.oldValue) : null,
        entry.newValue !== undefined ? JSON.stringify(entry.newValue) : null,
        entry.actorId ?? null,
        entry.actorEmail ?? null,
        entry.actorIp ?? null,
      ]);
      return result.rows[0] ?? null;
    } catch (err) {
      console.error('[OrgAuditService] Failed to write audit log entry:', err);
      return null;
    }
  }

  /**
   * Retrieve paginated audit log entries for an organization.
   * Results are ordered newest-first.
   */
  async list(
    organizationId: number,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ rows: OrgAuditRow[]; total: number }> {
    const limit = Math.min(options.limit ?? 50, 200);
    const offset = options.offset ?? 0;

    const [dataResult, countResult] = await Promise.all([
      this.db.query<OrgAuditRow>(
        `SELECT * FROM org_audit_log
         WHERE organization_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [organizationId, limit, offset]
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM org_audit_log WHERE organization_id = $1`,
        [organizationId]
      ),
    ]);

    return {
      rows: dataResult.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  }
}

export const orgAuditService = new OrgAuditService();
