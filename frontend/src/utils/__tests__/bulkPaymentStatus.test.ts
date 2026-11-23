import { describe, expect, it } from 'vitest';
import type {
  OnChainBatchState,
  OnChainPaymentStatus,
  PayrollRecipientStatus,
  PayrollRunRecord,
  PayrollRunSummary,
} from '../../services/bulkPaymentStatus';
import {
  buildRunRows,
  findRunTxHash,
  getEmployeeName,
  getRetryKey,
  normalizeBulkUpdatePayload,
  resolveRecipientStatus,
  toNumberOrNull,
  toRecipientStatus,
} from '../bulkPaymentStatus';

// Identity/stub translator — the global setup mocks react-i18next, but the pure
// helpers receive `t` explicitly so they stay free of React and DOM imports.
const t = (key: string, opts?: Record<string, string | number>): string => {
  if (opts && 'id' in opts) {
    return `Employee #${String(opts.id)}`;
  }
  return key;
};

const makeRun = (overrides: Partial<PayrollRunRecord> = {}): PayrollRunRecord => ({
  id: 1,
  batch_id: 'batch-1',
  status: 'processing',
  total_amount: '1000',
  asset_code: 'USDC',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeRecipient = (
  overrides: Partial<PayrollRecipientStatus> = {}
): PayrollRecipientStatus => ({
  id: 10,
  employee_id: 42,
  employee_first_name: 'Ada',
  employee_last_name: 'Lovelace',
  amount: '100',
  status: 'pending',
  ...overrides,
});

const makeSummary = (
  run: PayrollRunRecord,
  items: PayrollRecipientStatus[],
  totalEmployees?: number
): PayrollRunSummary => ({
  payroll_run: run,
  items,
  summary: { total_employees: totalEmployees ?? items.length, total_amount: '1000' },
});

describe('toRecipientStatus', () => {
  it('maps REST statuses to UI statuses', () => {
    expect(toRecipientStatus('completed')).toBe('confirmed');
    expect(toRecipientStatus('failed')).toBe('failed');
    expect(toRecipientStatus('pending')).toBe('pending');
  });
});

describe('getEmployeeName', () => {
  it('prefers the full name', () => {
    expect(getEmployeeName(makeRecipient(), t)).toBe('Ada Lovelace');
  });

  it('falls back to the email when the name is empty', () => {
    const recipient = makeRecipient({
      employee_first_name: undefined,
      employee_last_name: undefined,
      employee_email: 'ada@example.com',
    });
    expect(getEmployeeName(recipient, t)).toBe('ada@example.com');
  });

  it('falls back to the translated employee number', () => {
    const recipient = makeRecipient({
      employee_first_name: '',
      employee_last_name: '',
      employee_email: undefined,
    });
    expect(getEmployeeName(recipient, t)).toBe('Employee #42');
  });
});

describe('findRunTxHash', () => {
  it('returns null without a summary or without any tx hash', () => {
    expect(findRunTxHash()).toBeNull();
    expect(findRunTxHash(makeSummary(makeRun(), [makeRecipient()]))).toBeNull();
  });

  it('returns the first non-empty tx hash', () => {
    const summary = makeSummary(makeRun(), [
      makeRecipient({ id: 1, tx_hash: '' }),
      makeRecipient({ id: 2, tx_hash: 'tx-hash-2' }),
      makeRecipient({ id: 3, tx_hash: 'tx-hash-3' }),
    ]);
    expect(findRunTxHash(summary)).toBe('tx-hash-2');
  });
});

describe('toNumberOrNull', () => {
  it('accepts finite numbers and integer strings', () => {
    expect(toNumberOrNull(7)).toBe(7);
    expect(toNumberOrNull('12')).toBe(12);
    expect(toNumberOrNull('3.9')).toBe(3);
  });

  it('rejects non-finite values, non-numeric strings and other types', () => {
    expect(toNumberOrNull(Number.NaN)).toBeNull();
    expect(toNumberOrNull(Number.POSITIVE_INFINITY)).toBeNull();
    expect(toNumberOrNull('abc')).toBeNull();
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull({})).toBeNull();
  });
});

describe('normalizeBulkUpdatePayload', () => {
  it('rejects null, primitives and payloads without a batch id', () => {
    expect(normalizeBulkUpdatePayload(null)).toBeNull();
    expect(normalizeBulkUpdatePayload('batch-1')).toBeNull();
    expect(normalizeBulkUpdatePayload({ completedCount: 3 })).toBeNull();
  });

  it('accepts all supported batch id aliases', () => {
    expect(normalizeBulkUpdatePayload({ batchId: 'a' })?.batchId).toBe('a');
    expect(normalizeBulkUpdatePayload({ batch_id: 'b' })?.batchId).toBe('b');
    expect(normalizeBulkUpdatePayload({ runId: 'c' })?.batchId).toBe('c');
  });

  it('accepts all supported completed-count aliases', () => {
    const aliases = ['completedCount', 'confirmations', 'confirmationCount', 'confirmed', 'count'];
    aliases.forEach((alias) => {
      expect(normalizeBulkUpdatePayload({ batchId: 'batch-1', [alias]: '4' })?.completedCount).toBe(
        4
      );
    });
  });

  it('normalizes the remaining fields and drops invalid ones', () => {
    expect(
      normalizeBulkUpdatePayload({
        batchId: 'batch-1',
        status: 'processing',
        progress: 50,
        total: '10',
        lastTxHash: 'hash',
      })
    ).toEqual({
      batchId: 'batch-1',
      status: 'processing',
      progress: 50,
      completedCount: null,
      totalItems: 10,
      lastTxHash: 'hash',
    });

    const normalized = normalizeBulkUpdatePayload({
      batchId: 'batch-1',
      status: 42,
      progress: 'nope',
      lastTxHash: 99,
    });
    expect(normalized?.status).toBeNull();
    expect(normalized?.progress).toBeNull();
    expect(normalized?.lastTxHash).toBeNull();
  });
});

describe('buildRunRows', () => {
  const run = makeRun();

  it('derives progress, pending counts and the tx hash from the REST data', () => {
    const summary = makeSummary(
      run,
      [makeRecipient({ id: 1, tx_hash: 'abc123def456' }), makeRecipient({ id: 2 })],
      4
    );
    const [row] = buildRunRows({
      runs: [run],
      summaries: { [run.id]: summary },
      onChainStates: {},
      socketUpdates: {},
      statusFilter: 'All',
    });

    expect(row.employeeCount).toBe(4);
    expect(row.txHash).toBe('abc123def456');
    expect(row.confirmationCount).toBe(0);
    expect(row.pendingCount).toBe(4);
    expect(row.progressPercent).toBe(0);
    expect(row.liveStatus).toBe('processing');
    expect(row.hasFailedRecipients).toBe(false);
  });

  it('prefers live socket fields and clamps pending count at zero', () => {
    const summary = makeSummary(run, [makeRecipient()], 2);
    const [row] = buildRunRows({
      runs: [run],
      summaries: { [run.id]: summary },
      onChainStates: {},
      socketUpdates: {
        'batch-1': {
          batchId: 'batch-1',
          status: 'completed',
          progress: 100,
          completedCount: 3,
          totalItems: 2,
          lastTxHash: null,
        },
      },
      statusFilter: 'All',
    });

    expect(row.liveStatus).toBe('completed');
    expect(row.confirmationCount).toBe(3);
    expect(row.pendingCount).toBe(0);
    expect(row.progressPercent).toBe(100);
  });

  it('falls back to the on-chain success count and flags failed recipients', () => {
    const onChainState: OnChainBatchState = {
      batchId: 1,
      status: 'settled',
      successCount: 2,
      failCount: 1,
      totalSent: '100',
      items: [],
    };
    const summary = makeSummary(run, [makeRecipient({ status: 'failed' })], 3);
    const [row] = buildRunRows({
      runs: [run],
      summaries: { [run.id]: summary },
      onChainStates: { [run.id]: onChainState },
      socketUpdates: {},
      statusFilter: 'All',
    });

    expect(row.confirmationCount).toBe(2);
    expect(row.pendingCount).toBe(1);
    expect(row.progressPercent).toBe(67);
    expect(row.hasFailedRecipients).toBe(true);
  });

  it('filters rows by the live status, case-insensitively', () => {
    const pendingRun = makeRun({ id: 1, batch_id: 'batch-1', status: 'pending' });
    const completedRun = makeRun({ id: 2, batch_id: 'batch-2', status: 'completed' });
    const args = {
      runs: [pendingRun, completedRun],
      summaries: {},
      onChainStates: {},
      socketUpdates: {},
    };

    expect(buildRunRows({ ...args, statusFilter: 'All' })).toHaveLength(2);
    const pendingRows = buildRunRows({ ...args, statusFilter: 'Pending' });
    expect(pendingRows).toHaveLength(1);
    expect(pendingRows[0].run.id).toBe(pendingRun.id);
    const completedRows = buildRunRows({ ...args, statusFilter: 'Completed' });
    expect(completedRows).toHaveLength(1);
    expect(completedRows[0].run.id).toBe(completedRun.id);
  });
});

describe('getRetryKey', () => {
  it('joins the batch id and payment index', () => {
    expect(getRetryKey('batch-1', 3)).toBe('batch-1:3');
  });
});

describe('resolveRecipientStatus', () => {
  const recipient = makeRecipient({ status: 'pending' });

  it('prefers a concrete on-chain status over the REST status', () => {
    const onChain: OnChainPaymentStatus = {
      index: 0,
      recipient: null,
      amount: null,
      status: 'confirmed',
    };
    expect(resolveRecipientStatus(recipient, onChain)).toBe('confirmed');
  });

  it('falls back to the REST status for unknown or missing on-chain data', () => {
    const unknown: OnChainPaymentStatus = {
      index: 0,
      recipient: null,
      amount: null,
      status: 'unknown',
    };
    expect(resolveRecipientStatus(recipient, unknown)).toBe('pending');
    expect(resolveRecipientStatus(recipient)).toBe('pending');
    expect(resolveRecipientStatus(makeRecipient({ status: 'completed' }))).toBe('confirmed');
  });

  it('lets an optimistic status win over every other source', () => {
    const onChain: OnChainPaymentStatus = {
      index: 0,
      recipient: null,
      amount: null,
      status: 'failed',
    };
    expect(resolveRecipientStatus(recipient, onChain, 'pending')).toBe('pending');
  });
});
