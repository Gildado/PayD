import { Pool } from 'pg';
import crypto from 'crypto';
import logger from '../utils/logger.js';

export interface IdempotencyRecord {
  id: string;
  idempotency_key: string;
  request_hash: string;
  request_body: string;
  response_body: string;
  response_status: number;
  created_at: Date;
  organization_id?: string | null;
}

export class IdempotencyService {
  constructor(private dbPool: Pool) {}

  async ensureTableExists(): Promise<void> {
    try {
      await this.dbPool.query(`
        CREATE TABLE IF NOT EXISTS idempotency_records (
          id VARCHAR(64) PRIMARY KEY,
          idempotency_key VARCHAR(255) NOT NULL UNIQUE,
          request_hash VARCHAR(64) NOT NULL,
          request_body TEXT NOT NULL,
          response_body TEXT NOT NULL,
          response_status INTEGER NOT NULL,
          organization_id VARCHAR(64),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      
      await this.dbPool.query(
        'CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_records (idempotency_key)',
      );
      await this.dbPool.query(
        'CREATE INDEX IF NOT EXISTS idx_organization_id ON idempotency_records (organization_id)',
      );
      await this.dbPool.query(
        'CREATE INDEX IF NOT EXISTS idx_created_at ON idempotency_records (created_at)',
      );
    } catch (error) {
      logger.error('Failed to create idempotency_records table:', error);
      throw error;
    }
  }

  private hashRequestBody(body: any): string {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    return crypto.createHash('sha256').update(bodyString).digest('hex');
  }

  async getExistingResponse(
    idempotencyKey: string,
    organizationId?: string,
  ): Promise<IdempotencyRecord | null> {
    try {
      const query = organizationId
        ? `SELECT * FROM idempotency_records 
           WHERE idempotency_key = $1 AND organization_id = $2`
        : `SELECT * FROM idempotency_records WHERE idempotency_key = $1`;
      
      const params = organizationId ? [idempotencyKey, organizationId] : [idempotencyKey];
      const result = await this.dbPool.query<IdempotencyRecord>(query, params);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get existing idempotency response:', error);
      throw error;
    }
  }

  async recordRequest(
    idempotencyKey: string,
    requestBody: any,
    organizationId?: string,
  ): Promise<{ id: string; requestHash: string }> {
    const id = crypto.randomUUID();
    const requestHash = this.hashRequestBody(requestBody);
    const requestBodyStr = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);

    try {
      await this.dbPool.query(
        `INSERT INTO idempotency_records 
         (id, idempotency_key, request_hash, request_body, response_body, response_status, organization_id)
         VALUES ($1, $2, $3, $4, '', 0, $5)`,
        [id, idempotencyKey, requestHash, requestBodyStr, organizationId || null],
      );
      return { id, requestHash };
    } catch (error) {
      if ((error as any).code === '23505') {
        logger.warn(`Idempotency key already exists: ${idempotencyKey}`);
      }
      logger.error('Failed to record idempotency request:', error);
      throw error;
    }
  }

  async recordResponse(
    idempotencyRecordId: string,
    responseBody: any,
    responseStatus: number,
  ): Promise<void> {
    const responseBodyStr = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);

    try {
      await this.dbPool.query(
        `UPDATE idempotency_records 
         SET response_body = $1, response_status = $2 
         WHERE id = $3`,
        [responseBodyStr, responseStatus, idempotencyRecordId],
      );
    } catch (error) {
      logger.error('Failed to record idempotency response:', error);
      throw error;
    }
  }

  async cleanupOldRecords(daysOld: number = 30): Promise<number> {
    try {
      const result = await this.dbPool.query(
        `DELETE FROM idempotency_records 
         WHERE created_at < NOW() - INTERVAL '${daysOld} days'`,
      );
      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old idempotency records`);
      }
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old idempotency records:', error);
      throw error;
    }
  }
}

let idempotencyService: IdempotencyService | null = null;

export function initializeIdempotencyService(dbPool: Pool): IdempotencyService {
  idempotencyService = new IdempotencyService(dbPool);
  return idempotencyService;
}

export function getIdempotencyService(): IdempotencyService {
  if (!idempotencyService) {
    throw new Error('IdempotencyService not initialized');
  }
  return idempotencyService;
}
