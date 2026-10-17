/**
 * Bulk Payment Batch Orchestration Workflow (#1234)
 *
 * Wraps BulkPaymentService.submitBatch in a resumable, observable workflow.
 * Each phase is an independently retried step so transient failures (network
 * blips, rate-limits, 5xx responses) are automatically recovered without
 * restarting the entire batch.
 *
 * Workflow steps:
 *   1. validate-input   – schema validation before touching the network.
 *   2. preflight-check  – verify source account balance is sufficient.
 *   3. submit-batch     – call BulkPaymentService.submitBatch.
 *   4. record-result    – persist the batch outcome for auditability.
 */

import { StrKey } from '@stellar/stellar-sdk';
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
import { StellarService } from '../services/stellarService.js';
import { Keypair } from '@stellar/stellar-sdk';

// ── Input schema ──────────────────────────────────────────────────────────────

export const bulkPaymentItemSchema = z.object({
  destination: z.string().refine(StrKey.isValidEd25519PublicKey, 'Invalid destination address'),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a positive decimal string'),
  referenceId: z.string().optional(),
});

export const bulkPaymentBatchInputSchema = z
  .object({
    /** Stellar secret key for the source (funding) account. */
    sourceSecret: z.string().min(1, 'Source secret key is required'),
    items: z.array(bulkPaymentItemSchema).min(1, 'At least one payment item is required'),
    assetCode: z.string().regex(/^[A-Za-z0-9]{1,12}$/).optional(),
    assetIssuer: z
      .string()
      .refine(StrKey.isValidEd25519PublicKey, 'Invalid asset issuer')
      .optional(),
    feeBumpFeePerOp: z.number().int().positive().optional(),
  })
  .strict();

export type BulkPaymentBatchInput = z.infer<typeof bulkPaymentBatchInputSchema>;

// ── Workflow ──────────────────────────────────────────────────────────────────

export class BulkPaymentBatchWorkflow {
  constructor(
    private readonly paymentService = BulkPaymentService,
    private readonly stellarService = StellarService,
    private readonly delayMs = 100
  ) {}

  /**
   * Execute the bulk payment batch workflow.
   *
   * @param context - JWT payload of the authenticated caller (must be EMPLOYER).
   * @param input   - Validated batch parameters.
   */
  async execute(
    context: WorkflowContext,
    input: BulkPaymentBatchInput
  ) {
    const run = new WorkflowRun('bulk-payment-batch', context, this.delayMs);

    return run.execute(async () => {
      // Employer-only — the organisation must have a budget to disburse payroll.
      const organizationId = requireOrganization(context, /* employerOnly */ true);

      // ── Step 1: Validate input ──────────────────────────────────────────────
      const validated = await run.step(
        'validate-input',
        async () => {
          const result = bulkPaymentBatchInputSchema.safeParse(input);
          if (!result.success) {
            throw new WorkflowError(
              'INVALID_INPUT',
              `Input validation failed: ${result.error.message}`
            );
          }
          return result.data;
        },
        /* retrySafe */ false // validation is deterministic; no value in retrying
      );

      let sourceKeypair: Keypair;
      try {
        sourceKeypair = Keypair.fromSecret(validated.sourceSecret);
      } catch {
        throw new WorkflowError('INVALID_INPUT', 'Invalid source secret key.');
      }

      // ── Step 2: Preflight – verify account exists and has native balance ────
      await run.step('preflight-check', async () => {
        const server = this.stellarService.getServer();
        const account = await server.loadAccount(sourceKeypair.publicKey()).catch(() => {
          throw new WorkflowError(
            'PREFLIGHT_FAILED',
            'Source account not found on the Stellar network.'
          );
        });

        const nativeBalance = account.balances.find((b) => b.asset_type === 'native');
        if (!nativeBalance || parseFloat(nativeBalance.balance) < 1) {
          throw new WorkflowError(
            'PREFLIGHT_FAILED',
            'Source account has insufficient native XLM balance.'
          );
        }
      });

      // ── Step 3: Submit the batch ────────────────────────────────────────────
      const batchResult: BulkPaymentBatchResult = await run.step(
        'submit-batch',
        () => {
          const options: BulkPaymentOptions = {
            organizationId,
            assetCode: validated.assetCode,
            assetIssuer: validated.assetIssuer,
            feeBumpFeePerOp: validated.feeBumpFeePerOp,
          };
          return this.paymentService.submitBatch(sourceKeypair, validated.items, options);
        }
      );

      // ── Step 4: Record the result ───────────────────────────────────────────
      await run.step(
        'record-result',
        async () => {
          // The DB write performed by submitBatch already created the records;
          // this step is a hook point for downstream notifications or webhooks.
          // Keeping it as a no-op step ensures it appears in the execution trace.
        }
      );

      return batchResult;
    });
  }
}
