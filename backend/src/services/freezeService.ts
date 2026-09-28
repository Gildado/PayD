import { Asset, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { StellarService } from './stellarService.js';
import { pool } from '../config/database.js';
import { TransactionVerificationQueueService } from './transactionVerificationQueueService.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The two supported freeze actions. */
export type FreezeAction = 'freeze' | 'unfreeze';

/** Scope of the freeze: a single account or the whole asset class. */
export type FreezeScope = 'account' | 'global';

/** Single freeze-log row from the DB. */
export interface FreezeLogRecord {
  id: number;
  target_account: string;
  asset_code: string;
  asset_issuer: string;
  action: FreezeAction;
  scope: FreezeScope;
  tx_hash: string | null;
  initiated_by: string;
  reason: string | null;
  created_at: string;
}

/** Outcome returned to callers after executing a freeze / unfreeze. */
export interface FreezeResult {
  txHash: string;
  action: FreezeAction;
  scope: FreezeScope;
  targetAccount: string;
  assetCode: string;
  assetIssuer: string;
}

/** Paginated list of freeze-log records. */
export interface FreezePage {
  data: FreezeLogRecord[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Internal helpers  (not exported – keep surface area minimal)
// ---------------------------------------------------------------------------

/**
 * Persist an audit entry to account_freeze_logs.
 * Called after every successful on-chain operation.
 *
 * Time complexity : O(1) – single INSERT
 * Space complexity: O(1)
 */
async function writeAuditLog(params: {
  targetAccount: string;
  assetCode: string;
  assetIssuer: string;
  action: FreezeAction;
  scope: FreezeScope;
  txHash: string | null;
  initiatedBy: string;
  reason?: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO account_freeze_logs
       (target_account, asset_code, asset_issuer, action, scope,
        tx_hash, initiated_by, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      params.targetAccount,
      params.assetCode,
      params.assetIssuer,
      params.action,
      params.scope,
      params.txHash ?? null,
      params.initiatedBy,
      params.reason ?? null,
    ]
  );
}

/**
 * Persist multiple audit entries in a single parameterized INSERT.
 * Replaces N individual writeAuditLog calls in toggleGlobalFreeze,
 * reducing DB round-trips from O(n) to O(1) per batch.
 *
 * Time complexity : O(r) – builds one VALUES list of r ≤ BATCH_SIZE rows.
 * Space complexity: O(r).
 */
async function writeBulkAuditLog(
  rows: Array<{
    targetAccount: string;
    assetCode: string;
    assetIssuer: string;
    action: FreezeAction;
    scope: FreezeScope;
    txHash: string | null;
    initiatedBy: string;
    reason?: string;
  }>
): Promise<void> {
  if (rows.length === 0) return;

  const COLS = 8;
  const placeholders = rows
    .map(
      (_, i) =>
        `($${i * COLS + 1},$${i * COLS + 2},$${i * COLS + 3},$${i * COLS + 4},$${i * COLS + 5},$${i * COLS + 6},$${i * COLS + 7},$${i * COLS + 8})`
    )
    .join(', ');

  const values = rows.flatMap((r) => [
    r.targetAccount,
    r.assetCode,
    r.assetIssuer,
    r.action,
    r.scope,
    r.txHash ?? null,
    r.initiatedBy,
    r.reason ?? null,
  ]);

  await pool.query(
    `INSERT INTO account_freeze_logs
       (target_account, asset_code, asset_issuer, action, scope,
        tx_hash, initiated_by, reason)
     VALUES ${placeholders}`,
    values
  );
}

/**
 * Build a setTrustLineFlags operation that freezes or unfreezes a trustline.
 *
 * Stellar trustline authorization:
 *   authorized: true  → account can send/receive the asset (unfrozen)
 *   authorized: false → transfers are blocked (frozen)
 *
 * The issuer account MUST have AuthRevocableFlag enabled for this to work.
 */
function buildSetTrustLineFlagsOp(
  trustor: string,
  asset: Asset,
  action: FreezeAction
): ReturnType<typeof Operation.setTrustLineFlags> {
  return Operation.setTrustLineFlags({
    trustor,
    asset,
    flags: {
      // freeze → revoke authorization; unfreeze → restore it
      authorized: action === 'unfreeze',
    },
  });
}

// ---------------------------------------------------------------------------
// FreezeService
// ---------------------------------------------------------------------------

export class FreezeService {
  // -------------------------------------------------------------------------
  // Core operations
  // -------------------------------------------------------------------------

  /**
   * Freeze or unfreeze a **single account's** trustline for the given asset.
   *
   * The issuer keypair signs a `setTrustLineFlags` operation that clears
   * (freeze) or restores (unfreeze) the AUTHORIZED flag on the target's
   * trustline, preventing or allowing asset transfers respectively.
   *
   * Time  complexity: O(1) – one Horizon round-trip + one DB write.
   * Space complexity: O(1).
   *
   * @param issuerKeypair  - Stellar keypair of the asset issuer (admin).
   * @param targetAccount  - Public key of the account to freeze/unfreeze.
   * @param assetCode      - Asset code (e.g. "ORGUSD").
   * @param action         - "freeze" | "unfreeze".
   * @param reason         - Optional human-readable justification.
   */
  static async toggleAccountFreeze(
    issuerKeypair: Keypair,
    targetAccount: string,
    assetCode: string,
    action: FreezeAction,
    reason?: string
  ): Promise<FreezeResult> {
    const assetIssuer = issuerKeypair.publicKey();
    const asset = new Asset(assetCode, assetIssuer);
    const server = StellarService.getServer();
    const networkPassphrase = StellarService.getNetworkPassphrase();

    const issuerAccount = await server.loadAccount(assetIssuer);

    const transaction = new TransactionBuilder(issuerAccount, {
      fee: '500', // slightly higher fee for flag ops to reduce rejection risk
      networkPassphrase,
    })
      .addOperation(buildSetTrustLineFlagsOp(targetAccount, asset, action))
      .setTimeout(60)
      .build();

    transaction.sign(issuerKeypair);

    const simulation = await StellarService.simulateTransaction(transaction);
    if (!simulation.success) {
      throw new Error(
        `Transaction simulation failed: ${simulation.errorMessage}. ` +
          `This freeze operation would likely fail on-chain. ` +
          `Please verify the account exists and the asset trustline is established.`
      );
    }

    const result = await server.submitTransaction(transaction);

    await writeAuditLog({
      targetAccount,
      assetCode,
      assetIssuer,
      action,
      scope: 'account',
      txHash: result.hash,
      initiatedBy: assetIssuer,
      reason,
    });

    // Verify on-chain & store immutable audit record (async).
    try {
      await TransactionVerificationQueueService.enqueue({
        txHash: result.hash,
        source: 'freeze',
      });
    } catch {
      // Best-effort; the core freeze operation already succeeded on-chain.
    }

    return {
      txHash: result.hash,
      action,
      scope: 'account',
      targetAccount,
      assetCode,
      assetIssuer,
    };
  }

  /**
   * Freeze or unfreeze **all accounts** holding the given asset globally.
   *
   * Iterates over every page of trustline holders from Horizon.
   * Each account receives its own `setTrustLineFlags` operation – Stellar
   * limits a transaction to 100 operations, so holders are batched
   * accordingly.
   *
   * Time  complexity: O(n) where n = number of trustline holders.
   * Space complexity: O(b) where b = batch size (≤ 100).
   *
   * @param issuerKeypair - Stellar keypair of the asset issuer (admin).
   * @param assetCode     - Asset code (e.g. "ORGUSD").
   * @param action        - "freeze" | "unfreeze".
   * @param reason        - Optional human-readable justification.
   * @returns Array of FreezeResults per submitted batch transaction.
   */
  static async toggleGlobalFreeze(
    issuerKeypair: Keypair,
    assetCode: string,
    action: FreezeAction,
    reason?: string
  ): Promise<FreezeResult[]> {
    const assetIssuer = issuerKeypair.publicKey();
    const asset = new Asset(assetCode, assetIssuer);
    const server = StellarService.getServer();
    const networkPassphrase = StellarService.getNetworkPassphrase();

    /** Stellar hard limit on operations per transaction. */
    const BATCH_SIZE = 100;
    const results: FreezeResult[] = [];

    // Paginate through all trustline holders
    let page = await server.accounts().forAsset(asset).limit(200).call();

    while (page.records.length > 0) {
      // Split into batches of BATCH_SIZE
      for (let i = 0; i < page.records.length; i += BATCH_SIZE) {
        const batch = page.records.slice(i, i + BATCH_SIZE);

        const issuerAccount = await server.loadAccount(assetIssuer);

        const builder = new TransactionBuilder(issuerAccount, {
          fee: '500',
          networkPassphrase,
        }).setTimeout(60);

        for (const holder of batch) {
          // Skip the issuer account itself — it does not hold its own asset via trustline
          if (holder.account_id === assetIssuer) continue;

          builder.addOperation(buildSetTrustLineFlagsOp(holder.account_id, asset, action));
        }

        const transaction = builder.build();
        transaction.sign(issuerKeypair);

        const txResult = await server.submitTransaction(transaction);

        // Collect valid holders (skip issuer — it doesn't hold its own trustline)
        const validHolders = batch.filter((h) => h.account_id !== assetIssuer);

        // Verify on-chain & store immutable audit record (async).
        try {
          await TransactionVerificationQueueService.enqueue({
            txHash: txResult.hash,
            source: 'freeze',
          });
        } catch {
          // Best-effort
        }

        // Single bulk INSERT instead of N round-trips
        await writeBulkAuditLog(
          validHolders.map((h) => ({
            targetAccount: h.account_id,
            assetCode,
            assetIssuer,
            action,
            scope: 'global' as FreezeScope,
            txHash: txResult.hash,
            initiatedBy: assetIssuer,
            reason,
          }))
        );

        for (const holder of validHolders) {
          results.push({
            txHash: txResult.hash,
            action,
            scope: 'global',
            targetAccount: holder.account_id,
            assetCode,
            assetIssuer,
          });
        }
      }

      // Advance pagination cursor
      if (page.records.length < 200) break;
      page = await page.next();
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Query helpers
  // -------------------------------------------------------------------------

  /**
   * Check whether a specific account's trustline is currently frozen
   * by inspecting the AUTHORIZED flag from Horizon.
   *
   * Time  complexity: O(1) – single Horizon call.
   * Space complexity: O(b) where b = number of asset balances on the account.
   */
  static async isFrozen(
    targetAccount: string,
    assetCode: string,
    assetIssuer: string
  ): Promise<boolean> {
    const server = StellarService.getServer();

    try {
      const account = await server.loadAccount(targetAccount);

      const trustline = account.balances.find(
        (b: any) =>
          b.asset_type !== 'native' && b.asset_code === assetCode && b.asset_issuer === assetIssuer
      ) as any | undefined;

      if (!trustline) return false; // no trustline ↔ not relevant

      // is_authorized === false means the issuer revoked the flag (frozen)
      return trustline.is_authorized === false;
    } catch (error: any) {
      if (error?.response?.status === 404) return false;
      throw error;
    }
  }

  /**
   * Paginated listing of freeze/unfreeze audit logs.
   *
   * Supports filtering by target account and/or action.
   *
   * Time  complexity: O(k) where k = limit (bounded by caller).
   * Space complexity: O(k).
   */
  static async listLogs(options: {
    page?: number;
    limit?: number;
    targetAccount?: string;
    action?: FreezeAction;
    assetCode?: string;
  }): Promise<FreezePage> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const offset = (page - 1) * limit;

    /** Build WHERE clause dynamically to avoid N+1 query variants. */
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    let idx = 1;

    if (options.targetAccount) {
      conditions.push(`target_account = $${idx++}`);
      values.push(options.targetAccount);
    }
    if (options.action) {
      conditions.push(`action = $${idx++}`);
      values.push(options.action);
    }
    if (options.assetCode) {
      conditions.push(`asset_code = $${idx++}`);
      values.push(options.assetCode);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // COUNT query (same params, no limit/offset)
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM account_freeze_logs ${where}`,
      values.slice() // copy to prevent mutation
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Data query
    values.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT * FROM account_freeze_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      values
    );

    return { data: dataResult.rows, total, page, limit };
  }

  /**
   * Get the most recent freeze-log entry for an account + asset combination.
   *
   * Time  complexity: O(log n) – uses index on (target_account, created_at).
   * Space complexity: O(1).
   */
  static async getLatestLog(
    targetAccount: string,
    assetCode: string,
    assetIssuer: string
  ): Promise<FreezeLogRecord | null> {
    const result = await pool.query(
      `SELECT * FROM account_freeze_logs
       WHERE target_account = $1
         AND asset_code     = $2
         AND asset_issuer   = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [targetAccount, assetCode, assetIssuer]
    );
    return result.rows[0] ?? null;
  }
}
