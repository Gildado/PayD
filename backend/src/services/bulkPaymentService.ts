import { Keypair, Asset, Operation, TransactionBuilder, Account } from '@stellar/stellar-sdk';
import { StellarService } from './stellarService.js';
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
}

export class BulkPaymentService {
  /**
   * Submit up to 100 payments per Stellar transaction envelope.
   * Manages sequence numbers by loading the account once and incrementing
   * manually for each envelope to avoid concurrent submission conflicts.
   * Applies a FeeBumpTransaction wrapper on retry for fee bumping.
   * On partial failure, marks failed items in DB and continues remaining envelopes.
   */
  static async submitBatch(
    sourceKeypair: Keypair,
    items: BulkPaymentItem[],
    options: BulkPaymentOptions = {}
  ): Promise<BulkPaymentBatchResult> {
    if (items.length === 0) {
      throw new Error('Payment batch must contain at least one item.');
    }

    const assetCode = options.assetCode ?? 'XLM';
    const asset =
      assetCode === 'XLM' ? Asset.native() : new Asset(assetCode, options.assetIssuer ?? '');

    const server = StellarService.getServer();
    const networkPassphrase = StellarService.getNetworkPassphrase();

    // Load the source account once - we manage sequence numbers manually to
    // prevent conflicts when multiple envelopes are built back-to-back.
    const accountResponse = await server.loadAccount(sourceKeypair.publicKey());
    let currentSequence = BigInt(accountResponse.sequenceNumber());

    const batchId = await this.createBatchRecord(
      sourceKeypair.publicKey(),
      items,
      assetCode,
      options.assetIssuer,
      options.organizationId
    );

    const envelopes = this.chunk(items, MAX_OPS_PER_ENVELOPE);
    const results: EnvelopeResult[] = [];
    let successfulItems = 0;
    let failedItems = 0;

    for (let i = 0; i < envelopes.length; i++) {
      const chunk = envelopes[i]!;
      const envelopeResult: EnvelopeResult = {
        envelopeIndex: i,
        itemCount: chunk.length,
        successful: false,
      };

      try {
        // Build the envelope using the manually managed sequence number.
        currentSequence += BigInt(1);
        const account = new Account(
          sourceKeypair.publicKey(),
          (currentSequence - BigInt(1)).toString()
        );

        const fee = (FEE_MULTIPLIER_PER_OP * chunk.length).toString();
        const builder = new TransactionBuilder(account, { fee, networkPassphrase });

        for (const item of chunk) {
          builder.addOperation(
            Operation.payment({
              destination: item.destination,
              asset,
              amount: item.amount,
            })
          );
        }

        builder.setTimeout(TX_TIMEOUT_SECONDS);
        const tx = builder.build();
        tx.sign(sourceKeypair);

        const result = await StellarService.submitTransaction(tx);

        envelopeResult.txHash = result.hash;
        envelopeResult.successful = true;
        successfulItems += chunk.length;

        await this.updateEnvelopeItems(batchId, i, 'completed', result.hash);
        logger.info(
          `Bulk payment envelope ${i + 1}/${envelopes.length} submitted. Hash: ${result.hash}`
        );
      } catch (err: any) {
        logger.error(`Bulk payment envelope ${i + 1}/${envelopes.length} failed: ${err.message}`);

        // Attempt fee bump if the transaction was built and signed but rejected.
        const feeBumped = await this.tryFeeBump(
          err,
          sourceKeypair,
          networkPassphrase,
          options.feeBumpFeePerOp ?? FEE_MULTIPLIER_PER_OP * 5,
          chunk.length
        );

        if (feeBumped) {
          envelopeResult.txHash = feeBumped.hash;
          envelopeResult.successful = true;
          successfulItems += chunk.length;
          await this.updateEnvelopeItems(batchId, i, 'completed', feeBumped.hash);
          logger.info(`Fee bump succeeded for envelope ${i + 1}. Hash: ${feeBumped.hash}`);
        } else {
          envelopeResult.error = err.message;
          failedItems += chunk.length;
          await this.updateEnvelopeItems(batchId, i, 'failed', undefined, err.message);

          const remainingEnvelopes = envelopes.slice(i + 1);
          if (remainingEnvelopes.length > 0) {
            await this.failRemainingEnvelopes(
              batchId,
              remainingEnvelopes,
              i + 1,
              'Batch rolled back after an earlier envelope failure.'
            );
            failedItems += remainingEnvelopes.reduce((sum, remainingChunk) => sum + remainingChunk.length, 0);
          }

          results.push(envelopeResult);
          break;
        }
      }

      results.push(envelopeResult);
    }

    const finalStatus =
      failedItems === 0 ? 'completed' : successfulItems === 0 ? 'failed' : 'partial';

    await this.finalizeBatch(batchId, successfulItems, failedItems, finalStatus);

    return { batchId, totalItems: items.length, successfulItems, failedItems, envelopes: results };
  }

  /**
   * Attempt to wrap the inner transaction in a FeeBumpTransaction with a higher fee.
   * Returns the fee bump result if it succeeds, otherwise null.
   *
   * A fee bump is only applicable when the inner transaction was submitted but
   * rejected due to insufficient fee (tx_insufficient_fee).
   */
  private static async tryFeeBump(
    originalError: any,
    feeSourceKeypair: Keypair,
    networkPassphrase: string,
    feeBumpFeePerOp: number,
    opCount: number
  ): Promise<{ hash: string } | null> {
    const isInsufficientFee =
      originalError?.response?.data?.extras?.result_codes?.transaction === 'tx_insufficient_fee';

    if (!isInsufficientFee) return null;

    const innerXdr: string | undefined = originalError?.response?.data?.extras?.envelope_xdr;
    if (!innerXdr) return null;

    try {
      const server = StellarService.getServer();
      const bumpFee = (feeBumpFeePerOp * opCount).toString();

      const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
        feeSourceKeypair,
        bumpFee,
        StellarService.transactionFromXDR(innerXdr),
        networkPassphrase
      );

      feeBumpTx.sign(feeSourceKeypair);
      const result = await server.submitTransaction(feeBumpTx);
      return { hash: result.hash };
    } catch {
      return null;
    }
  }

  private static chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  private static async createBatchRecord(
    sourceAccount: string,
    items: BulkPaymentItem[],
    assetCode: string,
    assetIssuer: string | undefined,
    organizationId: number | undefined
  ): Promise<string> {
    const batchResult = await pool.query(
      `INSERT INTO bulk_payment_batches
         (source_account, organization_id, total_items, asset_code, asset_issuer, status)
       VALUES ($1, $2, $3, $4, $5, 'processing')
       RETURNING batch_id`,
      [sourceAccount, organizationId ?? null, items.length, assetCode, assetIssuer ?? null]
    );

    const batchId: string = batchResult.rows[0].batch_id;

    // Build parameterized bulk insert to prevent SQL injection.
    const params: unknown[] = [];
    const placeholders = items.map((item, idx) => {
      const envelopeIndex = Math.floor(idx / MAX_OPS_PER_ENVELOPE);
      const base = params.length;
      params.push(batchId, envelopeIndex, item.destination, item.amount, item.referenceId ?? null);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });

    await pool.query(
      `INSERT INTO bulk_payment_items (batch_id, envelope_index, destination, amount, reference_id)
       VALUES ${placeholders.join(', ')}`,
      params
    );

    return batchId;
  }

  private static async updateEnvelopeItems(
    batchId: string,
    envelopeIndex: number,
    status: 'completed' | 'failed',
    txHash?: string,
    errorMessage?: string
  ): Promise<void> {
    await pool.query(
      `UPDATE bulk_payment_items
       SET status = $1, tx_hash = $2, error_message = $3
       WHERE batch_id = $4 AND envelope_index = $5`,
      [status, txHash ?? null, errorMessage ?? null, batchId, envelopeIndex]
    );
  }

  private static async failRemainingEnvelopes(
    batchId: string,
    remainingEnvelopes: BulkPaymentItem[][],
    startEnvelopeIndex: number,
    errorMessage: string
  ): Promise<void> {
    for (let offset = 0; offset < remainingEnvelopes.length; offset++) {
      const envelopeIndex = startEnvelopeIndex + offset;
      await this.updateEnvelopeItems(batchId, envelopeIndex, 'failed', undefined, errorMessage);
    }
  }

  private static async finalizeBatch(
    batchId: string,
    successfulItems: number,
    failedItems: number,
    status: string
  ): Promise<void> {
    await pool.query(
      `UPDATE bulk_payment_batches
       SET successful_items = $1, failed_items = $2, status = $3, completed_at = NOW()
       WHERE batch_id = $4`,
      [successfulItems, failedItems, status, batchId]
    );
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
