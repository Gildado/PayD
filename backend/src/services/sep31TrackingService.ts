/**
 * SEP-31 Cross-Border Payment Tracking Service
 * Coordinates status updates, validation, and notification dispatch.
 */

import { Pool } from 'pg';

export interface Sep31Transaction {
  id: string;
  organizationId: number;
  senderId: string;
  receiverId: string;
  amount: string;
  assetCode: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  stellarTxHash?: string;
  errorMessage?: string;
  updatedAt: Date;
}

export class Sep31TrackingService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getTransaction(id: string): Promise<Sep31Transaction | null> {
    const res = await this.pool.query(
      'SELECT id, organization_id as "organizationId", sender_id as "senderId", receiver_id as "receiverId", amount, asset_code as "assetCode", status, stellar_tx_hash as "stellarTxHash", error_message as "errorMessage", updated_at as "updatedAt" FROM sep31_transactions WHERE id = $1',
      [id]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async updateStatus(id: string, status: Sep31Transaction['status'], stellarTxHash?: string, errorMessage?: string): Promise<Sep31Transaction> {
    const res = await this.pool.query(
      `UPDATE sep31_transactions 
       SET status = $2, stellar_tx_hash = COALESCE($3, stellar_tx_hash), error_message = $4, updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, organization_id as "organizationId", sender_id as "senderId", receiver_id as "receiverId", amount, asset_code as "assetCode", status, stellar_tx_hash as "stellarTxHash", error_message as "errorMessage", updated_at as "updatedAt"`,
      [id, status, stellarTxHash || null, errorMessage || null]
    );
    if (res.rows.length === 0) {
      throw new Error(`SEP-31 transaction not found: ${id}`);
    }
    return res.rows[0];
  }
}
