jest.mock('../../config/database.js', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../utils/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/tracing.js', () => ({
  withSpan: jest.fn((_name, _attributes, operation) => operation()),
}));
jest.mock('../../services/contractUpgradeService.js', () => ({ ContractUpgradeService: {} }));
jest.mock('../../services/stellarService.js', () => ({ StellarService: {} }));

import { employer, payer, recipient, MemoryWorkflowStore } from './fixtures.js';
import { NotReadyError } from '../runtime.js';
import {
  distributionSchema,
  recipientUpdateSchema,
  RevenueSplitDistributionWorkflow,
  RevenueSplitRecipientWorkflow,
  type RevenueSplitGateway,
} from '../revenueSplitWorkflows.js';

const recipientA = recipient.publicKey();
const allocations = [
  { recipient: recipientA, basisPoints: 6000 },
  { recipient: payer.publicKey(), basisPoints: 4000 },
];
const transient = () =>
  Object.assign(new Error('temporary RPC issue'), { response: { status: 503 } });

function setup() {
  const store = new MemoryWorkflowStore();
  const gateway: jest.Mocked<RevenueSplitGateway> = {
    getOrganizationPublicKey: jest.fn().mockResolvedValue(recipientA),
    prepareRecipientUpdate: jest.fn().mockResolvedValue('unsigned-recipients-xdr'),
    prepareDistribution: jest.fn().mockResolvedValue('unsigned-distribution-xdr'),
    submit: jest.fn().mockResolvedValue(undefined),
    confirm: jest.fn().mockResolvedValue({ successful: true }),
    transactionHash: jest.fn().mockReturnValue('tx-hash'),
    validateSignedEnvelope: jest.fn().mockReturnValue('tx-hash'),
  };
  return { store, gateway };
}

describe('revenue split workflows #1241 #1242', () => {
  test('validates unique recipient shares totaling 10000 basis points', () => {
    expect(recipientUpdateSchema.safeParse({ registryId: 1, allocations }).success).toBe(true);
    expect(
      recipientUpdateSchema.safeParse({
        registryId: 1,
        allocations: [{ recipient: recipientA, basisPoints: 10_000 }, { ...allocations[0] }],
      }).success
    ).toBe(false);
  });

  test('stages, signs, submits, and confirms a recipient update', async () => {
    const { store, gateway } = setup();
    gateway.confirm
      .mockRejectedValueOnce(new NotReadyError())
      .mockResolvedValueOnce({ successful: true });
    const workflow = new RevenueSplitRecipientWorkflow(store, gateway, 0);

    const prepared = await workflow.prepare(employer, { registryId: 7, allocations });
    const record = prepared.output!;
    const executed = await workflow.execute(employer, record.id, 'signed-xdr');

    expect(prepared.output?.status).toBe('awaiting_signature');
    expect(executed.output?.status).toBe('confirmed');
    expect(executed.output?.data.signedXdr).toBeUndefined();
    expect(gateway.prepareRecipientUpdate).toHaveBeenCalledWith(7, recipientA, allocations);
    expect(gateway.submit).toHaveBeenCalledWith('signed-xdr');
  });

  test('retries transient simulation failures without staging another record', async () => {
    const { store, gateway } = setup();
    gateway.prepareRecipientUpdate.mockRejectedValueOnce(transient());
    const workflow = new RevenueSplitRecipientWorkflow(store, gateway, 0);

    const result = await workflow.prepare(employer, { registryId: 7, allocations });

    expect(result.status).toBe('completed');
    expect(result.steps.find((step) => step.step === 'simulate-recipient-update')?.attempts).toBe(
      2
    );
    expect(store.records.size).toBe(1);
  });

  test('requires request ID and positive valid distribution amount', () => {
    expect(
      distributionSchema.safeParse({
        requestId: 'b81a68e2-2d6b-4fd2-92c2-9bbf66749f04',
        registryId: 1,
        tokenAddress: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
        amount: '12.5',
      }).success
    ).toBe(true);
    expect(
      distributionSchema.safeParse({
        registryId: 1,
        tokenAddress: 'invalid',
        amount: '-1',
      }).success
    ).toBe(false);
  });

  test('uses the caller request ID to deduplicate distribution preparation', async () => {
    const { store, gateway } = setup();
    const workflow = new RevenueSplitDistributionWorkflow(store, gateway, 0);
    const input = {
      requestId: 'b81a68e2-2d6b-4fd2-92c2-9bbf66749f04',
      registryId: 7,
      tokenAddress: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
      amount: '12.5',
    };

    const first = await workflow.prepare(employer, input);
    const second = await workflow.prepare(employer, input);

    expect(first.output?.status).toBe('awaiting_signature');
    expect(second.output?.id).toBe(first.output?.id);
    expect(gateway.prepareDistribution).toHaveBeenCalledTimes(1);
    expect(store.records.size).toBe(1);
  });

  test('rejects amounts outside the Soroban i128 limit', () => {
    expect(
      distributionSchema.safeParse({
        requestId: 'b81a68e2-2d6b-4fd2-92c2-9bbf66749f04',
        registryId: 1,
        tokenAddress: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
        amount: '999999999999999999999999999999999999999999999999',
      }).success
    ).toBe(false);
  });

  test('confirms a transaction after an ambiguous submission response and redacts its envelope', async () => {
    const { store, gateway } = setup();
    gateway.confirm
      .mockRejectedValueOnce(new NotReadyError())
      .mockResolvedValueOnce({ successful: true });
    gateway.submit.mockRejectedValueOnce(transient());
    const workflow = new RevenueSplitRecipientWorkflow(store, gateway, 0);

    const prepared = await workflow.prepare(employer, { registryId: 7, allocations });
    const result = await workflow.execute(employer, prepared.output!.id, 'signed-xdr');

    expect(result.output?.status).toBe('confirmed');
    expect(result.output?.data.signedXdr).toBeUndefined();
    expect(gateway.submit).toHaveBeenCalledTimes(1);
    expect(gateway.confirm).toHaveBeenCalledTimes(2);
  });

  test('does not expose the signed envelope when a submitted transaction fails on-chain', async () => {
    const { store, gateway } = setup();
    gateway.confirm
      .mockRejectedValueOnce(new NotReadyError())
      .mockResolvedValueOnce({ successful: false });
    const workflow = new RevenueSplitRecipientWorkflow(store, gateway, 0);

    const prepared = await workflow.prepare(employer, { registryId: 7, allocations });
    const result = await workflow.execute(employer, prepared.output!.id, 'signed-xdr');

    expect(result.output?.status).toBe('failed');
    expect(result.output?.data.signedXdr).toBeUndefined();
  });
});
