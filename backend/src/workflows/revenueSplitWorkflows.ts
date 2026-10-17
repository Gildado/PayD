import {
  Address,
  Contract,
  SorobanRpc,
  StrKey,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { ContractUpgradeService } from '../services/contractUpgradeService.js';
import { StellarService } from '../services/stellarService.js';
import {
  NotReadyError,
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';
import { PostgresWorkflowStore, type WorkflowRecord, type WorkflowStore } from './store.js';

const allocationSchema = z.object({
  recipient: z.string().refine(StrKey.isValidEd25519PublicKey, 'Invalid recipient address'),
  basisPoints: z.number().int().min(1).max(10_000),
});

export const recipientUpdateSchema = z
  .object({
    registryId: z.number().int().positive(),
    allocations: z.array(allocationSchema).min(1).max(100),
  })
  .strict()
  .superRefine(({ allocations }, context) => {
    if (allocations.reduce((sum, item) => sum + item.basisPoints, 0) !== 10_000) {
      context.addIssue({
        code: 'custom',
        message: 'Recipient shares must sum to 10000 basis points.',
      });
    }
    const recipients = new Set(allocations.map((item) => item.recipient));
    if (recipients.size !== allocations.length) {
      context.addIssue({ code: 'custom', message: 'Recipient addresses must be unique.' });
    }
  });

export const distributionSchema = z
  .object({
    requestId: z.string().uuid(),
    registryId: z.number().int().positive(),
    tokenAddress: z.string().refine(StrKey.isValidContract, 'Invalid token contract address'),
    amount: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/),
  })
  .strict()
  .refine((value) => Number(value.amount) > 0, 'Distribution amount must be positive.')
  .refine(
    (value) => amountToStroops(value.amount) <= 170141183460469231731687303715884105727n,
    'Distribution amount exceeds the contract i128 limit.'
  );

export interface SplitAllocation {
  recipient: string;
  basisPoints: number;
}

export interface RevenueSplitGateway {
  getOrganizationPublicKey(organizationId: number): Promise<string>;
  prepareRecipientUpdate(
    registryId: number,
    admin: string,
    allocations: SplitAllocation[]
  ): Promise<string>;
  prepareDistribution(
    registryId: number,
    admin: string,
    tokenAddress: string,
    amount: string
  ): Promise<string>;
  submit(signedXdr: string): Promise<void>;
  confirm(hash: string): Promise<{ successful: boolean }>;
  transactionHash(signedXdr: string): string;
  validateSignedEnvelope(unsignedXdr: string, signedXdr: string): string;
}

function amountToStroops(amount: string): bigint {
  const [units = '0', fraction = ''] = amount.split('.');
  return BigInt(units) * 10_000_000n + BigInt(fraction.padEnd(7, '0'));
}

function recipientSharesValue(allocations: SplitAllocation[]): xdr.ScVal {
  return xdr.ScVal.scvVec(
    allocations.map(({ recipient, basisPoints }) =>
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('destination'),
          val: Address.fromString(recipient).toScVal(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('basis_points'),
          val: xdr.ScVal.scvU32(basisPoints),
        }),
      ])
    )
  );
}

export class StellarRevenueSplitGateway implements RevenueSplitGateway {
  private readonly server = new SorobanRpc.Server(
    (process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org').replace(/\/+$/, ''),
    { allowHttp: false }
  );

  async getOrganizationPublicKey(organizationId: number): Promise<string> {
    const result = await pool.query<{ public_key: string | null }>(
      'SELECT public_key FROM organizations WHERE id = $1',
      [organizationId]
    );
    const key = result.rows[0]?.public_key;
    if (!key || !StrKey.isValidEd25519PublicKey(key)) {
      throw new WorkflowError(
        'INVALID_ORGANIZATION_KEY',
        'Organization needs a valid Stellar public key.'
      );
    }
    return key;
  }

  private async contractAddress(registryId: number): Promise<string> {
    const record = await ContractUpgradeService.getContract(registryId);
    if (!record || !StrKey.isValidContract(record.contract_id)) {
      throw new WorkflowError(
        'NOT_FOUND',
        'Revenue split contract was not found in the registry.',
        404
      );
    }
    return record.contract_id;
  }

  private async simulateCall(
    contractId: string,
    source: string,
    method: string,
    args: xdr.ScVal[]
  ) {
    const account = await this.server.getAccount(source);
    const transaction = new TransactionBuilder(account, {
      fee: '1000000',
      networkPassphrase: StellarService.getNetworkPassphrase(),
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(60)
      .build();
    const response = await this.server.simulateTransaction(transaction);
    if (!SorobanRpc.Api.isSimulationSuccess(response)) {
      const message = SorobanRpc.Api.isSimulationError(response)
        ? response.error
        : 'Soroban simulation did not succeed.';
      throw new WorkflowError('SIMULATION_FAILED', message, 409);
    }
    return { transaction, response };
  }

  private async assertAdmin(contractId: string, admin: string): Promise<void> {
    const { response } = await this.simulateCall(contractId, admin, 'get_admin', []);
    const retval = response.result?.retval;
    const contractAdmin = retval ? scValToNative(retval) : undefined;
    if (String(contractAdmin) !== admin) {
      throw new WorkflowError(
        'FORBIDDEN',
        'Organization wallet is not the revenue split contract admin.',
        403
      );
    }
  }

  private async prepare(contractId: string, source: string, method: string, args: xdr.ScVal[]) {
    await this.assertAdmin(contractId, source);
    const { transaction, response } = await this.simulateCall(contractId, source, method, args);
    return SorobanRpc.assembleTransaction(transaction, response).build().toXDR();
  }

  async prepareRecipientUpdate(registryId: number, admin: string, allocations: SplitAllocation[]) {
    const contractId = await this.contractAddress(registryId);
    return this.prepare(contractId, admin, 'update_recipients', [
      recipientSharesValue(allocations),
    ]);
  }

  async prepareDistribution(
    registryId: number,
    admin: string,
    tokenAddress: string,
    amount: string
  ) {
    const contractId = await this.contractAddress(registryId);
    const stroops = amountToStroops(amount);
    const preview = await this.simulateCall(contractId, admin, 'preview_distribution', [
      nativeToScVal(stroops, { type: 'i128' }),
    ]);
    const previewValue = preview.response.result?.retval
      ? scValToNative(preview.response.result.retval)
      : undefined;
    if (!Array.isArray(previewValue) || previewValue.length === 0) {
      throw new WorkflowError('INVALID_DISTRIBUTION', 'Revenue split distribution preview failed.');
    }
    const shareTotal = previewValue.reduce((sum, item) => {
      const share = item as { basis_points?: number; basisPoints?: number };
      return sum + Number(share.basis_points ?? share.basisPoints ?? 0);
    }, 0);
    if (shareTotal !== 10_000) {
      throw new WorkflowError(
        'INVALID_SHARES',
        'Configured revenue split shares must total 10000 basis points.'
      );
    }
    return this.prepare(contractId, admin, 'distribute', [
      Address.fromString(tokenAddress).toScVal(),
      Address.fromString(admin).toScVal(),
      nativeToScVal(stroops, { type: 'i128' }),
    ]);
  }

  transactionHash(signedXdr: string): string {
    const transaction = TransactionBuilder.fromXDR(
      signedXdr,
      StellarService.getNetworkPassphrase()
    );
    if (!(transaction instanceof Transaction) || !transaction.signatures.length) {
      throw new WorkflowError('INVALID_ENVELOPE', 'A signed Soroban transaction is required.');
    }
    return transaction.hash().toString('hex');
  }

  validateSignedEnvelope(unsignedXdr: string, signedXdr: string): string {
    try {
      const expected = TransactionBuilder.fromXDR(
        unsignedXdr,
        StellarService.getNetworkPassphrase()
      );
      const signed = TransactionBuilder.fromXDR(signedXdr, StellarService.getNetworkPassphrase());
      if (
        !(expected instanceof Transaction) ||
        !(signed instanceof Transaction) ||
        !signed.signatures.length ||
        !expected.hash().equals(signed.hash())
      ) {
        throw new Error('Envelope mismatch');
      }
      return signed.hash().toString('hex');
    } catch {
      throw new WorkflowError(
        'INVALID_ENVELOPE',
        'Sign the exact staged revenue split transaction.'
      );
    }
  }

  async submit(signedXdr: string): Promise<void> {
    const transaction = TransactionBuilder.fromXDR(
      signedXdr,
      StellarService.getNetworkPassphrase()
    );
    if (!(transaction instanceof Transaction)) {
      throw new WorkflowError('INVALID_ENVELOPE', 'A Soroban transaction is required.');
    }
    const response = await this.server.sendTransaction(transaction);
    if (response.status === 'ERROR') throw new Error('Soroban transaction submission failed.');
  }

  async confirm(hash: string): Promise<{ successful: boolean }> {
    const response = await this.server.getTransaction(hash);
    if (response.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
      throw new NotReadyError('Soroban transaction is not yet indexed.');
    }
    return { successful: response.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS };
  }
}

abstract class RevenueSplitTransactionWorkflow {
  protected constructor(
    protected readonly kind: 'revenue-split-distribution' | 'revenue-split-recipients',
    protected readonly name: string,
    protected readonly store: WorkflowStore,
    protected readonly gateway: RevenueSplitGateway,
    protected readonly delayMs: number
  ) {}

  protected async executeTransaction(context: WorkflowContext, id: string, signedXdr?: string) {
    const run = new WorkflowRun(this.name, context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      let record = await run.step('load-staged-transaction', async () => {
        const loaded = await this.store.get(organizationId, id);
        if (loaded.kind !== this.kind)
          throw new WorkflowError('NOT_FOUND', 'Revenue split workflow not found.', 404);
        return loaded;
      });
      if (record.status === 'confirmed' || record.status === 'failed') {
        return publicRevenueSplitRecord(record);
      }
      if (record.status === 'awaiting_signature') {
        const txHash = await run.step('validate-signed-envelope', async () =>
          this.gateway.validateSignedEnvelope(String(record.data.unsignedXdr), signedXdr ?? '')
        );
        record = await run.step(
          'claim-transaction',
          () => this.store.transition(record, 'submitted', { ...record.data, signedXdr, txHash }),
          false
        );
      }
      if (record.status !== 'submitted') {
        throw new WorkflowError('NOT_PREPARED', 'Prepare and sign this transaction first.', 409);
      }

      let receipt: { successful: boolean } | undefined;
      await run.step('lookup-transaction', async () => {
        try {
          receipt = await this.gateway.confirm(String(record.data.txHash));
        } catch (error) {
          if (!(error instanceof NotReadyError)) throw error;
        }
      });
      if (!receipt) {
        try {
          await run.step(
            'submit-signed-transaction',
            () => this.gateway.submit(String(record.data.signedXdr)),
            false
          );
        } catch {
          // A lost response is ambiguous; confirmation decides whether the exact envelope landed.
        }
        receipt = await run.step('confirm-transaction', () =>
          this.gateway.confirm(String(record.data.txHash))
        );
      }
      const completed = await run.step(
        'record-transaction-result',
        () => this.store.transition(record, receipt!.successful ? 'confirmed' : 'failed'),
        false
      );
      return publicRevenueSplitRecord(completed);
    });
  }
}

export class RevenueSplitRecipientWorkflow extends RevenueSplitTransactionWorkflow {
  constructor(
    store: WorkflowStore = new PostgresWorkflowStore(),
    gateway: RevenueSplitGateway = new StellarRevenueSplitGateway(),
    delayMs = 100
  ) {
    super('revenue-split-recipients', 'revenue-split-recipient-update', store, gateway, delayMs);
  }

  async prepare(context: WorkflowContext, input: z.infer<typeof recipientUpdateSchema>) {
    const run = new WorkflowRun(this.name, context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      input = recipientUpdateSchema.parse(input);
      const admin = await run.step('resolve-organization-admin', () =>
        this.gateway.getOrganizationPublicKey(organizationId)
      );
      const reference = `${input.registryId}:${JSON.stringify(input.allocations)}`;
      let record = await run.step('stage-recipient-update', () =>
        this.store.create(organizationId, this.kind, reference, 'pending', {
          registryId: input.registryId,
          allocations: input.allocations,
          admin,
        })
      );
      if (
        String(record.data.admin) !== admin ||
        JSON.stringify(record.data.allocations) !== JSON.stringify(input.allocations)
      ) {
        throw new WorkflowError(
          'CONFLICT',
          'Organization admin or allocation data changed; start a new update.',
          409
        );
      }
      if (record.status !== 'pending') return publicRevenueSplitRecord(record);
      const unsignedXdr = await run.step('simulate-recipient-update', () =>
        this.gateway.prepareRecipientUpdate(input.registryId, admin, input.allocations)
      );
      record = await run.step(
        'record-unsigned-update',
        () => this.store.transition(record, 'awaiting_signature', { ...record.data, unsignedXdr }),
        false
      );
      return { ...publicRevenueSplitRecord(record), unsignedXdr };
    });
  }

  execute(context: WorkflowContext, id: string, signedXdr?: string) {
    return this.executeTransaction(context, id, signedXdr);
  }
}

export class RevenueSplitDistributionWorkflow extends RevenueSplitTransactionWorkflow {
  constructor(
    store: WorkflowStore = new PostgresWorkflowStore(),
    gateway: RevenueSplitGateway = new StellarRevenueSplitGateway(),
    delayMs = 100
  ) {
    super('revenue-split-distribution', 'revenue-split-distribution', store, gateway, delayMs);
  }

  async prepare(context: WorkflowContext, input: z.infer<typeof distributionSchema>) {
    const run = new WorkflowRun(this.name, context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      input = distributionSchema.parse(input);
      const admin = await run.step('resolve-organization-payer', () =>
        this.gateway.getOrganizationPublicKey(organizationId)
      );
      let record = await run.step('stage-distribution', () =>
        this.store.create(organizationId, this.kind, input.requestId, 'pending', {
          registryId: input.registryId,
          tokenAddress: input.tokenAddress,
          amount: input.amount,
          admin,
        })
      );
      if (
        Number(record.data.registryId) !== input.registryId ||
        String(record.data.tokenAddress) !== input.tokenAddress ||
        String(record.data.amount) !== input.amount ||
        String(record.data.admin) !== admin
      ) {
        throw new WorkflowError(
          'CONFLICT',
          'Distribution request ID was already used for different inputs.',
          409
        );
      }
      if (record.status !== 'pending') return publicRevenueSplitRecord(record);
      const unsignedXdr = await run.step('preview-and-simulate-distribution', () =>
        this.gateway.prepareDistribution(input.registryId, admin, input.tokenAddress, input.amount)
      );
      record = await run.step(
        'record-unsigned-distribution',
        () => this.store.transition(record, 'awaiting_signature', { ...record.data, unsignedXdr }),
        false
      );
      return { ...publicRevenueSplitRecord(record), unsignedXdr };
    });
  }

  execute(context: WorkflowContext, id: string, signedXdr?: string) {
    return this.executeTransaction(context, id, signedXdr);
  }
}

export function publicRevenueSplitRecord(record: WorkflowRecord): WorkflowRecord {
  const data = { ...record.data };
  delete data.signedXdr;
  return { ...record, data };
}
