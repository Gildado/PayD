import { Keypair } from '@stellar/stellar-sdk';
import { z } from 'zod';
import { AnchorService } from '../services/anchorService.js';
import {
  NotReadyError,
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';
import { PostgresWorkflowStore, type WorkflowStore } from './store.js';

// Cash-out via anchors is a multi-step async handoff (SEP-10 auth -> SEP-31
// transaction -> confirmation) with no single coordinating workflow today.
export const anchorCashoutSchema = z
  .object({
    domain: z.string().trim().min(1).max(255),
    assetCode: z.string().trim().min(1).max(12),
    amount: z.string().trim().min(1).max(50),
    account: z.string().trim().min(1).max(255),
    destination: z.string().trim().min(1).max(255).optional(),
    memo: z.string().trim().max(255).optional(),
    clientSecret: z.string().trim().min(1).optional(),
  })
  .strict();

export interface AnchorCashoutInput extends z.infer<typeof anchorCashoutSchema> {}

export interface AnchorCashoutAnchor {
  getAnchorInfo(domain: string): Promise<{ sep31Endpoint?: string }>;
  authenticate(domain: string, clientKeypair: Keypair): Promise<string>;
  initiatePayment(domain: string, token: string, data: Record<string, unknown>): Promise<any>;
  getTransaction(domain: string, token: string, id: string): Promise<any>;
}

export class AnchorCashoutWorkflow {
  constructor(
    private readonly store: WorkflowStore = new PostgresWorkflowStore(),
    private readonly anchor: AnchorCashoutAnchor = AnchorService,
    private readonly delayMs = 100
  ) {}

  private referenceFor(domain: string, assetCode: string): string {
    return `anchor-cashout-${domain}:${assetCode}`;
  }

  async execute(context: WorkflowContext, input: z.infer<typeof anchorCashoutSchema>) {
    const run = new WorkflowRun('anchor-cashout', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      input = anchorCashoutSchema.parse(input);

      let clientKeypair: Keypair;
      try {
        clientKeypair = Keypair.fromSecret(input.account);
      } catch {
        throw new WorkflowError('INVALID_ACCOUNT', 'A valid Stellar secret key is required.');
      }

      const info = await run.step('discover-anchor', () => this.anchor.getAnchorInfo(input.domain));
      if (!info.sep31Endpoint) {
        throw new WorkflowError(
          'UNSUPPORTED_ANCHOR',
          'Anchor does not support SEP-31 cash-out.'
        );
      }

      const token = await run.step('authenticate', () =>
        this.anchor.authenticate(input.domain, clientKeypair)
      );

      const record = await run.step('stage-cashout', () =>
        this.store.create(
          organizationId,
          'anchor-cashout',
          this.referenceFor(input.domain, input.assetCode),
          'processing',
          {
            domain: input.domain,
            assetCode: input.assetCode,
            amount: input.amount,
            account: clientKeypair.publicKey(),
            initiatedBy: context.id,
            initiatedAt: new Date().toISOString(),
          }
        )
      );

      if (record.status === 'completed') return record;

      const transaction = await run.step('initiate-sep31-handoff', async () => {
        try {
          return await this.anchor.initiatePayment(input.domain, token, {
            asset_code: input.assetCode,
            amount: input.amount,
            account: clientKeypair.publicKey(),
            ...(input.destination ? { destination: input.destination } : {}),
          });
        } catch (error) {
          if ((error as { response?: { status?: number } }).response?.status === 429) {
            throw new NotReadyError('Anchor rate limited the cash-out.');
          }
          const status = (error as { response?: { status?: number } }).response?.status;
          if (status !== undefined && status >= 500) {
            throw new NotReadyError('Anchor is temporarily unavailable.');
          }
          throw error;
        }
      });

      const transactionId = transaction?.id;
      if (!transactionId) {
        throw new WorkflowError('ANCHOR_REJECTED', 'Anchor did not return a transaction id.');
      }

      // The handoff is async: poll for the anchor's terminal status. Pending
      // results raise NotReadyError so the step is retried with backoff.
      const settlement = await run.step('await-anchor-confirmation', async () => {
        const status = await this.anchor.getTransaction(input.domain, token, String(transactionId));
        const state = String(status?.status ?? '');
        if (['pending', 'pending_user_transfer_start', 'pending_anchor'].includes(state)) {
          throw new NotReadyError('Cash-out is still awaiting anchor confirmation.');
        }
        return status;
      });

      if (settlement?.status === 'error' || settlement?.status === 'expired') {
        return run.step(
          'record-failed-cashout',
          () =>
            this.store.transition(record, 'failed', {
              ...record.data,
              transactionId,
              anchorStatus: settlement.status,
              error: settlement.message ?? null,
            }),
          false
        );
      }

      return run.step(
        'finalize-cashout',
        () =>
          this.store.transition(record, 'completed', {
            ...record.data,
            transactionId,
            anchorStatus: settlement?.status ?? 'completed',
            completedAt: new Date().toISOString(),
          }),
        false
      );
    });
  }

  async getStatus(context: WorkflowContext, domain: string, assetCode: string) {
    const run = new WorkflowRun('anchor-cashout-status', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      const record = await this.store.findByReference(
        organizationId,
        'anchor-cashout',
        this.referenceFor(domain, assetCode)
      );
      if (!record) throw new WorkflowError('NOT_FOUND', 'Cash-out not found.', 404);
      return record;
    });
  }
}
