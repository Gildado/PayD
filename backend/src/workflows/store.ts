import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { pool } from '../config/database.js';
import { WorkflowError } from './runtime.js';

export type WorkflowKind =
  | 'freeze-appeal'
  | 'contributor-reward'
  | 'contract-upgrade-proposal'
  | 'revenue-split-distribution'
  | 'revenue-split-recipients'
  | 'vesting-release-notification'
  | 'workflow-notification-delivery';
export interface WorkflowRecord {
  id: string;
  organization_id: number;
  kind: WorkflowKind;
  reference: string;
  status: string;
  data: Record<string, unknown>;
}

export interface WorkflowStore {
  create(
    organizationId: number,
    kind: WorkflowKind,
    reference: string,
    status: string,
    data: Record<string, unknown>
  ): Promise<WorkflowRecord>;
  get(organizationId: number, id: string): Promise<WorkflowRecord>;
  list(organizationId: number, kind: WorkflowKind): Promise<WorkflowRecord[]>;
  transition(
    record: WorkflowRecord,
    status: string,
    data?: Record<string, unknown>
  ): Promise<WorkflowRecord>;
}

/** All queries bind the authenticated organization, including reads and transitions. */
export class PostgresWorkflowStore implements WorkflowStore {
  constructor(private readonly db: Pick<Pool, 'query'> = pool) {}

  async create(
    organizationId: number,
    kind: WorkflowKind,
    reference: string,
    status: string,
    data: Record<string, unknown>
  ): Promise<WorkflowRecord> {
    const result = await this.db.query<WorkflowRecord>(
      `INSERT INTO orchestration_records (id, organization_id, kind, reference, status, data)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (organization_id, kind, reference) DO UPDATE SET reference = EXCLUDED.reference
       RETURNING *`,
      [randomUUID(), organizationId, kind, reference, status, JSON.stringify(data)]
    );
    return result.rows[0]!;
  }

  async get(organizationId: number, id: string): Promise<WorkflowRecord> {
    const result = await this.db.query<WorkflowRecord>(
      'SELECT * FROM orchestration_records WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    if (!result.rows[0]) throw new WorkflowError('NOT_FOUND', 'Workflow resource not found.', 404);
    return result.rows[0];
  }

  async list(organizationId: number, kind: WorkflowKind): Promise<WorkflowRecord[]> {
    const result = await this.db.query<WorkflowRecord>(
      `SELECT * FROM orchestration_records WHERE organization_id = $1 AND kind = $2
       ORDER BY created_at DESC LIMIT 100`,
      [organizationId, kind]
    );
    return result.rows;
  }

  async transition(
    record: WorkflowRecord,
    status: string,
    data = record.data
  ): Promise<WorkflowRecord> {
    const result = await this.db.query<WorkflowRecord>(
      `UPDATE orchestration_records SET status = $4, data = $5::jsonb, updated_at = NOW()
       WHERE organization_id = $1 AND id = $2 AND status = $3 RETURNING *`,
      [record.organization_id, record.id, record.status, status, JSON.stringify(data)]
    );
    if (!result.rows[0])
      throw new WorkflowError('CONFLICT', 'Workflow state changed. Reload its status.', 409);
    return result.rows[0];
  }
}
