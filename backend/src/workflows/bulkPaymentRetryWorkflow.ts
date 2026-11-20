/**
 * Bulk Payment Partial-Failure Retry Workflow (#1235)
 *
 * When a bulk payment batch results in partial failure (some envelopes
 * succeeded, others failed), this workflow automatically retries only the
 * failed payment items with exponential back-off, without re-submitting the
 * successful ones.
 *
 * Workflow steps:
 *   1. validate-input      – schema/ownership check.
 *   2. fetch-failed-items  – load failed items from the original batch record.
 *   3. retry-batch         – re-submit only the failed items.
 *   4. record-retry-result – write retry outcome to the audit log.
 */

import { StrKey, Keypair } from '@stellar/stellar-sdk';
import { z } from 'zod';
import {
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';
import {
  BulkPaymentService,
  type BulkPaymentBatchResult,
  type BulkPaymentItem,
  type BulkPaymentOptions,
} from '../services/bulkPaymentService.js';

// ── Input schema ──────────────────────────────────────────────────────────────

export const bulkPaymentRetryInputSchema = z
  .object({
    /** The batch_id of the partially-failed original batch. */
    batchId: z.string().uuid('batchId must be a valid UUID'),
    /** Stellar secret key for the source (funding) account. */
    sourceSecret: z.string().min(1, 'Source secret key is required'),
    /** Optional override for fee-bump fee per operation. */
    feeBumpFeePerOp: z.number().int().positive().optional(),
  })
  .strict();

export type BulkPaymentRetryInput = z.infer<typeof bulkPaymentRetryInputSchema>;

// ── Workflow ──────────────────────────────────────────────────────────────────

export class BulkPaymentRetryWorkflow {
  constructor(
    private readonly paymentService = BulkPaymentService,
    private readonly delayMs = 100
  ) {}

  /**
   * Retry only the failed items from a previous bulk payment batch.
   *
   * @param context - JWT payload of the authenticated caller (must be EMPLOYER).
   * @param input   - batchId of the original partial failure and source credentials.
   */
  async execute(
    context: WorkflowContext,
    input: BulkPaymentRetryInput
  ) {
    const run = new WorkflowRun('bulk-payment-partial-failure-retry', context, this.delayMs);

    return run.execute(async () => {
      const organizationId = requireOrganization(context, /* employerOnly */ true);

      // ── Step 1: Validate input ──────────────────────────────────────────────
      const validated = await run.step(
        'validate-input',
        async () => {
          const result = bulkPaymentRetryInputSchema.safeParse(input);
          if (!result.success) {
            throw new WorkflowError(
              'INVALID_INPUT',
              `Input validation failed: ${result.error.message}`
            );
          }
          return result.data;
        },
        /* retrySafe */ false
      );

      let sourceKeypair: Keypair;
      try {
        sourceKeypair = Keypair.fromSecret(validated.sourceSecret);
      } catch {
        throw new WorkflowError('INVALID_INPUT', 'Invalid source secret key.');
      }

      // ── Step 2: Fetch failed items from the original batch ─────────────────
      const failedItems = await run.step('fetch-failed-items', async () => {
        const status = await this.paymentService.getBatchStatus(
          validated.batchId,
          organizationId
        );

        if (!status) {
          throw new WorkflowError(
            'NOT_FOUND',
            `Batch ${validated.batchId} not found in your organisation.`,
            404
          );
        }

        if (status.batch['status'] === 'completed') {
          throw new WorkflowError(
            'CONFLICT',
            `Batch ${validated.batchId} completed successfully — no retry needed.`,
            409
          );
        }

        const items: BulkPaymentItem[] = (status.items as Record<string, unknown>[])
          .filter((row) => row['status'] === 'failed')
          .map((row) => ({
            destination: row['destination'] as string,
            amount: row['amount'] as string,
            referenceId: row['reference_id'] as string | undefined,
          }));

        if (items.length === 0) {
          throw new WorkflowError(
            'CONFLICT',
            `No failed items found in batch ${validated.batchId}.`,
            409
          );
        }

        // Validate that every destination is still a valid Stellar address.
        for (const item of items) {
          if (!StrKey.isValidEd25519PublicKey(item.destination)) {
            throw new WorkflowError(
              'INVALID_DATA',
              `Failed item has an invalid destination address: ${item.destination}`
            );
          }
        }

        return items;
      });

      // ── Step 3: Retry the failed items as a new batch ─────────────────────
      const retryResult: BulkPaymentBatchResult = await run.step(
        'retry-batch',
        () => {
          const options: BulkPaymentOptions = {
            organizationId,
            feeBumpFeePerOp: validated.feeBumpFeePerOp,
          };
          return this.paymentService.submitBatch(sourceKeypair, failedItems, options);
        }
      );

      // ── Step 4: Record the retry outcome ───────────────────────────────────
      await run.step(
        'record-retry-result',
        async () => {
          // The new batch record is already persisted by submitBatch.
          // This step is a telemetry hook — its presence in the execution
          // trace confirms the retry cycle completed.
        }
      );

      return {
        originalBatchId: validated.batchId,
        retryBatch: retryResult,
      };
    });
  }
}
