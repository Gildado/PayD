import { StellarService } from "./stellarService";
import { pool } from "../config/database";

export interface AuditRecord {
  id: number;
  tx_hash: string;
  ledger_sequence: number;
  stellar_created_at: string;
  envelope_xdr: string;
  result_xdr: string;
  source_account: string;
  fee_charged: number;
  operation_count: number;
  memo: string | null;
  successful: boolean;
  created_at: string;
}

export class TransactionAuditService {
  /**
   * Fetch a confirmed transaction from Horizon by hash,
   * then store it as an immutable audit record in the DB.
   * Returns the existing record if the hash was already audited.
   */
  static async fetchAndStore(txHash: string): Promise<AuditRecord> {
    // Check if already stored
    const existing = await pool.query(
      "SELECT * FROM transaction_audit_logs WHERE tx_hash = $1",
      [txHash]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    // Fetch from Horizon
    const server = StellarService.getServer();
    const tx = await server.transactions().transaction(txHash).call();

    const result = await pool.query(
      `INSERT INTO transaction_audit_logs
        (tx_hash, ledger_sequence, stellar_created_at, envelope_xdr,
         result_xdr, source_account, fee_charged, operation_count,
         memo, successful)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        tx.hash,
        tx.ledger_attr,
        tx.created_at,
        tx.envelope_xdr,
        tx.result_xdr,
        tx.source_account,
        parseInt(tx.fee_charged.toString(), 10),
        tx.operation_count,
        tx.memo || null,
        tx.successful,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get a stored audit record by transaction hash.
   */
  static async getByHash(txHash: string): Promise<AuditRecord | null> {
    const result = await pool.query(
      "SELECT * FROM transaction_audit_logs WHERE tx_hash = $1",
      [txHash]
    );
    return result.rows[0] || null;
  }

  /**
   * List audit records with pagination, optionally filtered by source account.
   */
  static async list(
    page: number = 1,
    limit: number = 20,
    sourceAccount?: string
  ): Promise<{ data: AuditRecord[]; total: number }> {
    const offset = (page - 1) * limit;
    const values: (string | number)[] = [];
    let paramIdx = 1;

    let where = "";
    if (sourceAccount) {
      where = `WHERE source_account = $${paramIdx++}`;
      values.push(sourceAccount);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM transaction_audit_logs ${where}`,
      values.slice()
    );
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT * FROM transaction_audit_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      values
    );

    return { data: dataResult.rows, total };
  }

  /**
   * Re-fetch a transaction from Horizon and compare with the stored record
   * to verify integrity. Returns whether the stored XDR still matches.
   */
  static async verify(
    txHash: string
  ): Promise<{ verified: boolean; record: AuditRecord | null }> {
    const record = await TransactionAuditService.getByHash(txHash);
    if (!record) return { verified: false, record: null };

    const server = StellarService.getServer();
    const tx = await server.transactions().transaction(txHash).call();

    const verified =
      record.envelope_xdr === tx.envelope_xdr &&
      record.result_xdr === tx.result_xdr &&
      record.ledger_sequence === tx.ledger_attr;

    return { verified, record };
  }
}
