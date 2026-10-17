/**
 * Anomaly agent access control & audit trail (#1229).
 *
 * Controls which roles can view/act on anomaly findings and records every
 * access and action for compliance auditing.
 */
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';

export type AnomalyRole = 'viewer' | 'analyst' | 'admin';
export type AuditAction =
  | 'view_finding'
  | 'view_case'
  | 'create_case'
  | 'update_case'
  | 'resolve_case'
  | 'export_data'
  | 'config_change';

export interface AuditEntry {
  id: string;
  organizationId: number;
  userId: string;
  role: AnomalyRole;
  action: AuditAction;
  resourceId: string;
  details: Record<string, any>;
  timestamp: string;
}

const ROLE_PERMISSIONS: Record<AnomalyRole, AuditAction[]> = {
  viewer: ['view_finding', 'view_case'],
  analyst: ['view_finding', 'view_case', 'create_case', 'update_case', 'resolve_case'],
  admin: ['view_finding', 'view_case', 'create_case', 'update_case', 'resolve_case', 'export_data', 'config_change'],
};

export class AnomalyAccessControlService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Check if a user role is allowed to perform an action.
   */
  canPerform(role: AnomalyRole, action: AuditAction): boolean {
    return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
  }

  /**
   * Assert the user can perform the action; throws if denied.
   */
  authorize(userId: string, role: AnomalyRole, action: AuditAction, resourceId: string): void {
    if (!this.canPerform(role, action)) {
      logger.warn({ userId, role, action, resourceId }, 'Anomaly access denied');
      throw new Error(`Role ${role} is not authorized to perform ${action}`);
    }
  }

  /**
   * Record an audit entry for every anomaly access or action.
   */
  async recordAudit(
    organizationId: number,
    userId: string,
    role: AnomalyRole,
    action: AuditAction,
    resourceId: string,
    details: Record<string, any> = {}
  ): Promise<AuditEntry> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    const result = await this.pool.query(
      `INSERT INTO anomaly_audit_log (id, organization_id, user_id, role, action, resource_id, details, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, organizationId, userId, role, action, resourceId, JSON.stringify(details), timestamp]
    );

    logger.info({ auditId: id, userId, action }, 'Anomaly audit recorded');
    return {
      id,
      organizationId,
      userId,
      role,
      action,
      resourceId,
      details,
      timestamp,
    };
  }

  /**
   * Retrieve audit trail entries with optional filters.
   */
  async getAuditTrail(filters: {
    organizationId?: number;
    userId?: string;
    action?: AuditAction;
    limit?: number;
  }): Promise<AuditEntry[]> {
    let query = 'SELECT * FROM anomaly_audit_log WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (filters.organizationId) {
      query += ` AND organization_id = $${idx++}`;
      params.push(filters.organizationId);
    }
    if (filters.userId) {
      query += ` AND user_id = $${idx++}`;
      params.push(filters.userId);
    }
    if (filters.action) {
      query += ` AND action = $${idx++}`;
      params.push(filters.action);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${idx}`;
    params.push(filters.limit ?? 100);

    const result = await this.pool.query(query, params);
    return result.rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      userId: r.user_id,
      role: r.role,
      action: r.action,
      resourceId: r.resource_id,
      details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details,
      timestamp: r.timestamp,
    }));
  }
}
