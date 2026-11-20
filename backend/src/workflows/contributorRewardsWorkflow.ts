import { Asset, Memo, Operation, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { StellarService } from '../services/stellarService.js';
import {
  NotReadyError,
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';
import { PostgresWorkflowStore, type WorkflowRecord, type WorkflowStore } from './store.js';
import { stellarAddress } from './trustlineSetupWorkflow.js';

// Matches the published XLM tiers on ContributorRewards.tsx. Amounts are server-controlled.
export const REWARD_AMOUNTS = {
  Minor: '100.0000000',
  Major: '500.0000000',
  Critical: '2000.0000000',
} as const;
export const eligibilitySchema = z
  .object({
    issueNumber: z.number().int().positive(),
    pullRequestNumber: z.number().int().positive(),
    contributorAddress: stellarAddress,
    tier: z.enum(['Minor', 'Major', 'Critical']),
    rewardEligible: z.boolean(),
    merged: z.boolean(),
    maintainerApproved: z.boolean(),
    testsPassed: z.boolean(),
  })
  .strict();

export interface RewardGateway {
  checkRecipient(address: string): Promise<void>;
  prepare(payer: string, recipient: string, amount: string, rewardId: string): Promise<string>;
  submit(signedXdr: string): Promise<void>;
  confirm(hash: string): Promise<{ successful: boolean }>;
}

export class StellarRewardGateway implements RewardGateway {
  async checkRecipient(address: string): Promise<void> {
    await StellarService.getServer().loadAccount(address);
  }

  async prepare(
    payer: string,
    recipient: string,
    amount: string,
    rewardId: string
  ): Promise<string> {
    const builder = await StellarService.buildTransaction(
      payer,
      [
        Operation.payment({
          destination: recipient,
          asset: Asset.native(),
          amount,
        }),
      ],
      { timeout: 300, memo: Memo.hash(rewardId.replaceAll('-', '').padEnd(64, '0')) }
    );
    return builder.build().toXDR();
  }

  async submit(signedXdr: string): Promise<void> {
    const tx = TransactionBuilder.fromXDR(signedXdr, StellarService.getNetworkPassphrase());
    // Reusing the exact persisted envelope/sequence is safe even when a response is lost.
    await StellarService.getServer().submitTransaction(tx);
  }

  async confirm(hash: string): Promise<{ successful: boolean }> {
    try {
      return await StellarService.getServer().transactions().transaction(hash).call();
    } catch (error) {
      if ((error as { response?: { status?: number } }).response?.status === 404) {
        throw new NotReadyError('Transaction is not yet indexed.');
      }
      throw error;
    }
  }
}

export class ContributorRewardsWorkflow {
  constructor(
    private readonly store: WorkflowStore = new PostgresWorkflowStore(),
    private readonly gateway: RewardGateway = new StellarRewardGateway(),
    private readonly delayMs = 100
  ) {}

  async calculateEligibility(context: WorkflowContext, input: z.infer<typeof eligibilitySchema>) {
    const run = new WorkflowRun('contributor-reward-eligibility', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      input = eligibilitySchema.parse(input);
      const reasons = await run.step('evaluate-criteria', async () => {
        const checks = {
          rewardEligible: input.rewardEligible,
          merged: input.merged,
          maintainerApproved: input.maintainerApproved,
          testsPassed: input.testsPassed,
        };
        return Object.entries(checks)
          .filter(([, passed]) => !passed)
          .map(([criterion]) => criterion);
      });
      if (reasons.length) return { status: 'ineligible' as const, reasons };
      await run.step('check-recipient-account', () =>
        this.gateway.checkRecipient(input.contributorAddress)
      );
      const record = await run.step('stage-payout', () =>
        this.store.create(
          organizationId,
          'contributor-reward',
          `Gildado/PayD#${input.issueNumber}`,
          'staged',
          {
            ...input,
            amount: REWARD_AMOUNTS[input.tier],
            assetCode: 'XLM',
            approvedBy: context.id,
          }
        )
      );
      if (
        record.data.contributorAddress !== input.contributorAddress ||
        record.data.tier !== input.tier ||
        record.data.pullRequestNumber !== input.pullRequestNumber
      ) {
        throw new WorkflowError(
          'CONFLICT',
          'This issue already has a different staged reward.',
          409
        );
      }
      return publicReward(record);
    });
  }

  private async load(context: WorkflowContext, id: string): Promise<WorkflowRecord> {
    const record = await this.store.get(requireOrganization(context, true), id);
    if (record.kind !== 'contributor-reward')
      throw new WorkflowError('NOT_FOUND', 'Reward not found.', 404);
    return record;
  }

  async prepare(context: WorkflowContext, id: string) {
    const run = new WorkflowRun('contributor-reward-prepare', context, this.delayMs);
    return run.execute(async () => {
      const record = await run.step('load-staged-payout', () => this.load(context, id));
      if (record.status !== 'staged') return publicReward(record);
      const payer = await run.step('resolve-organization-payer', async () => {
        const result = await pool.query<{ public_key: string }>(
          'SELECT public_key FROM organizations WHERE id = $1',
          [record.organization_id]
        );
        const address = stellarAddress.safeParse(result.rows[0]?.public_key);
        if (!address.success)
          throw new WorkflowError('INVALID_PAYER', 'Organization needs a Stellar public key.');
        if (address.data === record.data.contributorAddress) {
          throw new WorkflowError('INVALID_PAYER', 'Payer and reward recipient must differ.');
        }
        return address.data;
      });
      const unsignedXdr = await run.step('prepare-payment', () =>
        this.gateway.prepare(
          payer,
          String(record.data.contributorAddress),
          String(record.data.amount),
          record.id
        )
      );
      // Competing prepares may build envelopes, but only one envelope is ever persisted/returned.
      const prepared = await run.step(
        'persist-payment-envelope',
        () =>
          this.store.transition(record, 'awaiting_signature', {
            ...record.data,
            payer,
            unsignedXdr,
          }),
        false
      );
      return publicReward(prepared);
    });
  }

  async distribute(context: WorkflowContext, id: string, signedXdr?: string) {
    const run = new WorkflowRun('contributor-reward-distribution', context, this.delayMs);
    return run.execute(async () => {
      let record = await run.step('load-payout', () => this.load(context, id));
      if (['confirmed', 'failed'].includes(record.status)) return publicReward(record);
      if (record.status === 'awaiting_signature') {
        const envelope = await run.step('validate-signed-envelope', async () => {
          try {
            const tx = TransactionBuilder.fromXDR(
              signedXdr ?? '',
              StellarService.getNetworkPassphrase()
            );
            const expected = TransactionBuilder.fromXDR(
              String(record.data.unsignedXdr),
              StellarService.getNetworkPassphrase()
            );
            if (
              !(tx instanceof Transaction) ||
              !tx.signatures.length ||
              !tx.hash().equals(expected.hash())
            ) {
              throw new Error('Envelope mismatch');
            }
            return { signedXdr: tx.toXDR(), txHash: tx.hash().toString('hex') };
          } catch {
            throw new WorkflowError('INVALID_ENVELOPE', 'Sign the exact staged payment envelope.');
          }
        });
        record = await run.step(
          'claim-payout',
          () =>
            this.store.transition(record, 'submitted', {
              ...record.data,
              ...envelope,
            }),
          false
        );
      }
      if (record.status !== 'submitted')
        throw new WorkflowError('NOT_PREPARED', 'Prepare and sign this payout first.', 409);
      // Check before resubmitting: an earlier call may have succeeded on chain.
      let receipt: { successful: boolean } | undefined;
      await run.step('lookup-existing-payment', async () => {
        try {
          receipt = await this.gateway.confirm(String(record.data.txHash));
        } catch (error) {
          if (!(error instanceof NotReadyError)) throw error;
        }
      });
      if (!receipt) {
        // A definite ledger result can still be retrieved after a submit response error.
        try {
          await run.step('submit-payment', () =>
            this.gateway.submit(String(record.data.signedXdr))
          );
        } catch {
          // Keep submitted durable. Confirmation decides whether the payment was applied.
        }
        receipt = await run.step('confirm-payment', () =>
          this.gateway.confirm(String(record.data.txHash))
        );
      }
      const status = receipt.successful ? 'confirmed' : 'failed';
      const completed = await run.step(
        'record-payment-result',
        () =>
          this.store.transition(record, status, {
            ...record.data,
            confirmedAt: new Date().toISOString(),
          }),
        false
      );
      return publicReward(completed);
    });
  }
}

/** Signed envelopes are internal recovery data, never part of list/status responses. */
export function publicReward(record: WorkflowRecord): WorkflowRecord {
  const data = { ...record.data };
  delete data.signedXdr;
  return { ...record, data };
}
