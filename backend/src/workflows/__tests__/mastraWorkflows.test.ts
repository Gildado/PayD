/**
 * Tests for Mastra orchestration workflows (#1234, #1235, #1238, #1239)
 *
 * Each describe block covers:
 *   - Happy-path fixture (workflow completes end-to-end successfully)
 *   - At least one designed failure / retry case
 *   - Observability (logs / traces emitted during execution)
 */

jest.mock('../../config/database.js', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../utils/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/tracing.js', () => ({
  withSpan: jest.fn((_name: string, _attrs: unknown, operation: () => unknown) => operation()),
}));

import { Keypair } from '@stellar/stellar-sdk';
import { pool } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { withSpan } from '../../utils/tracing.js';

import { BulkPaymentService } from '../../services/bulkPaymentService.js';
import { AnchorService } from '../../services/anchorService.js';
import { Sep31TrackingService } from '../../services/sep31TrackingService.js';
import { StellarService } from '../../services/stellarService.js';

import { BulkPaymentBatchWorkflow } from '../bulkPaymentBatchWorkflow.js';
import { BulkPaymentRetryWorkflow } from '../bulkPaymentRetryWorkflow.js';
import { AnchorCashOutWorkflow } from '../anchorCashOutWorkflow.js';
import { VestingReleaseTriggerWorkflow } from '../vestingReleaseTriggerWorkflow.js';

import { employer, recipient, payer } from './fixtures.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

const sourceKeypair = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 0xaa));
const beneficiaryKeypair = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 0xbb));

const query = pool.query as jest.Mock;

/** Returns an error that the runtime classifies as transient (503). */
const transient = () =>
  Object.assign(new Error('upstream temporarily unavailable'), {
    response: { status: 503 },
  });

beforeEach(() => {
  jest.clearAllMocks();
  (withSpan as jest.Mock).mockImplementation(
    (_name: string, _attrs: unknown, op: () => unknown) => op()
  );
});

afterEach(() => jest.restoreAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1234 — Bulk Payment Batch Orchestration Workflow
// ─────────────────────────────────────────────────────────────────────────────

describe('BulkPaymentBatchWorkflow (#1234)', () => {
  const items = [
    { destination: recipient.publicKey(), amount: '100.00' },
    { destination: payer.publicKey(), amount: '200.00' },
  ];

  const validInput = {
    sourceSecret: sourceKeypair.secret(),
    items,
  };

  const happyBatchResult = {
    batchId: 'batch-001',
    totalItems: 2,
    successfulItems: 2,
    failedItems: 0,
    envelopes: [{ envelopeIndex: 0, itemCount: 2, successful: true, txHash: 'hash-abc' }],
  };

  function mockPreflight() {
    jest.spyOn(StellarService, 'getServer').mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '100.00' }],
        sequenceNumber: () => '100',
        account_id: sourceKeypair.publicKey(),
        sequence: '100',
        subentry_count: 0,
        thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
        flags: {},
        signers: [],
        data: {},
      }),
    } as any);
  }

  test('happy path — completes all workflow steps and returns batch result', async () => {
    mockPreflight();
    const submitBatch = jest
      .spyOn(BulkPaymentService, 'submitBatch')
      .mockResolvedValue(happyBatchResult);

    const workflow = new BulkPaymentBatchWorkflow(BulkPaymentService, StellarService, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({ batchId: 'batch-001', successfulItems: 2 });
    expect(submitBatch).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Workflow completed',
      expect.objectContaining({ workflow: 'bulk-payment-batch' })
    );
  });

  test('transient failure on submit-batch is retried automatically', async () => {
    mockPreflight();
    const submitBatch = jest
      .spyOn(BulkPaymentService, 'submitBatch')
      .mockRejectedValueOnce(transient())
      .mockResolvedValue(happyBatchResult);

    const workflow = new BulkPaymentBatchWorkflow(BulkPaymentService, StellarService, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.status).toBe('completed');
    expect(submitBatch).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('preflight failure is propagated as a workflow error without submitting', async () => {
    jest.spyOn(StellarService, 'getServer').mockReturnValue({
      loadAccount: jest.fn().mockRejectedValue(new Error('account not found')),
    } as any);
    const submitBatch = jest.spyOn(BulkPaymentService, 'submitBatch');

    const workflow = new BulkPaymentBatchWorkflow(BulkPaymentService, StellarService, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('PREFLIGHT_FAILED');
    expect(submitBatch).not.toHaveBeenCalled();
  });

  test('invalid input (bad destination) is rejected before touching the network', async () => {
    const workflow = new BulkPaymentBatchWorkflow(BulkPaymentService, StellarService, 0);
    const result = await workflow.execute(employer, {
      ...validInput,
      items: [{ destination: 'NOT_A_VALID_KEY', amount: '50.00' }],
    });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('INVALID_INPUT');
  });

  test('non-employer caller is rejected', async () => {
    const workflow = new BulkPaymentBatchWorkflow(BulkPaymentService, StellarService, 0);
    const employeeCtx = { id: 99, organizationId: 1, role: 'EMPLOYEE' as const };
    const result = await workflow.execute(employeeCtx, validInput);
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('FORBIDDEN');
  });

  test('execution is observable — span is emitted for each step', async () => {
    mockPreflight();
    jest.spyOn(BulkPaymentService, 'submitBatch').mockResolvedValue(happyBatchResult);

    const workflow = new BulkPaymentBatchWorkflow(BulkPaymentService, StellarService, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.steps.map((s) => s.step)).toEqual(
      expect.arrayContaining(['validate-input', 'preflight-check', 'submit-batch', 'record-result'])
    );
    expect(withSpan).toHaveBeenCalledWith(
      'workflow.bulk-payment-batch',
      expect.anything(),
      expect.any(Function)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1235 — Bulk Payment Partial-Failure Retry Workflow
// ─────────────────────────────────────────────────────────────────────────────

describe('BulkPaymentRetryWorkflow (#1235)', () => {
  const batchId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  const validInput = {
    batchId,
    sourceSecret: sourceKeypair.secret(),
  };

  const partialBatchStatus = {
    batch: { batch_id: batchId, status: 'partial' },
    items: [
      {
        destination: recipient.publicKey(),
        amount: '100.00',
        reference_id: 'ref-1',
        status: 'failed',
      },
      {
        destination: payer.publicKey(),
        amount: '200.00',
        reference_id: null,
        status: 'completed',
      },
    ],
  };

  const retryBatchResult = {
    batchId: 'batch-retry-001',
    totalItems: 1,
    successfulItems: 1,
    failedItems: 0,
    envelopes: [{ envelopeIndex: 0, itemCount: 1, successful: true, txHash: 'hash-retry' }],
  };

  test('happy path — retries only the failed items and returns new batch result', async () => {
    jest.spyOn(BulkPaymentService, 'getBatchStatus').mockResolvedValue(partialBatchStatus);
    const submitBatch = jest
      .spyOn(BulkPaymentService, 'submitBatch')
      .mockResolvedValue(retryBatchResult);

    const workflow = new BulkPaymentRetryWorkflow(BulkPaymentService, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.status).toBe('completed');
    expect(result.output?.originalBatchId).toBe(batchId);
    expect(result.output?.retryBatch.batchId).toBe('batch-retry-001');
    // Only 1 failed item should be retried, not the 1 successful item.
    const [submittedItems] = submitBatch.mock.calls[0] as [unknown, { destination: string }[]];
    expect((submitBatch.mock.calls[0] as unknown[])[1]).toHaveLength(1);
    expect(((submitBatch.mock.calls[0] as unknown[])[1] as { destination: string }[])[0].destination).toBe(
      recipient.publicKey()
    );
  });

  test('transient submit failure is retried with back-off', async () => {
    jest.spyOn(BulkPaymentService, 'getBatchStatus').mockResolvedValue(partialBatchStatus);
    const submitBatch = jest
      .spyOn(BulkPaymentService, 'submitBatch')
      .mockRejectedValueOnce(transient())
      .mockResolvedValue(retryBatchResult);

    const workflow = new BulkPaymentRetryWorkflow(BulkPaymentService, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.status).toBe('completed');
    expect(submitBatch).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('returns CONFLICT when the original batch already completed', async () => {
    jest.spyOn(BulkPaymentService, 'getBatchStatus').mockResolvedValue({
      batch: { batch_id: batchId, status: 'completed' },
      items: [],
    });

    const workflow = new BulkPaymentRetryWorkflow(BulkPaymentService, 0);
    const result = await workflow.execute(employer, validInput);
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('CONFLICT');
  });

  test('returns NOT_FOUND when batch does not exist in the organisation', async () => {
    jest.spyOn(BulkPaymentService, 'getBatchStatus').mockResolvedValue(null);

    const workflow = new BulkPaymentRetryWorkflow(BulkPaymentService, 0);
    const result = await workflow.execute(employer, validInput);
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  test('returns CONFLICT when there are no failed items to retry', async () => {
    jest.spyOn(BulkPaymentService, 'getBatchStatus').mockResolvedValue({
      batch: { batch_id: batchId, status: 'partial' },
      items: [
        {
          destination: recipient.publicKey(),
          amount: '100.00',
          reference_id: null,
          status: 'completed',
        },
      ],
    });

    const workflow = new BulkPaymentRetryWorkflow(BulkPaymentService, 0);
    const result = await workflow.execute(employer, validInput);
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('CONFLICT');
  });

  test('invalid batchId format is rejected', async () => {
    const workflow = new BulkPaymentRetryWorkflow(BulkPaymentService, 0);
    const result = await workflow.execute(employer, {
      ...validInput,
      batchId: 'not-a-uuid',
    });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('INVALID_INPUT');
  });

  test('execution trace contains all four steps', async () => {
    jest.spyOn(BulkPaymentService, 'getBatchStatus').mockResolvedValue(partialBatchStatus);
    jest.spyOn(BulkPaymentService, 'submitBatch').mockResolvedValue(retryBatchResult);

    const workflow = new BulkPaymentRetryWorkflow(BulkPaymentService, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.steps.map((s) => s.step)).toEqual(
      expect.arrayContaining([
        'validate-input',
        'fetch-failed-items',
        'retry-batch',
        'record-retry-result',
      ])
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1238 — Anchor Cash-Out Failure / Retry Workflow
// ─────────────────────────────────────────────────────────────────────────────

describe('AnchorCashOutWorkflow (#1238)', () => {
  const validInput = {
    anchorDomain: 'anchor.example.com',
    clientSecret: sourceKeypair.secret(),
    paymentData: { amount: '50', asset_code: 'USDC', receiver: recipient.publicKey() },
    maxPollAttempts: 3,
    pollIntervalMs: 1,
  };

  function setupAnchorMocks(overrides: {
    authenticateResult?: string;
    initiateResult?: Record<string, unknown>;
    transactionStatuses?: string[];
    authenticateError?: Error;
    initiateError?: Error;
  } = {}) {
    const authenticate = jest
      .spyOn(AnchorService, 'authenticate')
      .mockImplementation(
        overrides.authenticateError
          ? () => Promise.reject(overrides.authenticateError)
          : () => Promise.resolve(overrides.authenticateResult ?? 'mock-sep10-token')
      );

    const initiatePayment = jest
      .spyOn(AnchorService, 'initiatePayment')
      .mockImplementation(
        overrides.initiateError
          ? () => Promise.reject(overrides.initiateError)
          : () =>
              Promise.resolve(
                overrides.initiateResult ?? { id: 'anchor-tx-001', status: 'pending' }
              )
      );

    const statuses = overrides.transactionStatuses ?? ['pending', 'completed'];
    let statusCallCount = 0;
    const getTransaction = jest.spyOn(AnchorService, 'getTransaction').mockImplementation(() => {
      const status = statuses[Math.min(statusCallCount++, statuses.length - 1)];
      return Promise.resolve({ transaction: { id: 'anchor-tx-001', status } });
    });

    return { authenticate, initiatePayment, getTransaction };
  }

  const trackingFactory = () => {
    const mockTracking = {
      updateStatus: jest.fn().mockResolvedValue({
        id: 'sep31-tx-001',
        organizationId: 1,
        status: 'PROCESSING',
        senderId: 's',
        receiverId: 'r',
        amount: '50',
        assetCode: 'USDC',
        updatedAt: new Date(),
      }),
    } as unknown as Sep31TrackingService;
    return mockTracking;
  };

  test('happy path — authenticates, initiates, polls to completed', async () => {
    const { authenticate, initiatePayment } = setupAnchorMocks();
    const tracking = trackingFactory();
    const workflow = new AnchorCashOutWorkflow(
      AnchorService,
      () => tracking,
      pool,
      0
    );

    const result = await workflow.execute(employer, validInput);

    expect(result.status).toBe('completed');
    expect(result.output?.anchorTransactionId).toBe('anchor-tx-001');
    expect(authenticate).toHaveBeenCalledWith(validInput.anchorDomain, expect.anything());
    expect(initiatePayment).toHaveBeenCalledTimes(1);
  });

  test('transient authentication failure is retried', async () => {
    setupAnchorMocks({ authenticateError: transient() });

    // Override with two failures then success.
    const authenticate = jest
      .spyOn(AnchorService, 'authenticate')
      .mockRejectedValueOnce(transient())
      .mockRejectedValueOnce(transient())
      .mockResolvedValue('tok');
    jest
      .spyOn(AnchorService, 'initiatePayment')
      .mockResolvedValue({ id: 'anchor-tx-002' });
    jest
      .spyOn(AnchorService, 'getTransaction')
      .mockResolvedValue({ transaction: { id: 'anchor-tx-002', status: 'completed' } });

    const workflow = new AnchorCashOutWorkflow(AnchorService, trackingFactory, pool, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.status).toBe('completed');
    expect(authenticate).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('anchor terminal error status propagates as CASHOUT_FAILED', async () => {
    setupAnchorMocks({ transactionStatuses: ['error'] });
    const workflow = new AnchorCashOutWorkflow(AnchorService, trackingFactory, pool, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('CASHOUT_FAILED');
  });

  test('exceeding maxPollAttempts returns CASHOUT_TIMEOUT', async () => {
    setupAnchorMocks({
      transactionStatuses: ['pending', 'pending', 'pending', 'pending', 'pending'],
    });
    const workflow = new AnchorCashOutWorkflow(AnchorService, trackingFactory, pool, 0);
    const result = await workflow.execute(employer, {
      ...validInput,
      maxPollAttempts: 2,
      pollIntervalMs: 0,
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('CASHOUT_TIMEOUT');
  });

  test('missing anchor transaction id causes ANCHOR_ERROR', async () => {
    setupAnchorMocks({ initiateResult: { other_field: 'no_id_here' } });
    const workflow = new AnchorCashOutWorkflow(AnchorService, trackingFactory, pool, 0);
    const result = await workflow.execute(employer, validInput);
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('ANCHOR_ERROR');
  });

  test('execution trace contains all observable steps', async () => {
    setupAnchorMocks();
    const workflow = new AnchorCashOutWorkflow(AnchorService, trackingFactory, pool, 0);
    const result = await workflow.execute(employer, validInput);

    const stepNames = result.steps.map((s) => s.step);
    expect(stepNames).toEqual(
      expect.arrayContaining(['validate-input', 'authenticate', 'initiate-cashout', 'poll-status'])
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Workflow completed',
      expect.objectContaining({ workflow: 'anchor-cashout' })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1239 — Vesting Release Trigger Orchestration Workflow
// ─────────────────────────────────────────────────────────────────────────────

describe('VestingReleaseTriggerWorkflow (#1239)', () => {
  const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

  const validInput = {
    contractId,
    beneficiarySecret: beneficiaryKeypair.secret(),
  };

  function mockSorobanServer(options: {
    claimableAmount?: bigint;
    simulationError?: string;
    sendStatus?: string;
    getTxStatus?: string;
    accountLoadError?: boolean;
  } = {}) {
    const claimable = options.claimableAmount ?? 5000n;
    const mockServer = {
      getAccount: options.accountLoadError
        ? jest.fn().mockRejectedValue(new Error('account not found'))
        : jest.fn().mockResolvedValue({
            accountId: () => beneficiaryKeypair.publicKey(),
            sequenceNumber: () => '100',
            incrementSequenceNumber: jest.fn(),
            id: beneficiaryKeypair.publicKey(),
            sequence: '100',
            subentry_count: 0,
            thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
            flags: {},
            balances: [{ asset_type: 'native', balance: '10.00' }],
            signers: [],
            data: {},
          }),
      simulateTransaction: options.simulationError
        ? jest.fn().mockResolvedValue({ error: options.simulationError })
        : jest.fn().mockResolvedValue({
            result: {
              retval: {
                // Mimics the XDR ScVal for an i128 value.
                i128: () => claimable,
              },
            },
            minResourceFee: '100',
          }),
      prepareTransaction: jest.fn().mockImplementation((tx) => Promise.resolve(tx)),
      sendTransaction: jest.fn().mockResolvedValue({
        status: options.sendStatus ?? 'PENDING',
        hash: 'claim-tx-hash-001',
        errorResult: null,
      }),
      getTransaction: jest.fn().mockResolvedValue({
        status: options.getTxStatus ?? 'SUCCESS',
      }),
    };

    jest.spyOn(StellarService, 'getServer').mockReturnValue(mockServer as any);
    jest.spyOn(StellarService, 'getNetworkPassphrase').mockReturnValue(
      'Test SDF Network ; September 2015'
    );
    query.mockResolvedValue({ rows: [] });

    return mockServer;
  }

  test('happy path — checks claimable amount, triggers claim, and confirms on-chain', async () => {
    const mockServer = mockSorobanServer({ claimableAmount: 10000n });

    const workflow = new VestingReleaseTriggerWorkflow(StellarService, pool, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.status).toBe('completed');
    expect(result.output?.status).toBe('released');
    expect(result.output?.txHash).toBe('claim-tx-hash-001');
    expect(mockServer.sendTransaction).toHaveBeenCalledTimes(1);
    expect(mockServer.getTransaction).toHaveBeenCalledTimes(1);
  });

  test('exits gracefully when claimable amount is zero and allowNoRelease=true', async () => {
    mockSorobanServer({ claimableAmount: 0n });

    const workflow = new VestingReleaseTriggerWorkflow(StellarService, pool, 0);
    const result = await workflow.execute(employer, {
      ...validInput,
      allowNoRelease: true,
    });

    expect(result.status).toBe('completed');
    expect(result.output?.status).toBe('no_release_needed');
  });

  test('returns NOT_READY when nothing is claimable and allowNoRelease is false', async () => {
    mockSorobanServer({ claimableAmount: 0n });

    const workflow = new VestingReleaseTriggerWorkflow(StellarService, pool, 0);
    const result = await workflow.execute(employer, {
      ...validInput,
      allowNoRelease: false,
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('NOT_READY');
  });

  test('CONTRACT_ERROR is propagated when simulation fails', async () => {
    mockSorobanServer({ simulationError: 'contract trapped' });

    const workflow = new VestingReleaseTriggerWorkflow(StellarService, pool, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('CONTRACT_ERROR');
  });

  test('sendTransaction ERROR status causes CLAIM_FAILED', async () => {
    mockSorobanServer({
      claimableAmount: 5000n,
      sendStatus: 'ERROR',
    });

    const workflow = new VestingReleaseTriggerWorkflow(StellarService, pool, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('CLAIM_FAILED');
  });

  test('getTransaction FAILED causes CLAIM_FAILED in confirm-claim step', async () => {
    mockSorobanServer({
      claimableAmount: 5000n,
      sendStatus: 'PENDING',
      getTxStatus: 'FAILED',
    });

    const workflow = new VestingReleaseTriggerWorkflow(StellarService, pool, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('CLAIM_FAILED');
  });

  test('PREFLIGHT_FAILED when beneficiary account not found on network', async () => {
    mockSorobanServer({ accountLoadError: true });

    const workflow = new VestingReleaseTriggerWorkflow(StellarService, pool, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('PREFLIGHT_FAILED');
  });

  test('DB write failure in update-vesting-record does not roll back on-chain release', async () => {
    mockSorobanServer({ claimableAmount: 1000n });
    query.mockRejectedValue(new Error('DB write failed'));

    const workflow = new VestingReleaseTriggerWorkflow(StellarService, pool, 0);
    const result = await workflow.execute(employer, validInput);

    // The workflow should still complete because the DB write error is swallowed.
    expect(result.status).toBe('completed');
    expect(result.output?.txHash).toBe('claim-tx-hash-001');
  });

  test('execution trace includes all five workflow steps', async () => {
    mockSorobanServer({ claimableAmount: 500n });

    const workflow = new VestingReleaseTriggerWorkflow(StellarService, pool, 0);
    const result = await workflow.execute(employer, validInput);

    expect(result.steps.map((s) => s.step)).toEqual(
      expect.arrayContaining([
        'validate-input',
        'check-release-conditions',
        'trigger-claim',
        'confirm-claim',
        'update-vesting-record',
      ])
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Workflow completed',
      expect.objectContaining({ workflow: 'vesting-release-trigger' })
    );
  });

  test('invalid contractId is rejected before touching the network', async () => {
    const workflow = new VestingReleaseTriggerWorkflow(StellarService, pool, 0);
    const result = await workflow.execute(employer, {
      ...validInput,
      contractId: '',
    });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('INVALID_INPUT');
  });
});
