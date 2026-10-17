jest.mock('../../config/database.js', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../utils/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/tracing.js', () => ({
  withSpan: jest.fn((_name, _attrs, operation) => operation()),
}));
jest.mock('../../services/payrollAuditService.js', () => ({
  PayrollAuditService: {
    log: jest.fn(),
    logRunStatusChanged: jest.fn(),
    getAuditLogs: jest.fn(),
  },
}));
jest.mock('../../services/anchorService.js', () => ({
  AnchorService: {
    getAnchorInfo: jest.fn(),
    authenticate: jest.fn(),
    initiatePayment: jest.fn(),
    getTransaction: jest.fn(),
  },
}));

import logger from '../../utils/logger.js';
import { withSpan } from '../../utils/tracing.js';
import { PayrollAuditService } from '../../services/payrollAuditService.js';
import { AnchorService } from '../../services/anchorService.js';
import { PayrollApprovalWorkflow } from '../payrollApprovalWorkflow.js';
import { PayrollAuditRollbackWorkflow } from '../payrollAuditRollbackWorkflow.js';
import { AnchorCashoutWorkflow } from '../anchorCashoutWorkflow.js';
import { BulkPaymentStatusWorkflow } from '../bulkPaymentStatusWorkflow.js';
import { MemoryWorkflowStore, employer, recipient } from './fixtures.js';

const audit = PayrollAuditService as jest.Mocked<typeof PayrollAuditService>;
const anchor = AnchorService as jest.Mocked<typeof AnchorService>;

const cashoutInput = {
  domain: 'anchor.example',
  assetCode: 'USDC',
  amount: '100',
  account: recipient.secret(),
};

beforeEach(() => {
  jest.clearAllMocks();
  audit.log.mockResolvedValue({} as never);
  audit.logRunStatusChanged.mockResolvedValue({} as never);
  audit.getAuditLogs.mockResolvedValue({ data: [], total: 0 });
});

afterEach(() => jest.restoreAllMocks());

describe('payroll approval workflow #1232', () => {
  test('requests and approves a payroll run, recording audit entries', async () => {
    const workflow = new PayrollApprovalWorkflow(new MemoryWorkflowStore(), 0);

    const requested = await workflow.requestApproval(employer, 42);
    expect(requested.status).toBe('completed');
    expect(requested.output?.status).toBe('pending_approval');

    const approved = await workflow.review(employer, {
      payrollRunId: 42,
      decision: 'approve',
      reason: 'Accounts reconciled.',
    });
    expect(requested.status).toBe('completed');
    expect(requested.output?.status).toBe('pending_approval');
    expect(approved.status).toBe('completed');
    expect(approved.output?.status).toBe('approved');
    expect(audit.logRunStatusChanged).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      'Workflow completed',
      expect.objectContaining({ executionId: requested.executionId })
    );
    expect(withSpan).toHaveBeenCalledWith(
      'workflow.payroll-approval-request.stage-approval',
      expect.objectContaining({ 'workflow.execution_id': requested.executionId }),
      expect.any(Function)
    );
  });

  test('does not reopen a rejected approval on a later approval attempt', async () => {
    const workflow = new PayrollApprovalWorkflow(new MemoryWorkflowStore(), 0);
    await workflow.requestApproval(employer, 7);
    const rejected = await workflow.review(employer, {
      payrollRunId: 7,
      decision: 'reject',
      reason: 'Budget not confirmed.',
    });
    expect(rejected.output?.status).toBe('rejected');

    const reopened = await workflow.review(employer, {
      payrollRunId: 7,
      decision: 'approve',
      reason: 'Trying again.',
    });
    expect(reopened.status).toBe('completed');
    expect(reopened.output?.status).toBe('rejected');

    const status = await workflow.getApproval(employer, 7);
    expect(status.output?.status).toBe('rejected');
  });

  test('concurrent approve and reject cannot both win', async () => {
    const workflow = new PayrollApprovalWorkflow(new MemoryWorkflowStore(), 0);
    await workflow.requestApproval(employer, 7);

    const [approved, rejected] = await Promise.all([
      workflow.review(employer, { payrollRunId: 7, decision: 'approve' }),
      workflow.review(employer, { payrollRunId: 7, decision: 'reject', reason: 'No.' }),
    ]);

    const completed = [approved, rejected].filter((result) => result.status === 'completed');
    expect(completed).toHaveLength(1);
    const failures = [approved, rejected].filter((result) => result.status === 'failed');
    expect(failures[0]?.error?.code).toBe('CONFLICT');
  });

  test('rejects employee actors from approving', async () => {
    const workflow = new PayrollApprovalWorkflow(new MemoryWorkflowStore(), 0);
    const result = await workflow.review(
      { ...employer, role: 'EMPLOYEE' },
      { payrollRunId: 1, decision: 'approve' }
    );
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('FORBIDDEN');
  });
});

describe('payroll audit rollback workflow #1233', () => {
  test('captures the audit trail and rolls the run back', async () => {
    const store = new MemoryWorkflowStore();
    audit.getAuditLogs.mockResolvedValue({
      data: [
        {
          id: 1,
          action: 'run_status_changed',
          old_status: 'active',
          new_status: 'failed',
          created_at: new Date(),
        },
      ],
      total: 1,
    } as never);

    const workflow = new PayrollAuditRollbackWorkflow(store, 0);
    const result = await workflow.rollback(employer, {
      payrollRunId: 42,
      reason: 'Disputed run requires rollback.',
    });

    expect(result.status).toBe('completed');
    expect(result.output?.status).toBe('rolled_back');
    expect(result.output?.data.evidence).toHaveLength(1);
    expect(audit.getAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 1, payrollRunId: 42 })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Workflow completed',
      expect.objectContaining({ executionId: result.executionId })
    );
  });

  test('retries a transient audit read and fails after the attempt budget', async () => {
    audit.getAuditLogs.mockRejectedValue(
      Object.assign(new Error('again'), { response: { status: 503 } })
    );

    const workflow = new PayrollAuditRollbackWorkflow(new MemoryWorkflowStore(), 0);
    const result = await workflow.rollback(employer, {
      payrollRunId: 7,
      reason: 'Disputed run requires rollback.',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('STEP_FAILED');
    const evidenceStep = result.steps.find((step) => step.step === 'capture-audit-trail');
    expect(evidenceStep?.attempts).toBe(3);
    expect(withSpan).toHaveBeenCalledWith(
      'workflow.payroll-audit-rollback.capture-audit-trail',
      expect.objectContaining({ 'workflow.attempt': 3 }),
      expect.any(Function)
    );
  });

  test('is idempotent: a second rollback returns the completed record', async () => {
    const workflow = new PayrollAuditRollbackWorkflow(new MemoryWorkflowStore(), 0);
    const input = { payrollRunId: 9, reason: 'Duplicate request.' };
    const first = await workflow.rollback(employer, input);
    const second = await workflow.rollback(employer, input);
    expect(first.output?.status).toBe('rolled_back');
    expect(second.output?.status).toBe('rolled_back');
  });
});

describe('anchor cash-out workflow #1237', () => {
  test('completes the SEP-31 handoff and confirmation on the happy path', async () => {
    anchor.getAnchorInfo.mockResolvedValue({ domain: 'anchor.example', sep31Endpoint: 'https://a/tx' });
    anchor.authenticate.mockResolvedValue('sep10-token');
    anchor.initiatePayment.mockResolvedValue({ id: 'tx-1' });
    anchor.getTransaction.mockResolvedValue({ id: 'tx-1', status: 'completed' });

    const workflow = new AnchorCashoutWorkflow(new MemoryWorkflowStore(), AnchorService, 0);
    const result = await workflow.execute(employer, cashoutInput);

    expect(result.status).toBe('completed');
    expect(result.output?.status).toBe('completed');
    expect(anchor.initiatePayment).toHaveBeenCalledWith(
      'anchor.example',
      'sep10-token',
      expect.objectContaining({ asset_code: 'USDC', amount: '100' })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Workflow completed',
      expect.objectContaining({ executionId: result.executionId })
    );
  });

  test('retries a transient anchor failure and fails without leaking the secret', async () => {
    anchor.getAnchorInfo.mockResolvedValue({ domain: 'anchor.example', sep31Endpoint: 'https://a/tx' });
    anchor.authenticate.mockResolvedValue('sep10-token');
    anchor.initiatePayment.mockRejectedValue(
      Object.assign(new Error('bad gateway'), { response: { status: 502 } })
    );

    const workflow = new AnchorCashoutWorkflow(new MemoryWorkflowStore(), AnchorService, 0);
    const result = await workflow.execute(employer, cashoutInput);

    expect(result.status).toBe('failed');
    const handoff = result.steps.find((step) => step.step === 'initiate-sep31-handoff');
    expect(handoff?.attempts).toBe(3);
    expect(result.output).toBeUndefined();
  });

  test('rejects an anchor that does not support SEP-31', async () => {
    anchor.getAnchorInfo.mockResolvedValue({ domain: 'anchor.example' });
    const workflow = new AnchorCashoutWorkflow(new MemoryWorkflowStore(), AnchorService, 0);
    const result = await workflow.execute(employer, cashoutInput);
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('UNSUPPORTED_ANCHOR');
    expect(anchor.initiatePayment).not.toHaveBeenCalled();
  });
});

describe('bulk payment status workflow #1236', () => {
  test('tracks progress and completes a batch', async () => {
    const workflow = new BulkPaymentStatusWorkflow(new MemoryWorkflowStore(), 0);

    const tracked = await workflow.track(employer, {
      batchId: 'batch-1',
      status: 'processing',
      progress: 40,
      completedCount: 4,
      totalItems: 10,
      lastTxHash: 'abc123',
    });
    expect(tracked.status).toBe('completed');
    expect(tracked.output?.data.progress).toBe(40);

    const completed = await workflow.complete(employer, 'batch-1');
    expect(completed.status).toBe('completed');
    expect(completed.output?.status).toBe('completed');
    expect(completed.output?.data.progress).toBe(100);
    expect(completed.output?.data.completedCount).toBe(10);
    expect(logger.info).toHaveBeenCalledWith(
      'Workflow completed',
      expect.objectContaining({ executionId: completed.executionId })
    );
  });

  test('reads back persisted status after a refresh', async () => {
    const workflow = new BulkPaymentStatusWorkflow(new MemoryWorkflowStore(), 0);
    await workflow.track(employer, { batchId: 'batch-2', progress: 25, totalItems: 4 });
    const status = await workflow.getStatus(employer, 'batch-2');
    expect(status.status).toBe('completed');
    expect(status.output?.data.progress).toBe(25);
  });

  test('fails with NOT_FOUND for an unknown batch', async () => {
    const workflow = new BulkPaymentStatusWorkflow(new MemoryWorkflowStore(), 0);
    const result = await workflow.getStatus(employer, 'missing');
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  test('does not reopen a completed batch on a late progress event', async () => {
    const workflow = new BulkPaymentStatusWorkflow(new MemoryWorkflowStore(), 0);
    await workflow.track(employer, { batchId: 'batch-3', totalItems: 2 });
    await workflow.complete(employer, 'batch-3');
    const late = await workflow.track(employer, { batchId: 'batch-3', progress: 50 });
    expect(late.output?.status).toBe('completed');
    expect(late.output?.data.progress).toBe(100);
  });
});
