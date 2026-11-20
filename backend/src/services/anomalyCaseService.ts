/**
 * Anomaly investigation case management (#1228).
 *
 * Provides a structured case lifecycle around raw anomaly findings so that
 * detection agents' signals become actionable cases rather than noisy logs.
 */
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';

export type CaseStatus = 'open' | 'investigating' | 'resolved' | 'false_positive';
export type CaseSeverity = 'info' | 'warning' | 'critical';

export interface AnomalyCase {
  id: string;
  organizationId: number;
  findingId: string;
  status: CaseStatus;
  severity: CaseSeverity;
  title: string;
  description: string;
  assignedTo: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCaseInput {
  organizationId: number;
  findingId: string;
  severity: CaseSeverity;
  title: string;
  description: string;
}

export class AnomalyCaseService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Create a case from a structured anomaly finding.
   */
  async createCase(input: CreateCaseInput): Promise<AnomalyCase> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const result = await this.pool.query(
      `INSERT INTO anomaly_cases
       (id, organization_id, finding_id, status, severity, title, description, assigned_to, resolution, created_at, updated_at)
       VALUES ($1, $2, $3, 'open', $4, $5, $6, NULL, NULL, $7, $7)
       RETURNING *`,
      [id, input.organizationId, input.findingId, input.severity, input.title, input.description, now]
    );

    logger.info({ caseId: id, severity: input.severity }, 'Anomaly case created');
    return this.mapRow(result.rows[0]);
  }

  /**
   * Update case status and optionally assign or resolve.
   */
  async updateCase(
    caseId: string,
    updates: { status?: CaseStatus; assignedTo?: string; resolution?: string }
  ): Promise<AnomalyCase> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `UPDATE anomaly_cases
       SET status = COALESCE($2, status),
           assigned_to = COALESCE($3, assigned_to),
           resolution = COALESCE($4, resolution),
           updated_at = $5
       WHERE id = $1
       RETURNING *`,
      [caseId, updates.status, updates.assignedTo, updates.resolution, now]
    );

    if (result.rows.length === 0) {
      throw new Error(`Anomaly case ${caseId} not found`);
    }

    logger.info({ caseId, status: updates.status }, 'Anomaly case updated');
    return this.mapRow(result.rows[0]);
  }

  /**
   * List cases with optional filters.
   */
  async listCases(filters: {
    organizationId?: number;
    status?: CaseStatus;
    severity?: CaseSeverity;
  }): Promise<AnomalyCase[]> {
    let query = 'SELECT * FROM anomaly_cases WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (filters.organizationId) {
      query += ` AND organization_id = $${idx++}`;
      params.push(filters.organizationId);
    }
    if (filters.status) {
      query += ` AND status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.severity) {
      query += ` AND severity = $${idx++}`;
      params.push(filters.severity);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';
    const result = await this.pool.query(query, params);
    return result.rows.map((r) => this.mapRow(r));
  }

  private mapRow(row: any): AnomalyCase {
    return {
      id: row.id,
      organizationId: row.organization_id,
      findingId: row.finding_id,
      status: row.status,
      severity: row.severity,
      title: row.title,
      description: row.description,
      assignedTo: row.assigned_to,
      resolution: row.resolution,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
