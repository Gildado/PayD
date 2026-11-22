/**
 * AnchorPollingManager
 * 
 * Manages polling state for anchor transactions, tracking cursor position and poll status.
 * Enables resumable polling from last cursor and timeout handling.
 */

import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

export type PollingStatus = 'pending' | 'polling' | 'completed' | 'failed' | 'timeout';

export interface AnchorPollingState {
  id: number;
  organization_id: number;
  anchor_domain: string;
  transaction_id: string;
  cursor: string | null;
  last_polled_at: Date | null;
  status: PollingStatus;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface InitializePollingOptions {
  maxRetries?: number;
}

export class AnchorPollingManager {
  /**
   * Initializes polling state for a new anchor transaction
   * Creates a tracking record if it doesn't already exist
   */
  static async initializePolling(
    organization_id: number,
    anchor_domain: string,
    transaction_id: string,
    options: InitializePollingOptions = {}
  ): Promise<AnchorPollingState> {
    const maxRetries = options.maxRetries || 3;

    const result = await pool.query(
      `INSERT INTO anchor_polling_state
        (organization_id, anchor_domain, transaction_id, status, max_retries)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (organization_id, anchor_domain, transaction_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         max_retries = EXCLUDED.max_retries,
         updated_at = NOW()
       RETURNING *`,
      [organization_id, anchor_domain, transaction_id, 'pending', maxRetries]
    );

    return this.formatState(result.rows[0]);
  }

  /**
   * Updates the polling cursor position after successful poll
   * Saves progress to allow resuming from this point
   */
  static async updateCursor(
    organization_id: number,
    anchor_domain: string,
    transaction_id: string,
    cursor: string
  ): Promise<AnchorPollingState> {
    const result = await pool.query(
      `UPDATE anchor_polling_state
       SET cursor = $4, last_polled_at = NOW(), updated_at = NOW()
       WHERE organization_id = $1 AND anchor_domain = $2 AND transaction_id = $3
       RETURNING *`,
      [organization_id, anchor_domain, transaction_id, cursor]
    );

    if (result.rows.length === 0) {
      throw new Error(
        `Polling state not found for org=${organization_id}, domain=${anchor_domain}, txId=${transaction_id}`
      );
    }

    return this.formatState(result.rows[0]);
  }

  /**
   * Updates polling status and optionally error message
   */
  static async updateStatus(
    organization_id: number,
    anchor_domain: string,
    transaction_id: string,
    status: PollingStatus,
    errorMessage?: string | null
  ): Promise<AnchorPollingState> {
    const result = await pool.query(
      `UPDATE anchor_polling_state
       SET status = $4, error_message = $5, updated_at = NOW()
       WHERE organization_id = $1 AND anchor_domain = $2 AND transaction_id = $3
       RETURNING *`,
      [organization_id, anchor_domain, transaction_id, status, errorMessage || null]
    );

    if (result.rows.length === 0) {
      throw new Error(
        `Polling state not found for org=${organization_id}, domain=${anchor_domain}, txId=${transaction_id}`
      );
    }

    return this.formatState(result.rows[0]);
  }

  /**
   * Retrieves current polling status
   */
  static async getPollingStatus(
    organization_id: number,
    anchor_domain: string,
    transaction_id: string
  ): Promise<AnchorPollingState | null> {
    const result = await pool.query(
      `SELECT * FROM anchor_polling_state
       WHERE organization_id = $1 AND anchor_domain = $2 AND transaction_id = $3`,
      [organization_id, anchor_domain, transaction_id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatState(result.rows[0]);
  }

  /**
   * Checks if polling should be retried
   * Returns true if retry_count < max_retries and next_retry_at has passed
   */
  static async shouldRetryPolling(
    organization_id: number,
    anchor_domain: string,
    transaction_id: string
  ): Promise<boolean> {
    const state = await this.getPollingStatus(organization_id, anchor_domain, transaction_id);

    if (!state) {
      return false;
    }

    if (state.retry_count >= state.max_retries) {
      return false;
    }

    if (state.status === 'completed' || state.status === 'timeout') {
      return false;
    }

    if (state.next_retry_at && new Date() < state.next_retry_at) {
      return false;
    }

    return true;
  }

  /**
   * Increments retry count and sets next retry time (exponential backoff)
   */
  static async incrementRetry(
    organization_id: number,
    anchor_domain: string,
    transaction_id: string,
    backoffMultiplier: number = 2
  ): Promise<AnchorPollingState> {
    const state = await this.getPollingStatus(organization_id, anchor_domain, transaction_id);

    if (!state) {
      throw new Error(
        `Polling state not found for org=${organization_id}, domain=${anchor_domain}, txId=${transaction_id}`
      );
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    const backoffMs = 1000 * Math.pow(backoffMultiplier, state.retry_count);
    const nextRetryAt = new Date(Date.now() + backoffMs);

    const result = await pool.query(
      `UPDATE anchor_polling_state
       SET retry_count = retry_count + 1, next_retry_at = $4, updated_at = NOW()
       WHERE organization_id = $1 AND anchor_domain = $2 AND transaction_id = $3
       RETURNING *`,
      [organization_id, anchor_domain, transaction_id, nextRetryAt]
    );

    return this.formatState(result.rows[0]);
  }

  /**
   * Resumes polling from last known cursor position
   * Returns polling state with cursor information
   */
  static async resumePolling(
    organization_id: number,
    anchor_domain: string,
    transaction_id: string
  ): Promise<AnchorPollingState> {
    const state = await this.getPollingStatus(organization_id, anchor_domain, transaction_id);

    if (!state) {
      throw new Error(
        `Polling state not found for org=${organization_id}, domain=${anchor_domain}, txId=${transaction_id}`
      );
    }

    // Update status to 'polling'
    const result = await pool.query(
      `UPDATE anchor_polling_state
       SET status = 'polling', updated_at = NOW()
       WHERE organization_id = $1 AND anchor_domain = $2 AND transaction_id = $3
       RETURNING *`,
      [organization_id, anchor_domain, transaction_id]
    );

    return this.formatState(result.rows[0]);
  }

  /**
   * Finds all polling states that are stuck or incomplete
   * Useful for cleanup and manual intervention
   */
  static async findStuckPolling(
    organization_id?: number,
    maxAgeMinutes: number = 60
  ): Promise<AnchorPollingState[]> {
    const params: any[] = [maxAgeMinutes];
    let whereClause = `updated_at < NOW() - INTERVAL '${maxAgeMinutes} minutes'
      AND status IN ('pending', 'polling')`;

    if (organization_id) {
      params.unshift(organization_id);
      whereClause = `organization_id = $1 AND ${whereClause}`;
    }

    const result = await pool.query(
      `SELECT * FROM anchor_polling_state
       WHERE ${whereClause}
       ORDER BY updated_at ASC`
    );

    return result.rows.map((row) => this.formatState(row));
  }

  /**
   * Marks polling as completed
   */
  static async markCompleted(
    organization_id: number,
    anchor_domain: string,
    transaction_id: string
  ): Promise<AnchorPollingState> {
    return this.updateStatus(organization_id, anchor_domain, transaction_id, 'completed');
  }

  /**
   * Marks polling as failed with error message
   */
  static async markFailed(
    organization_id: number,
    anchor_domain: string,
    transaction_id: string,
    errorMessage: string
  ): Promise<AnchorPollingState> {
    return this.updateStatus(organization_id, anchor_domain, transaction_id, 'failed', errorMessage);
  }

  /**
   * Marks polling as timeout
   */
  static async markTimeout(
    organization_id: number,
    anchor_domain: string,
    transaction_id: string
  ): Promise<AnchorPollingState> {
    const errorMessage = `Polling timed out after ${new Date().toISOString()}`;
    return this.updateStatus(organization_id, anchor_domain, transaction_id, 'timeout', errorMessage);
  }

  /**
   * Retrieves all polling states for an organization
   */
  static async findByOrganization(
    organization_id: number,
    statuses?: PollingStatus[],
    options: { page?: number; limit?: number } = {}
  ): Promise<{ data: AnchorPollingState[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    let countQuery = `SELECT COUNT(*) as count FROM anchor_polling_state WHERE organization_id = $1`;
    let dataQuery = `SELECT * FROM anchor_polling_state WHERE organization_id = $1`;
    const params: any[] = [organization_id];

    if (statuses && statuses.length > 0) {
      countQuery += ` AND status = ANY($2)`;
      dataQuery += ` AND status = ANY($2)`;
      params.push(statuses);
    }

    const countResult = await pool.query(countQuery, [params[0], params[1]]);
    const total = parseInt(countResult.rows[0].count, 10);

    dataQuery += ` ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const dataResult = await pool.query(dataQuery, params);

    return {
      data: dataResult.rows.map((row) => this.formatState(row)),
      total,
    };
  }

  /**
   * Cleans up old polling records (optional maintenance)
   * Deletes completed/failed records older than specified days
   */
  static async cleanupOldRecords(olderThanDays: number = 30): Promise<number> {
    const result = await pool.query(
      `DELETE FROM anchor_polling_state
       WHERE status IN ('completed', 'failed', 'timeout')
       AND updated_at < NOW() - INTERVAL '${olderThanDays} days'`
    );

    return result.rowCount || 0;
  }

  /**
   * Helper to format database row to AnchorPollingState
   */
  private static formatState(row: any): AnchorPollingState {
    return {
      id: row.id,
      organization_id: row.organization_id,
      anchor_domain: row.anchor_domain,
      transaction_id: row.transaction_id,
      cursor: row.cursor,
      last_polled_at: row.last_polled_at ? new Date(row.last_polled_at) : null,
      status: row.status as PollingStatus,
      error_message: row.error_message,
      retry_count: row.retry_count,
      max_retries: row.max_retries,
      next_retry_at: row.next_retry_at ? new Date(row.next_retry_at) : null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}
