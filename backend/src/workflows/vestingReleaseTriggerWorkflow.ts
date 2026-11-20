/**
 * Vesting Release Trigger Orchestration Workflow (#1239)
 *
 * Evaluates whether the release conditions for a vesting grant are met and,
 * if so, triggers the on-chain `claim` call against the VestingEscrow Soroban
 * contract.  Previously this required manual intervention; this workflow agent
 * automates the evaluation → trigger → confirm cycle with full observability.
 *
 * The workflow is scoped to the `contracts/vesting_escrow/src/lib.rs` contract
 * interface and the `frontend/src/pages/VestingManagement.tsx` UI surface.
 *
 * Workflow steps:
 *   1. validate-input        – schema validation and ownership check.
 *   2. check-release-conditions – query the contract for claimable amount.
 *   3. trigger-claim         – invoke the Soroban `claim` function on-chain.
 *   4. confirm-claim         – verify the token transfer was recorded on-chain.
 *   5. update-vesting-record – persist the release event to the database.
 */

import { Keypair, Contract, SorobanRpc, TransactionBuilder, Networks } from '@stellar/stellar-sdk';
import { z } from 'zod';
import {
  requireOrganization,
  WorkflowError,
  NotReadyError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';
import { StellarService } from '../services/stellarService.js';
import { pool } from '../config/database.js';

// ── Input schema ──────────────────────────────────────────────────────────────

export const vestingReleaseInputSchema = z
  .object({
    /** The Soroban contract address of the vesting escrow instance. */
    contractId: z.string().min(1, 'contractId is required'),
    /** Stellar secret key of the beneficiary that will call `claim`. */
    beneficiarySecret: z.string().min(1, 'beneficiarySecret is required'),
    /**
     * If true, the workflow will exit successfully even when the claimable
     * amount is zero (i.e. nothing to release yet), recording it as a
     * `no_release_needed` outcome instead of an error.
     */
    allowNoRelease: z.boolean().optional().default(false),
  })
  .strict();

export type VestingReleaseInput = z.infer<typeof vestingReleaseInputSchema>;

export interface VestingReleaseResult {
  contractId: string;
  status: 'released' | 'no_release_needed';
  claimableAmount: string;
  txHash?: string;
}

// ── Workflow ──────────────────────────────────────────────────────────────────

export class VestingReleaseTriggerWorkflow {
  constructor(
    private readonly stellarService = StellarService,
    private readonly dbPool = pool,
    private readonly delayMs = 100
  ) {}

  /**
   * Evaluate vesting release conditions and trigger the on-chain claim.
   *
   * @param context - JWT payload of the authenticated caller.
   * @param input   - Contract address, beneficiary credentials, and options.
   */
  async execute(
    context: WorkflowContext,
    input: VestingReleaseInput
  ) {
    const run = new WorkflowRun('vesting-release-trigger', context, this.delayMs);

    return run.execute(async () => {
      requireOrganization(context);

      // ── Step 1: Validate input ──────────────────────────────────────────────
      const validated = await run.step(
        'validate-input',
        async () => {
          const result = vestingReleaseInputSchema.safeParse(input);
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

      let beneficiaryKeypair: Keypair;
      try {
        beneficiaryKeypair = Keypair.fromSecret(validated.beneficiarySecret);
      } catch {
        throw new WorkflowError('INVALID_INPUT', 'Invalid beneficiary secret key.');
      }

      // ── Step 2: Check release conditions ───────────────────────────────────
      // Query the contract's `get_claimable_amount` view to decide whether a
      // claim is warranted before spending fees on a state-changing transaction.
      const { claimableAmount, isClaimable } = await run.step(
        'check-release-conditions',
        async () => {
          const server = this.stellarService.getServer() as SorobanRpc.Server;
          const contract = new Contract(validated.contractId);

          // Simulate `get_claimable_amount` — this is a read-only call.
          const account = await server.getAccount(beneficiaryKeypair.publicKey()).catch(() => {
            throw new WorkflowError(
              'PREFLIGHT_FAILED',
              'Beneficiary account not found on the Stellar network.'
            );
          });

          const networkPassphrase = this.stellarService.getNetworkPassphrase();

          const simulationTx = new TransactionBuilder(account, {
            fee: '1000',
            networkPassphrase,
          })
            .addOperation(contract.call('get_claimable_amount'))
            .setTimeout(60)
            .build();

          const sim = await server.simulateTransaction(simulationTx);

          if (SorobanRpc.Api.isSimulationError(sim)) {
            throw new WorkflowError(
              'CONTRACT_ERROR',
              `Contract simulation failed: ${sim.error}`
            );
          }

          // Extract the i128 claimable amount from the simulation result.
          // The Soroban SDK returns it as an XDR ScVal; we read it as a BigInt.
          const resultXdr =
            (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result?.retval;

          let rawAmount = 0n;
          if (resultXdr) {
            try {
              // scVal.value() for Int128 parts gives { lo: BigInt, hi: BigInt }
              const scVal = resultXdr;
              // Attempt standard i128 extraction via toI128().
              const i128 = (scVal as any).i128?.();
              if (i128 !== undefined) {
                rawAmount = BigInt(i128.toString());
              } else {
                // Fallback: treat as integer type.
                rawAmount = BigInt((scVal as any).int64?.() ?? (scVal as any).uint64?.() ?? 0);
              }
            } catch {
              rawAmount = 0n;
            }
          }

          return {
            claimableAmount: rawAmount.toString(),
            isClaimable: rawAmount > 0n,
          };
        }
      );

      // If nothing is claimable, optionally exit gracefully.
      if (!isClaimable) {
        if (validated.allowNoRelease) {
          return {
            contractId: validated.contractId,
            status: 'no_release_needed',
            claimableAmount,
          } satisfies VestingReleaseResult;
        }
        throw new WorkflowError(
          'NOT_READY',
          'No tokens are claimable at this time — cliff may not have passed yet.',
          409
        );
      }

      // ── Step 3: Trigger the on-chain `claim` call ──────────────────────────
      const txHash = await run.step('trigger-claim', async () => {
        const server = this.stellarService.getServer() as SorobanRpc.Server;
        const contract = new Contract(validated.contractId);
        const networkPassphrase = this.stellarService.getNetworkPassphrase();

        const account = await server
          .getAccount(beneficiaryKeypair.publicKey())
          .catch(() => {
            throw new WorkflowError(
              'PREFLIGHT_FAILED',
              'Beneficiary account not found when building claim transaction.'
            );
          });

        const tx = new TransactionBuilder(account, {
          fee: '10000',
          networkPassphrase,
        })
          .addOperation(contract.call('claim'))
          .setTimeout(180)
          .build();

        // Prepare the transaction (assembles footprint from simulation).
        const preparedTx = await server.prepareTransaction(tx).catch((err: Error) => {
          throw new WorkflowError(
            'CONTRACT_ERROR',
            `Transaction preparation failed: ${err.message}`
          );
        });

        preparedTx.sign(beneficiaryKeypair);

        const result = await server.sendTransaction(preparedTx).catch((err: Error) => {
          throw Object.assign(err, { response: { status: 503 } }); // treat as transient
        });

        if (result.status === 'ERROR') {
          throw new WorkflowError(
            'CLAIM_FAILED',
            `Soroban transaction failed: ${result.errorResult?.toXDR('base64') ?? 'unknown error'}`
          );
        }

        return result.hash;
      });

      // ── Step 4: Confirm the claim was finalised on-chain ──────────────────
      await run.step('confirm-claim', async () => {
        const server = this.stellarService.getServer() as SorobanRpc.Server;

        // Poll for transaction finality.  A `NotReadyError` signals the step
        // runner to retry with exponential back-off (up to 3 attempts).
        const status = await server.getTransaction(txHash).catch((err: Error) => {
          throw Object.assign(err, { response: { status: 503 } });
        });

        if (status.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
          throw new NotReadyError(`Transaction ${txHash} not yet finalised.`);
        }

        if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
          throw new WorkflowError(
            'CLAIM_FAILED',
            `On-chain claim transaction failed. Hash: ${txHash}`
          );
        }
      });

      // ── Step 5: Persist the vesting release event ─────────────────────────
      await run.step('update-vesting-record', async () => {
        await this.dbPool
          .query(
            `INSERT INTO vesting_release_events
               (contract_id, beneficiary_address, organization_id, claimable_amount, tx_hash, released_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT DO NOTHING`,
            [
              validated.contractId,
              beneficiaryKeypair.publicKey(),
              context.organizationId ?? null,
              claimableAmount,
              txHash,
            ]
          )
          .catch(() => {
            // DB write failure must not roll back the on-chain release.
          });
      });

      return {
        contractId: validated.contractId,
        status: 'released',
        claimableAmount,
        txHash,
      } satisfies VestingReleaseResult;
    });
  }
}
