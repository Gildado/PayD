import { z } from 'zod';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import { withSpan } from '../utils/tracing.js';
import {
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';
import {
  TransactionVerificationQueueService,
  type TxVerificationJobData,
} from '../services/transactionVerificationQueueService.js';
import { TransactionAuditService } from '../services/transactionAuditService.js';

export const TX_SOURCES = [
  'payroll',
  'freeze',
  'contract_upgrade',
  'trustline',
  'rewards',
  'unknown',
] as const;
export type TxSource = (typeof TX_SOURCES)[number];

export const transactionVerificationQueueSchema = z
  .object({
    txHash: z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{64}$/, 'Invalid 64-character hex transaction hash'),
    source: z.enum(TX_SOURCES).default('unknown'),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
    waitForCompletion: z.boolean().default(false),
    organizationId: z.number().int().positive().optional(),
  })
  .strict();

export interface TxVerificationQueueOutcome {
  status: 'enqueued' | 'already_verified' | 'verified_on_chain' | 'dead_letter_escalated';
  txHash: string;
  jobId: string;
  source: TxSource;
  organizationId?: number;
  auditRecord?: {
    ledgerSequence?: number;
    successful?: boolean;
    verifiedAt?: string;
  };
  enqueuedAt: string;
}

export class TransactionVerificationQueueWorkflow {
  constructor(
    private readonly queueService = TransactionVerificationQueueService,
    private readonly auditService = TransactionAuditService,
    private readonly db = pool,
    private readonly delayMs = 100
  ) {}

  async execute(
    context: WorkflowContext,
    input: z.infer<typeof transactionVerificationQueueSchema>
  ) {
    const run = new WorkflowRun('tx-verification-queue-orchestration', context, this.delayMs);
    return run.execute<TxVerificationQueueOutcome>(async () => {
      const orgId = requireOrganization(context);
      input = transactionVerificationQueueSchema.parse(input);
      const effectiveOrgId = input.organizationId ?? orgId;

      // Step 1: Preflight check against already recorded immutable audit logs
      const preflight = await run.step(
        'validate-and-check-preflight',
        async () => {
          const existing = await this.db.query<{
            tx_hash: string;
            ledger_sequence: number;
            successful: boolean;
            created_at: string;
          }>(
            'SELECT tx_hash, ledger_sequence, successful, created_at FROM transaction_audit_logs WHERE tx_hash = $1',
            [input.txHash]
          );

          if (existing.rows.length > 0) {
            const row = existing.rows[0];
            logger.info('Tx already verified in audit log', {
              txHash: input.txHash,
              ledger: row.ledger_sequence,
              executionId: run.executionId,
            });
            return {
              alreadyVerified: true,
              record: {
                ledgerSequence: row.ledger_sequence,
                successful: row.successful,
                verifiedAt: new Date(row.created_at).toISOString(),
              },
            };
          }

          return { alreadyVerified: false };
        },
        true // safe to retry read queries
      );

      if (preflight.alreadyVerified) {
        return {
          status: 'already_verified',
          txHash: input.txHash,
          jobId: `tx:${input.txHash}`,
          source: input.source,
          organizationId: effectiveOrgId,
          auditRecord: preflight.record,
          enqueuedAt: new Date().toISOString(),
        };
      }

      // Step 2: Enqueue verification job into BullMQ queue
      const jobId = await run.step(
        'enqueue-verification-job',
        async () => {
          const enqueuedId = await this.queueService.enqueue({
            txHash: input.txHash,
            source: input.source,
            organizationId: effectiveOrgId,
          });

          logger.info('Tx verification job submitted via workflow', {
            jobId: enqueuedId,
            txHash: input.txHash,
            executionId: run.executionId,
          });

          return enqueuedId;
        },
        true // queue enqueue is idempotent with custom jobId
      );

      // Step 3: Probing and on-chain verification if synchronous completion requested
      let auditRecord: TxVerificationQueueOutcome['auditRecord'] | undefined;
      let finalStatus: TxVerificationQueueOutcome['status'] = 'enqueued';

      if (input.waitForCompletion) {
        auditRecord = await run.step(
          'probe-or-verify-tx',
          async () => {
            const record = await this.auditService.fetchAndStore(input.txHash);
            finalStatus = 'verified_on_chain';
            return {
              ledgerSequence: record.ledger_sequence,
              successful: record.successful,
              verifiedAt: new Date().toISOString(),
            };
          },
          true // retry transient Horizon indexing lags / network timeouts
        );
      }

      // Step 4: Audit queue orchestration event
      await run.step(
        'audit-queue-orchestration',
        async () => {
          logger.info('Tx verification orchestration completed', {
            executionId: run.executionId,
            txHash: input.txHash,
            status: finalStatus,
          });
          return { audited: true };
        },
        true
      );

      return {
        status: finalStatus,
        txHash: input.txHash,
        jobId,
        source: input.source,
        organizationId: effectiveOrgId,
        auditRecord,
        enqueuedAt: new Date().toISOString(),
      };
    });
  }
}
