import { StellarService } from './stellarService.js';
import { pool } from '../config/database.js';
import { emitTransactionUpdate } from './socketService.js';
import {
  buildCursorPage,
  buildKeysetClause,
  buildOrderBy,
  CursorOrdering,
  CursorPage,
  CursorPosition,
} from '../utils/cursorPagination.js';

const TRANSACTION_ORDERING: CursorOrdering = {
  sortColumn: 'created_at',
  idColumn: 'id',
  order: 'DESC',
};

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
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export class TransactionAuditService {
  /**
   * Fetch a confirmed transaction from Horizon by hash,
   * then store it as an immutable audit record in the DB.
   * Returns the existing record if the hash was already audited.
   */
  static async fetchAndStore(
    txHash: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditRecord> {
    // Check if already stored
    const existing = await pool.query('SELECT * FROM transaction_audit_logs WHERE tx_hash = $1', [
      txHash,
    ]);
    if (existing.rows.length > 0) return existing.rows[0];

    // Fetch from Horizon
    const server = StellarService.getServer();
    const tx = await server.transactions().transaction(txHash).call();

    const result = await pool.query(
      `INSERT INTO transaction_audit_logs
        (tx_hash, ledger_sequence, stellar_created_at, envelope_xdr,
         result_xdr, source_account, fee_charged, operation_count,
         memo, successful, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    const record: AuditRecord = result.rows[0];

    // Notify any WebSocket subscribers watching this transaction hash.
    emitTransactionUpdate(record.tx_hash, record.successful ? 'confirmed' : 'failed', {
      ledger: record.ledger_sequence,
      sourceAccount: record.source_account,
    });

    return record;
  }

  /**
   * Get a stored audit record by transaction hash.
   */
  static async getByHash(txHash: string): Promise<AuditRecord | null> {
    const result = await pool.query('SELECT * FROM transaction_audit_logs WHERE tx_hash = $1', [
      txHash,
    ]);
    return result.rows[0] || null;
  }

  /** Filters accepted by `list` and `listByCursor`. */
  private static buildFilterSql(filters: {
    sourceAccount?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    successful?: boolean;
  }): { conditions: string[]; values: (string | number | boolean)[]; nextIndex: number } {
    const { sourceAccount, search, dateFrom, dateTo, successful } = filters;
    const values: (string | number | boolean)[] = [];
    let paramIdx = 1;
    const conditions: string[] = [];

    if (sourceAccount) {
      conditions.push(`source_account = $${paramIdx++}`);
      values.push(sourceAccount);
    }

    if (search) {
      conditions.push(`(tx_hash ILIKE $${paramIdx} OR source_account ILIKE $${paramIdx})`);
      values.push(`%${search}%`);
      paramIdx++;
    }

    if (dateFrom) {
      conditions.push(`stellar_created_at >= $${paramIdx++}`);
      values.push(dateFrom);
    }

    if (dateTo) {
      conditions.push(`stellar_created_at <= $${paramIdx++}`);
      values.push(dateTo);
    }

    if (successful !== undefined) {
      conditions.push(`successful = $${paramIdx++}`);
      values.push(successful);
    }

    return { conditions, values, nextIndex: paramIdx };
  }

  /**
   * List audit records with pagination and optional filters.
   */
  static async list(
    page: number = 1,
    limit: number = 20,
    filters: {
      sourceAccount?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      successful?: boolean;
    } = {}
  ): Promise<{ data: AuditRecord[]; total: number }> {
    const offset = (page - 1) * limit;
    const { conditions, values, nextIndex } = TransactionAuditService.buildFilterSql(filters);
    let paramIdx = nextIndex;

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM transaction_audit_logs ${where}`,
      values.slice()
    );
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT * FROM transaction_audit_logs ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      values
    );

    return { data: dataResult.rows, total };
  }

  /**
   * Keyset-paginated listing (issue #1807). Ordered by created_at DESC, id DESC.
   * Fetches limit + 1 rows to determine `hasMore` without a COUNT query.
   */
  static async listByCursor(
    cursor: CursorPosition | null,
    limit: number,
    filters: {
      sourceAccount?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      successful?: boolean;
    } = {}
  ): Promise<CursorPage<AuditRecord>> {
    const { conditions, values, nextIndex } = TransactionAuditService.buildFilterSql(filters);
    const keyset = buildKeysetClause(TRANSACTION_ORDERING, cursor, nextIndex);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : 'WHERE TRUE';

    const result = await pool.query(
      `SELECT * FROM transaction_audit_logs ${where}${keyset.sql}
       ${buildOrderBy(TRANSACTION_ORDERING)}
       LIMIT $${keyset.nextIndex}`,
      [...values, ...keyset.values, limit + 1]
    );

    return buildCursorPage(result.rows as AuditRecord[], limit, TRANSACTION_ORDERING.sortColumn);
  }

  /**
   * Re-fetch a transaction from Horizon and compare with the stored record
   * to verify integrity. Returns whether the stored XDR still matches.
   */
  static async verify(txHash: string): Promise<{ verified: boolean; record: AuditRecord | null }> {
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

  /**
   * Attach or replace arbitrary metadata on an existing audit record.
   * Returns the updated record, or null if the hash is not found.
   */
  static async setMetadata(
    txHash: string,
    metadata: Record<string, unknown>
  ): Promise<AuditRecord | null> {
    const result = await pool.query(
      `UPDATE transaction_audit_logs
       SET metadata = $1
       WHERE tx_hash = $2
       RETURNING *`,
      [JSON.stringify(metadata), txHash]
    );
    return result.rows[0] ?? null;
  }
}
