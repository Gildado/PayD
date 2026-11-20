import { Keypair } from '@stellar/stellar-sdk';
import { z } from 'zod';
import { FreezeService } from '../services/freezeService.js';
import { TrustlineService } from '../services/trustlineService.js';
import {
  NotReadyError,
  WorkflowError,
  WorkflowRun,
  requireOrganization,
  type WorkflowContext,
} from './runtime.js';
import { PostgresWorkflowStore, type WorkflowStore } from './store.js';
import { scopedEmployee, stellarAddress } from './trustlineSetupWorkflow.js';

export const appealSchema = z
  .object({
    employeeId: z.number().int().positive(),
    assetCode: z.string().regex(/^[A-Za-z0-9]{1,12}$/),
    assetIssuer: stellarAddress,
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();

export const reviewSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().min(10).max(1000),
    issuerSecret: z.string().optional(),
  })
  .strict();

export class FreezeAppealWorkflow {
  constructor(
    private readonly store: WorkflowStore = new PostgresWorkflowStore(),
    private readonly freeze = FreezeService,
    private readonly trustlines = TrustlineService,
    private readonly delayMs = 100
  ) {}

  async submit(context: WorkflowContext, input: z.infer<typeof appealSchema>) {
    const run = new WorkflowRun('freeze-appeal-submit', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context);
      input = appealSchema.parse(input);
      const targetAccount = await run.step('resolve-employee', () =>
        scopedEmployee(context, input.employeeId)
      );
      const frozen = await run.step('check-freeze', () =>
        this.freeze.isFrozen(targetAccount, input.assetCode, input.assetIssuer)
      );
      const log = await run.step('load-freeze-evidence', () =>
        this.freeze.getLatestLog(targetAccount, input.assetCode, input.assetIssuer)
      );
      if (!frozen || log?.action !== 'freeze') {
        throw new WorkflowError(
          'NOT_FROZEN',
          'An active, audited freeze is required for an appeal.'
        );
      }
      return run.step('stage-appeal', () =>
        this.store.create(
          organizationId,
          'freeze-appeal',
          `${input.employeeId}:${input.assetCode}:${input.assetIssuer}:${log.id}`,
          'pending_review',
          {
            ...input,
            targetAccount,
            freezeLogId: log.id,
            submittedBy: context.id,
          }
        )
      );
    });
  }

  async review(context: WorkflowContext, id: string, input: z.infer<typeof reviewSchema>) {
    const run = new WorkflowRun('freeze-appeal-review', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      input = reviewSchema.parse(input);
      let record = await run.step('load-appeal', () => this.store.get(organizationId, id));
      if (record.kind !== 'freeze-appeal')
        throw new WorkflowError('NOT_FOUND', 'Appeal not found.', 404);
      if (['rejected', 'unfrozen'].includes(record.status)) return record;
      const data = record.data;
      // Re-check membership and wallet binding; an appeal cannot target an arbitrary account.
      const wallet = await run.step('verify-employee-scope', () =>
        scopedEmployee(context, Number(data.employeeId))
      );
      if (wallet !== data.targetAccount)
        throw new WorkflowError('CONFLICT', 'Employee wallet changed.', 409);
      const assetCode = String(data.assetCode);
      const issuer = String(data.assetIssuer);
      if (record.status !== 'pending_review') {
        // toggleAccountFreeze signs a new transaction internally. Never retry it after an
        // ambiguous failure. Reconcile with its audit log and on-chain state instead.
        const log = await run.step('reconcile-unfreeze-log', () =>
          this.freeze.getLatestLog(wallet, assetCode, issuer)
        );
        const frozen = await run.step('reconcile-freeze-state', () =>
          this.freeze.isFrozen(wallet, assetCode, issuer)
        );
        if (
          !frozen &&
          log?.action === 'unfreeze' &&
          log.id > Number(data.freezeLogId) &&
          log.tx_hash
        ) {
          return run.step(
            'record-reconciled-resolution',
            () =>
              this.store.transition(record, 'unfrozen', {
                ...data,
                txHash: log.tx_hash,
              }),
            false
          );
        }
        return { ...record, reconciliationRequired: true };
      }
      if (input.decision === 'reject') {
        return run.step(
          'record-rejection',
          () =>
            this.store.transition(record, 'rejected', {
              ...data,
              reviewedBy: context.id,
              reviewReason: input.reason,
            }),
          false
        );
      }
      let issuerKeypair: Keypair;
      try {
        issuerKeypair = Keypair.fromSecret(input.issuerSecret ?? '');
      } catch {
        throw new WorkflowError('INVALID_ISSUER', 'Approval requires a valid issuer signing key.');
      }
      if (issuerKeypair.publicKey() !== issuer) {
        throw new WorkflowError(
          'INVALID_ISSUER',
          'Signing key does not match the appeal asset issuer.'
        );
      }
      const trustline = await run.step('verify-trustline', () =>
        this.trustlines.checkTrustline(wallet, assetCode, issuer)
      );
      const log = await run.step('verify-current-freeze', () =>
        this.freeze.getLatestLog(wallet, assetCode, issuer)
      );
      if (!trustline.exists || log?.id !== data.freezeLogId) {
        throw new WorkflowError('STALE_APPEAL', 'The trustline or freeze evidence has changed.');
      }
      record = await run.step(
        'claim-review',
        () =>
          this.store.transition(record, 'executing', {
            ...data,
            reviewedBy: context.id,
            reviewReason: input.reason,
          }),
        false
      );
      const result = await run.step(
        'execute-unfreeze',
        () =>
          this.freeze.toggleAccountFreeze(
            issuerKeypair,
            wallet,
            assetCode,
            'unfreeze',
            input.reason
          ),
        false
      );
      // A persistence/confirmation failure leaves executing durable, so the next call only reconciles.
      await run.step('confirm-unfreeze', async () => {
        if (await this.freeze.isFrozen(wallet, assetCode, issuer)) {
          throw new NotReadyError('Unfreeze is not yet visible.');
        }
      });
      return run.step(
        'record-resolution',
        () =>
          this.store.transition(record, 'unfrozen', {
            ...record.data,
            txHash: result.txHash,
          }),
        false
      );
    });
  }
}
