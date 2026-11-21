import { createHash } from 'node:crypto';
import {
  Keypair,
  Asset,
  Operation,
  TransactionBuilder,
  Account,
  type Transaction,
} from '@stellar/stellar-sdk';
import { StellarService, isStellarInfrastructureFailure } from './stellarService.js';
import { circuitBreakerService } from './circuitBreakerService.js';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

export const MAX_OPS_PER_ENVELOPE = 100;
const FEE_MULTIPLIER_PER_OP = 1000;
const TX_TIMEOUT_SECONDS = 180;

export interface BulkPaymentItem {
  destination: string;
  amount: string;
  referenceId?: string;
}

export interface EnvelopeResult {
  envelopeIndex: number;
  txHash?: string;
  successful: boolean;
  itemCount: number;
  error?: string;
}

export interface BulkPaymentBatchResult {
  batchId: string;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  envelopes: EnvelopeResult[];
}

export interface BulkPaymentOptions {
  organizationId?: number;
  assetCode?: string;
  assetIssuer?: string;
  feeBumpFeePerOp?: number;
  idempotencyKey?: string;
  batchId?: string;
}

interface StoredBatch {
  batch_id: string;
  organization_id?: number | null;
  total_items?: number;
  successful_items?: number;
  failed_items?: number;
  status: string;
  idempotency_key?: string | null;
  request_fingerprint?: string | null;
}

interface StoredEnvelope {
  id?: number;
  batch_id: string;
  envelope_index: number;
  item_count: number;
  source_sequence?: string | null;
  inner_xdr?: string | null;
  inner_hash?: string | null;
  fee_bump_xdr?: string | null;
  fee_bump_hash?: string | null;
  tx_hash?: string | null;
  status: string;
  attempts?: number;
  error_message?: string | null;
}

interface BuiltEnvelope {
  xdr: string;
  hash: string;
  sequence: string;
}

interface Receipt {
  successful: boolean;
  hash: string;
}

type QueryResult = { rows?: Record<string, any>[] };

export class BulkPaymentService {
  /**
   * Submit up to 100 payments per Stellar transaction envelope.
   * Signed envelopes and per-item state are persisted before any submission,
   * so a process killed mid-batch can resume with the original batchId.
   */
  static async submitBatch(
    sourceKeypair: Keypair,
    items: BulkPaymentItem[],
    options: BulkPaymentOptions = {}
  ): Promise<BulkPaymentBatchResult> {
    const resuming = Boolean(options.batchId);
    if (!resuming && items.length === 0) {
      throw new Error('Payment batch must contain at least one item.');
    }

    const assetCode = options.assetCode ?? 'XLM';
    const asset =
      assetCode === 'XLM' ? Asset.native() : new Asset(assetCode, options.assetIssuer ?? '');
    const networkPassphrase = StellarService.getNetworkPassphrase();

    let batch: StoredBatch;
    let envelopes: StoredEnvelope[];
    let chunks: BulkPaymentItem[][] = [];

    if (resuming) {
      batch = await this.loadBatch(options.batchId!, options.organizationId);
      envelopes = await this.loadEnvelopes(batch.batch_id);
      if (envelopes.length === 0) {
        throw new Error('Bulk payment batch has no persisted envelopes and cannot be resumed.');
      }
      await this.markResumed(batch.batch_id, batch.status);
    } else {
      const fingerprint = this.requestFingerprint(
        sourceKeypair.publicKey(),
        items,
        assetCode,
        options.assetIssuer
      );
      batch = await this.createBatchRecord(
        sourceKeypair.publicKey(),
        items,
        assetCode,
        options.assetIssuer,
        options.organizationId,
        options.idempotencyKey,
        fingerprint
      );
      chunks = this.chunk(items, MAX_OPS_PER_ENVELOPE);
      const server = StellarService.getServer();
      const accountResponse = await server.loadAccount(sourceKeypair.publicKey());
      let currentSequence = BigInt(accountResponse.sequenceNumber());

      const built = chunks.map((chunk) => {
        const accountSequence = currentSequence;
        currentSequence += BigInt(1);
        const tx = this.buildTransaction(
          sourceKeypair,
          accountSequence,
          chunk,
          asset,
          networkPassphrase
        );
        return { ...tx, itemCount: chunk.length };
      });

      envelopes = [];
      for (let i = 0; i < built.length; i++) {
        envelopes.push(await this.claimEnvelope(batch.batch_id, i, built[i]!, built[i]!.itemCount));
      }
    }

    const results: EnvelopeResult[] = [];
    let successfulItems = 0;
    let failedItems = 0;
    let interrupted = false;

    for (let i = 0; i < envelopes.length; i++) {
      const envelope = envelopes[i]!;
      if (envelope.status === 'completed') {
        results.push(this.completedResult(envelope));
        successfulItems += envelope.item_count;
        continue;
      }
      if (envelope.status === 'failed') {
        results.push({
          envelopeIndex: envelope.envelope_index,
          itemCount: envelope.item_count,
          successful: false,
          error: envelope.error_message ?? 'Payment envelope previously failed.',
        });
        failedItems += envelope.item_count;
        continue;
      }

      const processed = await this.processEnvelope({
        batchId: batch.batch_id,
        envelope,
        sourceKeypair,
        networkPassphrase,
        feeBumpFeePerOp: options.feeBumpFeePerOp ?? FEE_MULTIPLIER_PER_OP * 5,
      });
      results.push(processed.result);
      if (processed.result.successful) successfulItems += envelope.item_count;
      else failedItems += envelope.item_count;
      if (processed.interrupted) {
        interrupted = true;
        await this.markInterrupted(batch.batch_id);
        break;
      }
    }

    const status = interrupted
      ? 'interrupted'
      : failedItems === 0
        ? 'completed'
        : successfulItems === 0
          ? 'failed'
          : 'partial';
    await this.finalizeBatch(batch.batch_id, status, successfulItems, failedItems);

    return {
      batchId: batch.batch_id,
      totalItems: chunks.length > 0 ? items.length : (batch.total_items ?? items.length),
      successfulItems,
      failedItems,
      envelopes: results,
    };
  }

  private static async processEnvelope(args: {
    batchId: string;
    envelope: StoredEnvelope;
    sourceKeypair: Keypair;
    networkPassphrase: string;
    feeBumpFeePerOp: number;
  }): Promise<{ result: EnvelopeResult; interrupted: boolean }> {
    const { batchId, envelope, networkPassphrase, sourceKeypair } = args;
    const result: EnvelopeResult = {
      envelopeIndex: envelope.envelope_index,
      itemCount: envelope.item_count,
      successful: false,
    };

    const innerXdr = envelope.inner_xdr;
    if (!innerXdr) {
      const error = 'Persisted envelope has no signed XDR; operator reconciliation is required.';
      await this.markInterrupted(batchId);
      result.error = error;
      return { result, interrupted: true };
    }

    try {
      const receipt = await this.lookupReceipt(envelope);
      if (receipt) {
        result.txHash = receipt.hash;
        result.successful = receipt.successful;
        if (receipt.successful) {
          await this.markEnvelopeComplete(batchId, envelope.envelope_index, receipt.hash);
        } else {
          result.error = 'Transaction failed on ledger.';
          await this.markEnvelopeFailed(batchId, envelope.envelope_index, result.error);
        }
        return { result, interrupted: false };
      }

      const useFeeBump = Boolean(envelope.fee_bump_xdr);
      const xdr = useFeeBump ? envelope.fee_bump_xdr! : innerXdr;
      const submitted = await StellarService.submitTransaction(
        this.transactionFromXDR(xdr, networkPassphrase, useFeeBump)
      );
      result.txHash = submitted.hash;
      result.successful = true;
      await this.markEnvelopeComplete(batchId, envelope.envelope_index, submitted.hash);
      return { result, interrupted: false };
    } catch (error: any) {
      logger.error(
        `Bulk payment envelope ${envelope.envelope_index + 1} failed: ${error?.message ?? error}`
      );
      if (isStellarInfrastructureFailure(error)) {
        await this.markEnvelopeInFlight(batchId, envelope.envelope_index, error?.message ?? error);
        result.error = error?.message ?? 'Bulk payment submission was interrupted.';
        return { result, interrupted: true };
      }

      const feeBump = this.buildFeeBump(
        error,
        innerXdr,
        sourceKeypair,
        networkPassphrase,
        args.feeBumpFeePerOp,
        envelope.item_count
      );
      if (feeBump) {
        try {
          const persisted = await this.persistFeeBump(batchId, envelope.envelope_index, feeBump);
          const bumpReceipt = await this.lookupReceipt({
            ...envelope,
            fee_bump_xdr: persisted.xdr,
            fee_bump_hash: persisted.hash,
          });
          if (bumpReceipt) {
            result.txHash = bumpReceipt.hash;
            result.successful = bumpReceipt.successful;
            if (bumpReceipt.successful) {
              await this.markEnvelopeComplete(batchId, envelope.envelope_index, bumpReceipt.hash);
            } else {
              result.error = 'Fee-bumped transaction failed on ledger.';
              await this.markEnvelopeFailed(batchId, envelope.envelope_index, result.error);
            }
            return { result, interrupted: false };
          }
          const bumped = await StellarService.submitTransaction(
            this.transactionFromXDR(persisted.xdr, networkPassphrase, true)
          );
          result.txHash = bumped.hash;
          result.successful = true;
          await this.markEnvelopeComplete(batchId, envelope.envelope_index, bumped.hash);
          return { result, interrupted: false };
        } catch (bumpError: any) {
          if (isStellarInfrastructureFailure(bumpError)) {
            await this.markEnvelopeInFlight(
              batchId,
              envelope.envelope_index,
              bumpError?.message ?? bumpError
            );
            result.error = bumpError?.message ?? 'Bulk payment submission was interrupted.';
            return { result, interrupted: true };
          }
        }
      }

      result.error = error?.message ?? 'Bulk payment envelope failed.';
      await this.markEnvelopeFailed(batchId, envelope.envelope_index, result.error);
      return { result, interrupted: false };
    }
  }

  private static completedResult(envelope: StoredEnvelope): EnvelopeResult {
    const txHash = envelope.tx_hash ?? envelope.fee_bump_hash ?? envelope.inner_hash ?? undefined;
    return {
      envelopeIndex: envelope.envelope_index,
      itemCount: envelope.item_count,
      successful: true,
      ...(txHash ? { txHash } : {}),
    };
  }

  private static buildTransaction(
    sourceKeypair: Keypair,
    accountSequence: bigint,
    chunk: BulkPaymentItem[],
    asset: Asset,
    networkPassphrase: string
  ): BuiltEnvelope {
    const account = new Account(sourceKeypair.publicKey(), accountSequence.toString());
    const fee = (FEE_MULTIPLIER_PER_OP * chunk.length).toString();
    const builder = new TransactionBuilder(account, { fee, networkPassphrase });
    for (const item of chunk) {
      builder.addOperation(
        Operation.payment({ destination: item.destination, asset, amount: item.amount })
      );
    }
    builder.setTimeout(TX_TIMEOUT_SECONDS);
    const tx = builder.build();
    tx.sign(sourceKeypair);
    return {
      xdr: tx.toXDR(),
      hash: tx.hash().toString('hex'),
      sequence: (accountSequence + BigInt(1)).toString(),
    };
  }

  private static buildFeeBump(
    originalError: any,
    innerXdr: string,
    sourceKeypair: Keypair,
    networkPassphrase: string,
    feeBumpFeePerOp: number,
    opCount: number
  ): BuiltEnvelope | null {
    const code =
      originalError?.response?.data?.extras?.result_codes?.transaction ??
      originalError?.resultCodes?.transaction;
    if (code !== 'tx_insufficient_fee') return null;
    try {
      const bumpFee = (feeBumpFeePerOp * opCount).toString();
      const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
        sourceKeypair,
        bumpFee,
        StellarService.transactionFromXDR(innerXdr),
        networkPassphrase
      );
      feeBumpTx.sign(sourceKeypair);
      return {
        xdr: feeBumpTx.toXDR(),
        hash: feeBumpTx.hash().toString('hex'),
        sequence: feeBumpTx.innerTransaction.sequence,
      };
    } catch {
      return null;
    }
  }

  private static transactionFromXDR(
    xdr: string,
    networkPassphrase: string,
    feeBump: boolean
  ): Transaction {
    const tx = feeBump
      ? TransactionBuilder.fromXDR(xdr, networkPassphrase)
      : StellarService.transactionFromXDR(xdr);
    return tx as unknown as Transaction;
  }

  private static async lookupReceipt(envelope: StoredEnvelope): Promise<Receipt | null> {
    const hashes = [envelope.tx_hash, envelope.fee_bump_hash, envelope.inner_hash].filter(
      (hash): hash is string => Boolean(hash)
    );
    for (const hash of hashes) {
      const receipt = await this.getReceipt(hash);
      if (receipt) return receipt;
    }
    return null;
  }

  private static async getReceipt(hash: string): Promise<Receipt | null> {
    const server = StellarService.getServer() as unknown as {
      getTransaction?: (txHash: string) => Promise<{ hash?: string; successful?: boolean }>;
    };
    if (typeof server?.getTransaction !== 'function') return null;
    try {
      const transaction = await server.getTransaction(hash);
      if (!transaction) return null;
      return { successful: transaction.successful !== false, hash: transaction.hash ?? hash };
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status;
      if (status === 404 || error?.code === '404' || /not found/i.test(error?.message ?? '')) {
        return null;
      }
      throw error;
    }
  }

  private static requestFingerprint(
    sourceAccount: string,
    items: BulkPaymentItem[],
    assetCode: string,
    assetIssuer: string | undefined
  ): string {
    const payload = {
      sourceAccount,
      assetCode,
      assetIssuer: assetIssuer ?? null,
      items: items.map((item) => [item.destination, item.amount, item.referenceId ?? null]),
    };
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private static async loadBatch(
    batchId: string,
    organizationId: number | undefined
  ): Promise<StoredBatch> {
    const result = (await pool.query(
      `SELECT * FROM bulk_payment_batches
       WHERE batch_id = $1 AND ($2::int IS NULL OR organization_id = $2)`,
      [batchId, organizationId ?? null]
    )) as QueryResult;
    const batch = result.rows?.[0] as StoredBatch | undefined;
    if (!batch) throw new Error('Bulk payment batch not found.');
    return batch;
  }

  private static async loadEnvelopes(batchId: string): Promise<StoredEnvelope[]> {
    const result = (await pool.query(
      'SELECT * FROM bulk_payment_envelopes WHERE batch_id = $1 ORDER BY envelope_index',
      [batchId]
    )) as QueryResult;
    return (result.rows ?? []) as StoredEnvelope[];
  }

  private static async markResumed(batchId: string, status: string): Promise<void> {
    if (!['interrupted', 'processing'].includes(status)) return;
    await pool.query(
      `UPDATE bulk_payment_batches
       SET status = 'processing', resume_count = resume_count + 1, last_resumed_at = NOW()
       WHERE batch_id = $1 AND status IN ('interrupted', 'processing')`,
      [batchId]
    );
  }

  private static async createBatchRecord(
    sourceAccount: string,
    items: BulkPaymentItem[],
    assetCode: string,
    assetIssuer: string | undefined,
    organizationId: number | undefined,
    idempotencyKey: string | undefined,
    fingerprint: string
  ): Promise<StoredBatch> {
    const canReuse =
      Boolean(idempotencyKey) && organizationId !== undefined && organizationId !== null;
    if (canReuse) {
      const existing = await this.findBatchByIdempotencyKey(organizationId!, idempotencyKey!);
      if (existing) {
        this.assertSameRequest(existing, fingerprint);
        await this.ensureBatchChildren(existing.batch_id, items);
        return existing;
      }
    }

    const insert = (await pool.query(
      `INSERT INTO bulk_payment_batches
         (source_account, organization_id, total_items, asset_code, asset_issuer,
          status, idempotency_key, request_fingerprint)
       VALUES ($1, $2, $3, $4, $5, 'processing', $6, $7)
       ON CONFLICT (organization_id, idempotency_key)
         WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING batch_id`,
      [
        sourceAccount,
        organizationId ?? null,
        items.length,
        assetCode,
        assetIssuer ?? null,
        idempotencyKey ?? null,
        fingerprint,
      ]
    )) as QueryResult;

    let batchId = insert.rows?.[0]?.batch_id as string | undefined;
    if (!batchId && canReuse) {
      const raced = await this.findBatchByIdempotencyKey(organizationId!, idempotencyKey!);
      if (!raced) throw new Error('Unable to create bulk payment batch.');
      this.assertSameRequest(raced, fingerprint);
      await this.ensureBatchChildren(raced.batch_id, items);
      return raced;
    }
    if (!batchId) throw new Error('Unable to create bulk payment batch.');

    await this.ensureBatchChildren(batchId, items);
    return {
      batch_id: batchId,
      organization_id: organizationId ?? null,
      total_items: items.length,
      status: 'processing',
      idempotency_key: idempotencyKey ?? null,
      request_fingerprint: fingerprint,
    };
  }

  private static async findBatchByIdempotencyKey(
    organizationId: number,
    idempotencyKey: string
  ): Promise<StoredBatch | null> {
    const result = (await pool.query(
      `SELECT * FROM bulk_payment_batches
       WHERE organization_id = $1 AND idempotency_key = $2
       ORDER BY id DESC LIMIT 1`,
      [organizationId, idempotencyKey]
    )) as QueryResult;
    return ((result.rows?.[0] as StoredBatch | undefined) ?? null) as StoredBatch | null;
  }

  private static assertSameRequest(batch: StoredBatch, fingerprint: string): void {
    if (batch.request_fingerprint && batch.request_fingerprint !== fingerprint) {
      throw new Error('Idempotency key already used with a different bulk payment payload.');
    }
  }

  private static async ensureBatchChildren(batchId: string, items: BulkPaymentItem[]): Promise<void> {
    const params: unknown[] = [];
    const placeholders = items.map((item, idx) => {
      const envelopeIndex = Math.floor(idx / MAX_OPS_PER_ENVELOPE);
      const base = params.length;
      params.push(batchId, envelopeIndex, item.destination, item.amount, item.referenceId ?? null);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });
    await pool.query(
      `INSERT INTO bulk_payment_items (batch_id, envelope_index, destination, amount, reference_id)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (batch_id, envelope_index) DO NOTHING`,
      params
    );

    const envelopeCount = Math.ceil(items.length / MAX_OPS_PER_ENVELOPE);
    const envelopeParams: unknown[] = [];
    const envelopePlaceholders = Array.from({ length: envelopeCount }, (_, envelopeIndex) => {
      const base = envelopeParams.length;
      const itemCount = Math.min(
        MAX_OPS_PER_ENVELOPE,
        items.length - envelopeIndex * MAX_OPS_PER_ENVELOPE
      );
      envelopeParams.push(batchId, envelopeIndex, itemCount);
      return `($${base + 1}, $${base + 2}, $${base + 3})`;
    });
    await pool.query(
      `INSERT INTO bulk_payment_envelopes (batch_id, envelope_index, item_count)
       VALUES ${envelopePlaceholders.join(', ')}
       ON CONFLICT (batch_id, envelope_index) DO NOTHING`,
      envelopeParams
    );
  }

  private static async claimEnvelope(
    batchId: string,
    envelopeIndex: number,
    built: BuiltEnvelope,
    itemCount: number
  ): Promise<StoredEnvelope> {
    const result = (await pool.query(
      `UPDATE bulk_payment_envelopes
       SET inner_xdr = $3, inner_hash = $4, source_sequence = $5, item_count = $6,
           status = 'submitted', attempts = attempts + 1, updated_at = NOW(),
           submitted_at = COALESCE(submitted_at, NOW())
       WHERE batch_id = $1 AND envelope_index = $2
         AND status = 'pending' AND inner_xdr IS NULL
       RETURNING *`,
      [batchId, envelopeIndex, built.xdr, built.hash, built.sequence, itemCount]
    )) as QueryResult;
    const claimed = result.rows?.[0] as StoredEnvelope | undefined;
    const envelope = claimed?.inner_xdr
      ? claimed
      : (((await this.loadEnvelope(batchId, envelopeIndex)) ?? claimed) as StoredEnvelope | undefined);

    await pool.query(
      `UPDATE bulk_payment_items
       SET status = 'submitted', envelope_id = $3, updated_at = NOW()
       WHERE batch_id = $1 AND envelope_index = $2 AND status = 'pending'`,
      [batchId, envelopeIndex, envelope?.id ?? null]
    );
    if (envelope?.inner_xdr) return envelope;

    return {
      id: envelope?.id,
      batch_id: batchId,
      envelope_index: envelopeIndex,
      item_count: Number(envelope?.item_count ?? itemCount),
      source_sequence: envelope?.source_sequence ?? built.sequence,
      inner_xdr: envelope?.inner_xdr ?? built.xdr,
      inner_hash: envelope?.inner_hash ?? built.hash,
      fee_bump_xdr: envelope?.fee_bump_xdr ?? null,
      fee_bump_hash: envelope?.fee_bump_hash ?? null,
      tx_hash: envelope?.tx_hash ?? null,
      status: 'submitted',
      attempts: Number(envelope?.attempts ?? 0) + 1,
      error_message: envelope?.error_message ?? null,
    };
  }

  private static async loadEnvelope(
    batchId: string,
    envelopeIndex: number
  ): Promise<StoredEnvelope | null> {
    const result = (await pool.query(
      'SELECT * FROM bulk_payment_envelopes WHERE batch_id = $1 AND envelope_index = $2',
      [batchId, envelopeIndex]
    )) as QueryResult;
    return ((result.rows?.[0] as StoredEnvelope | undefined) ?? null) as StoredEnvelope | null;
  }

  private static async persistFeeBump(
    batchId: string,
    envelopeIndex: number,
    bump: BuiltEnvelope
  ): Promise<BuiltEnvelope> {
    const result = (await pool.query(
      `UPDATE bulk_payment_envelopes
       SET fee_bump_xdr = $3, fee_bump_hash = $4, attempts = attempts + 1, updated_at = NOW()
       WHERE batch_id = $1 AND envelope_index = $2 AND fee_bump_xdr IS NULL
       RETURNING fee_bump_xdr, fee_bump_hash`,
      [batchId, envelopeIndex, bump.xdr, bump.hash]
    )) as QueryResult;
    const row = result.rows?.[0];
    return {
      xdr: row?.fee_bump_xdr ?? bump.xdr,
      hash: row?.fee_bump_hash ?? bump.hash,
      sequence: bump.sequence,
    };
  }

  private static async markEnvelopeComplete(
    batchId: string,
    envelopeIndex: number,
    txHash: string
  ): Promise<void> {
    await pool.query(
      `UPDATE bulk_payment_envelopes
       SET status = 'completed', tx_hash = $3, error_message = NULL, completed_at = NOW(),
           updated_at = NOW()
       WHERE batch_id = $1 AND envelope_index = $2 AND status <> 'completed'`,
      [batchId, envelopeIndex, txHash]
    );
    await this.updateEnvelopeItems(batchId, envelopeIndex, 'completed', txHash);
  }

  private static async markEnvelopeFailed(
    batchId: string,
    envelopeIndex: number,
    errorMessage: string
  ): Promise<void> {
    await pool.query(
      `UPDATE bulk_payment_envelopes
       SET status = 'failed', error_message = $3, updated_at = NOW()
       WHERE batch_id = $1 AND envelope_index = $2 AND status <> 'completed'`,
      [batchId, envelopeIndex, errorMessage]
    );
    await this.updateEnvelopeItems(batchId, envelopeIndex, 'failed', undefined, errorMessage);
  }

  private static async markEnvelopeInFlight(
    batchId: string,
    envelopeIndex: number,
    errorMessage: string
  ): Promise<void> {
    await pool.query(
      `UPDATE bulk_payment_envelopes
       SET status = 'submitted', error_message = $3, updated_at = NOW()
       WHERE batch_id = $1 AND envelope_index = $2 AND status <> 'completed'`,
      [batchId, envelopeIndex, errorMessage]
    );
  }

  private static async markInterrupted(batchId: string): Promise<void> {
    await pool.query(
      `UPDATE bulk_payment_batches SET status = 'interrupted'
       WHERE batch_id = $1 AND status IN ('processing', 'interrupted')`,
      [batchId]
    );
  }

  private static async updateEnvelopeItems(
    batchId: string,
    envelopeIndex: number,
    status: 'completed' | 'failed' | 'submitted',
    txHash?: string,
    errorMessage?: string
  ): Promise<void> {
    await pool.query(
      `UPDATE bulk_payment_items
       SET status = $1, tx_hash = $2, error_message = $3, updated_at = NOW()
       WHERE batch_id = $4 AND envelope_index = $5`,
      [status, txHash ?? null, errorMessage ?? null, batchId, envelopeIndex]
    );
  }

  private static async finalizeBatch(
    batchId: string,
    status: string,
    fallbackSuccessful: number,
    fallbackFailed: number
  ): Promise<void> {
    const counts = (await pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM bulk_payment_items WHERE batch_id = $1 GROUP BY status`,
      [batchId]
    )) as QueryResult;

    let successfulItems = fallbackSuccessful;
    let failedItems = fallbackFailed;
    const rows = counts.rows ?? [];
    if (rows.some((row) => typeof row.count === 'number' && typeof row.status === 'string')) {
      successfulItems = rows
        .filter((row) => row.status === 'completed')
        .reduce((sum, row) => sum + Number(row.count), 0);
      failedItems = rows
        .filter((row) => row.status === 'failed')
        .reduce((sum, row) => sum + Number(row.count), 0);
    }

    await pool.query(
      `UPDATE bulk_payment_batches
       SET successful_items = $2, failed_items = $3, status = $4,
           completed_at = CASE WHEN $4 IN ('completed', 'partial', 'failed') THEN NOW()
                               ELSE completed_at END
       WHERE batch_id = $1 AND status IN ('processing', 'interrupted')`,
      [batchId, successfulItems, failedItems, status]
    );
  }

  private static chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  static async getBatchStatus(
    batchId: string,
    organizationId?: number
  ): Promise<{
    batch: Record<string, unknown>;
    items: Record<string, unknown>[];
  } | null> {
    const batchResult = await pool.query(
      `SELECT * FROM bulk_payment_batches
       WHERE batch_id = $1
       AND ($2::int IS NULL OR organization_id = $2)`,
      [batchId, organizationId ?? null]
    );
    if (batchResult.rows.length === 0) return null;

    const itemsResult = await pool.query(
      'SELECT * FROM bulk_payment_items WHERE batch_id = $1 ORDER BY id',
      [batchId]
    );

    return { batch: batchResult.rows[0], items: itemsResult.rows };
  }
}
