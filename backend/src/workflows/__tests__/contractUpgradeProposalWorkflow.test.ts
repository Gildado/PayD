jest.mock('../../config/database.js', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../utils/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/tracing.js', () => ({
  withSpan: jest.fn((_name, _attributes, operation) => operation()),
}));
jest.mock('../../services/notificationService.js', () => ({
  NotificationService: jest.fn(),
}));
jest.mock('../../services/contractUpgradeService.js', () => ({ ContractUpgradeService: {} }));
jest.mock('../../services/stellarService.js', () => ({ StellarService: {} }));

import { employer, employee, MemoryWorkflowStore } from './fixtures.js';
import {
  ContractUpgradeProposalWorkflow,
  type ContractUpgradeProposalGateway,
} from '../contractUpgradeProposalWorkflow.js';
import type { WorkflowNotifier } from '../vestingReleaseNotificationWorkflow.js';

const input = { registryId: 7, newWasmHash: 'a'.repeat(64), notes: 'Quarterly release' };
const transient = () =>
  Object.assign(new Error('temporary RPC issue'), { response: { status: 503 } });

function setup() {
  const store = new MemoryWorkflowStore();
  const gateway: jest.Mocked<ContractUpgradeProposalGateway> = {
    getOrganizationPublicKey: jest.fn().mockResolvedValue(employee.walletAddress!),
    validateWasmHash: jest.fn().mockResolvedValue({ valid: true }),
    simulateUpgrade: jest.fn().mockResolvedValue({
      upgradeLogId: 33,
      simulation: { success: true, error: null },
    }),
    getSignerEmployees: jest
      .fn()
      .mockResolvedValue([{ employeeId: 20, walletAddress: employee.walletAddress! }]),
  };
  const notifier: jest.Mocked<WorkflowNotifier> = {
    sendWorkflowNotification: jest.fn().mockResolvedValue({ success: true, messageId: 'sent' }),
  };
  return {
    store,
    gateway,
    notifier,
    workflow: new ContractUpgradeProposalWorkflow(store, gateway, notifier, 0),
  };
}

describe('contract upgrade proposal workflow #1243', () => {
  test('validates, simulates, notifies signers, and deduplicates completed proposals', async () => {
    const { workflow, gateway, notifier } = setup();

    const result = await workflow.execute(employer, input);
    const repeated = await workflow.execute(employer, input);

    expect(result.output?.status).toBe('completed');
    expect(result.output?.data.upgradeLogId).toBe(33);
    expect(repeated.output).toEqual(result.output);
    expect(gateway.validateWasmHash).toHaveBeenCalledTimes(1);
    expect(gateway.simulateUpgrade).toHaveBeenCalledTimes(1);
    expect(notifier.sendWorkflowNotification).toHaveBeenCalledTimes(1);
  });

  test('retries transient validation failures without duplicating proposal side effects', async () => {
    const { workflow, gateway, notifier } = setup();
    gateway.validateWasmHash.mockRejectedValueOnce(transient());

    const result = await workflow.execute(employer, input);

    expect(result.status).toBe('completed');
    expect(result.steps.find((step) => step.step === 'validate-wasm')?.attempts).toBe(2);
    expect(gateway.simulateUpgrade).toHaveBeenCalledTimes(1);
    expect(notifier.sendWorkflowNotification).toHaveBeenCalledTimes(1);
  });

  test('rejects employees and invalid hashes before simulation or notification', async () => {
    const { workflow, gateway, notifier } = setup();

    expect((await workflow.execute(employee, input)).error?.code).toBe('FORBIDDEN');
    expect((await workflow.execute(employer, { ...input, newWasmHash: 'bad' })).error?.code).toBe(
      'INVALID_INPUT'
    );
    expect(gateway.simulateUpgrade).not.toHaveBeenCalled();
    expect(notifier.sendWorkflowNotification).not.toHaveBeenCalled();
  });
});
