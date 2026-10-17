import { z } from 'zod';
import { pool } from '../config/database.js';
import { ContractUpgradeService } from '../services/contractUpgradeService.js';
import {
  NotificationService,
  type WorkflowNotificationOptions,
} from '../services/notificationService.js';
import { StellarService } from '../services/stellarService.js';
import { sendWorkflowNotificationOnce } from './notificationDelivery.js';
import {
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';
import { PostgresWorkflowStore, type WorkflowRecord, type WorkflowStore } from './store.js';
import { stellarAddress } from './trustlineSetupWorkflow.js';

export const contractUpgradeProposalSchema = z
  .object({
    registryId: z.number().int().positive(),
    newWasmHash: z.string().regex(/^[0-9a-f]{64}$/i),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export interface UpgradeSigner {
  employeeId: number;
  walletAddress: string;
}

export interface ContractUpgradeProposalGateway {
  getOrganizationPublicKey(organizationId: number): Promise<string>;
  validateWasmHash(
    registryId: number,
    newWasmHash: string
  ): Promise<{
    valid: boolean;
    reason?: string;
  }>;
  simulateUpgrade(
    registryId: number,
    newWasmHash: string,
    initiatedBy: string,
    notes?: string
  ): Promise<{ upgradeLogId: number; simulation: { success: boolean; error: string | null } }>;
  getSignerEmployees(
    organizationId: number,
    organizationPublicKey: string
  ): Promise<UpgradeSigner[]>;
}

export class StellarContractUpgradeProposalGateway implements ContractUpgradeProposalGateway {
  async getOrganizationPublicKey(organizationId: number): Promise<string> {
    const result = await pool.query<{ public_key: string | null }>(
      'SELECT public_key FROM organizations WHERE id = $1',
      [organizationId]
    );
    const address = stellarAddress.safeParse(result.rows[0]?.public_key);
    if (!address.success) {
      throw new WorkflowError(
        'INVALID_ORGANIZATION_KEY',
        'Organization needs a valid Stellar public key.'
      );
    }
    return address.data;
  }

  validateWasmHash(registryId: number, newWasmHash: string) {
    return ContractUpgradeService.validateWasmHash(registryId, newWasmHash);
  }

  simulateUpgrade(registryId: number, newWasmHash: string, initiatedBy: string, notes?: string) {
    return ContractUpgradeService.simulateUpgrade(registryId, newWasmHash, initiatedBy, notes);
  }

  async getSignerEmployees(
    organizationId: number,
    organizationPublicKey: string
  ): Promise<UpgradeSigner[]> {
    const signerKeys = await StellarService.getAccountSigners(organizationPublicKey);
    const addresses = [...new Set(signerKeys.map((signer) => signer.key).filter(Boolean))];
    if (!addresses.length) return [];
    const result = await pool.query<{ id: number; wallet_address: string }>(
      `SELECT id, wallet_address FROM employees
       WHERE organization_id = $1 AND status = 'active' AND wallet_address = ANY($2::text[])`,
      [organizationId, addresses]
    );
    return result.rows.map((row) => ({ employeeId: row.id, walletAddress: row.wallet_address }));
  }
}

export class ContractUpgradeProposalWorkflow {
  constructor(
    private readonly store: WorkflowStore = new PostgresWorkflowStore(),
    private readonly gateway: ContractUpgradeProposalGateway = new StellarContractUpgradeProposalGateway(),
    private readonly notifier: Pick<
      NotificationService,
      'sendWorkflowNotification'
    > = new NotificationService(),
    private readonly delayMs = 100
  ) {}

  async execute(context: WorkflowContext, input: z.infer<typeof contractUpgradeProposalSchema>) {
    const run = new WorkflowRun('contract-upgrade-proposal', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      input = contractUpgradeProposalSchema.parse(input);

      const organizationPublicKey = await run.step('resolve-organization-key', () =>
        this.gateway.getOrganizationPublicKey(organizationId)
      );
      let proposal = await run.step('stage-proposal', () =>
        this.store.create(
          organizationId,
          'contract-upgrade-proposal',
          `${input.registryId}:${input.newWasmHash.toLowerCase()}`,
          'pending',
          {
            registryId: input.registryId,
            newWasmHash: input.newWasmHash.toLowerCase(),
            notes: input.notes ?? null,
            initiatedBy: organizationPublicKey,
            notifiedSignerIds: [],
          }
        )
      );

      if (
        Number(proposal.data.registryId) !== input.registryId ||
        String(proposal.data.newWasmHash).toLowerCase() !== input.newWasmHash.toLowerCase() ||
        proposal.data.notes !== (input.notes ?? null)
      ) {
        throw new WorkflowError(
          'CONFLICT',
          'An upgrade proposal already exists with different metadata.',
          409
        );
      }
      if (proposal.status === 'completed') return proposal;
      if (proposal.status === 'simulating') {
        return { ...proposal, operationPending: true };
      }
      if (proposal.status === 'failed') return proposal;

      if (proposal.data.upgradeLogId === undefined) {
        const validation = await run.step('validate-wasm', () =>
          this.gateway.validateWasmHash(input.registryId, input.newWasmHash)
        );
        if (!validation.valid) {
          throw new WorkflowError('INVALID_WASM', validation.reason ?? 'WASM validation failed.');
        }
        proposal = await run.step(
          'claim-simulation',
          () => this.store.transition(proposal, 'simulating'),
          false
        );
        const simulation = await run.step(
          'simulate-upgrade',
          () =>
            this.gateway.simulateUpgrade(
              input.registryId,
              input.newWasmHash,
              organizationPublicKey,
              input.notes
            ),
          false
        );
        if (!simulation.simulation.success) {
          await run.step(
            'record-simulation-failure',
            () =>
              this.store.transition(proposal, 'failed', {
                ...proposal.data,
                simulationError: simulation.simulation.error,
              }),
            false
          );
          throw new WorkflowError(
            'SIMULATION_FAILED',
            simulation.simulation.error ?? 'Upgrade simulation failed.'
          );
        }
        proposal = await run.step(
          'record-simulation',
          () =>
            this.store.transition(proposal, 'notifying', {
              ...proposal.data,
              upgradeLogId: simulation.upgradeLogId,
              simulation: simulation.simulation,
            }),
          false
        );
      }

      const signers = await run.step('resolve-signers', () =>
        this.gateway.getSignerEmployees(organizationId, organizationPublicKey)
      );
      if (!signers.length) {
        throw new WorkflowError(
          'NO_SIGNER_CONTACTS',
          'No active employee contacts match the contract signers.'
        );
      }

      const notifiedSignerIds = new Set(
        Array.isArray(proposal.data.notifiedSignerIds)
          ? proposal.data.notifiedSignerIds.map(Number)
          : []
      );
      for (const signer of signers) {
        if (notifiedSignerIds.has(signer.employeeId)) continue;
        const deliveryStatus = await sendWorkflowNotificationOnce(run, this.store, this.notifier, {
          organizationId,
          employeeId: signer.employeeId,
          eventKey: `contract-upgrade:${proposal.id}`,
          title: 'Contract upgrade proposal requires review',
          message: `Contract registry entry ${input.registryId} has a simulated upgrade proposal. Review its metadata and approve or reject it through the contract upgrade workflow.`,
        });
        if (deliveryStatus === 'pending') return { ...proposal, notificationPending: true };
        notifiedSignerIds.add(signer.employeeId);
        proposal = await run.step(
          'record-signer-notification',
          () =>
            this.store.transition(proposal, 'notifying', {
              ...proposal.data,
              notifiedSignerIds: [...notifiedSignerIds],
            }),
          false
        );
      }

      proposal = await run.step(
        'complete-proposal',
        () => this.store.transition(proposal, 'completed'),
        false
      );
      return proposal;
    });
  }
}

export function publicUpgradeProposal(record: WorkflowRecord): WorkflowRecord {
  return record;
}
