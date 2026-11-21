/**
 * Crash-recovery tests for bulk payments (#1797).
 * The fake pool keeps rows in memory across service invocations so a simulated
 * process restart can be exercised without a database or a Stellar network.
 */

import { createHash } from 'node:crypto';
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';

interface BatchRow {
  id: number;
  batch_id: string;
  organization_id: number | null;
  source_account: string;
  total_items: number;
  successful_items: number;
  failed_items: number;
  status: string;
  asset_code: string;
  asset_issuer: string | null;
  idempotency_key: string | null;
  request_fingerprint: string | null;
  resume_count: number;
  last_resumed_at: Date | null;
  created_at: Date;
  completed_at: Date | null;
}

interface EnvelopeRow {
  id: number;
  batch_id: string;
  envelope_index: number;
  item_count: number;
  source_sequence: string | null;
  inner_xdr: string | null;
  inner_hash: string | null;
  fee_bump_xdr: string | null;
  fee_bump_hash: string | null;
  tx_hash: string | null;
  status: string;
  attempts: number;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
  submitted_at: Date | null;
  completed_at: Date | null;
}

interface ItemRow {
  id: number;
  batch_id: string;
  envelope_index: number;
  destination: string;
  amount: string;
  reference_id: string | null;
  tx_hash: string | null;
  status: string;
  error_message: string | null;
  envelope_id: number | null;
  created_at: Date;
  updated_at: Date;
}

function createFakeDb() {
  const state: {
    batches: BatchRow[];
    envelopes: EnvelopeRow[];
    items: ItemRow[];
    nextBatchId: number;
  } = {
    batches: [],
    envelopes: [],
    items: [],
    nextBatchId: 1,
  };

  const reset = () => {
    state.batches = [];
    state.envelopes = [];
    state.items = [];
    state.nextBatchId = 1;
  };

  const query = async (sql: string, params: any[] = []): Promise<{ rows: any[] }> => {
    const text = sql.replace(/\s+/g, ' ').trim();

    if (text.startsWith('BEGIN') || text.startsWith('COMMIT') || text.startsWith('ROLLBACK')) {
      return { rows: [] };
    }

    if (text.startsWith('SELECT * FROM bulk_payment_batches WHERE organization_id')) {
      const row = state.batches.find(
        (batch) => batch.organization_id === params[0] && batch.idempotency_key === params[1]
      );
      return { rows: row ? [{ ...row }] : [] };
    }

    if (text.startsWith('SELECT * FROM bulk_payment_batches WHERE batch_id')) {
      const row = state.batches.find(
        (batch) =>
          batch.batch_id === params[0] && (params[1] === null || batch.organization_id === params[1])
      );
      return { rows: row ? [{ ...row }] : [] };
    }

    if (text.startsWith('INSERT INTO bulk_payment_batches')) {
      if (text.includes('ON CONFLICT')) {
        const existing = state.batches.find(
          (batch) => batch.organization_id === params[1] && batch.idempotency_key === params[5]
        );
        if (existing) return { rows: [] };
      }
      const row: BatchRow = {
        id: state.batches.length + 1,
        batch_id: `00000000-0000-4000-8000-${String(state.nextBatchId++).padStart(12, '0')}`,
        organization_id: params[1] ?? null,
        source_account: params[0],
        total_items: params[2],
        successful_items: 0,
        failed_items: 0,
        status: 'processing',
        asset_code: params[3],
        asset_issuer: params[4] ?? null,
        idempotency_key: params[5] ?? null,
        request_fingerprint: params[6] ?? null,
        resume_count: 0,
        last_resumed_at: null,
        created_at: new Date(),
        completed_at: null,
      };
      state.batches.push(row);
      return { rows: [{ batch_id: row.batch_id }] };
    }

    if (text.startsWith('INSERT INTO bulk_payment_items')) {
      for (let i = 0; i < params.length; i += 5) {
        const batchId = params[i];
        const envelopeIndex = params[i + 1];
        const exists = state.items.some(
          (item) => item.batch_id === batchId && item.envelope_index === envelopeIndex
        );
        if (exists) continue;
        state.items.push({
          id: state.items.length + 1,
          batch_id: batchId,
          envelope_index: envelopeIndex,
          destination: params[i + 2],
          amount: params[i + 3],
          reference_id: params[i + 4] ?? null,
          tx_hash: null,
          status: 'pending',
          error_message: null,
          envelope_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
      return { rows: [] };
    }

    if (text.startsWith('INSERT INTO bulk_payment_envelopes')) {
      for (let i = 0; i < params.length; i += 3) {
        const batchId = params[i];
        const envelopeIndex = params[i + 1];
        const exists = state.envelopes.some(
          (envelope) => envelope.batch_id === batchId && envelope.envelope_index === envelopeIndex
        );
        if (exists) continue;
        state.envelopes.push({
          id: state.envelopes.length + 1,
          batch_id: batchId,
          envelope_index: envelopeIndex,
          item_count: params[i + 2],
          source_sequence: null,
          inner_xdr: null,
          inner_hash: null,
          fee_bump_xdr: null,
          fee_bump_hash: null,
          tx_hash: null,
          status: 'pending',
          attempts: 0,
          error_message: null,
          created_at: new Date(),
          updated_at: new Date(),
          submitted_at: null,
          completed_at: null,
        });
      }
      return { rows: [] };
    }

    if (text.startsWith('UPDATE bulk_payment_envelopes')) {
      const batchId = params[0];
      const envelopeIndex = params[1];
      const envelope = state.envelopes.find(
        (row) => row.batch_id === batchId && row.envelope_index === envelopeIndex
      );
      if (!envelope) return { rows: [] };

      if (text.includes('SET inner_xdr')) {
        if (envelope.status !== 'pending' || envelope.inner_xdr) return { rows: [] };
        envelope.inner_xdr = params[2];
        envelope.inner_hash = params[3];
        envelope.source_sequence = params[4];
        envelope.item_count = params[5];
        envelope.status = 'submitted';
        envelope.attempts += 1;
        envelope.submitted_at = new Date();
        envelope.updated_at = new Date();
        return { rows: [{ ...envelope }] };
      }
      if (text.includes('SET fee_bump_xdr')) {
        if (envelope.fee_bump_xdr) return { rows: [] };
        envelope.fee_bump_xdr = params[2];
        envelope.fee_bump_hash = params[3];
        envelope.attempts += 1;
        envelope.updated_at = new Date();
        return {
          rows: [{ fee_bump_xdr: envelope.fee_bump_xdr, fee_bump_hash: envelope.fee_bump_hash }],
        };
      }
      if (text.includes("status = 'completed'")) {
        envelope.status = 'completed';
        envelope.tx_hash = params[2];
        envelope.error_message = null;
        envelope.completed_at = new Date();
        envelope.updated_at = new Date();
        return { rows: [{ ...envelope }] };
      }
      if (text.includes("status = 'failed'")) {
        envelope.status = 'failed';
        envelope.error_message = params[2];
        envelope.updated_at = new Date();
        return { rows: [{ ...envelope }] };
      }
      envelope.status = 'submitted';
      envelope.error_message = params[2];
      envelope.updated_at = new Date();
      return { rows: [{ ...envelope }] };
    }

    if (text.startsWith('UPDATE bulk_payment_items')) {
      if (text.includes('envelope_id = $3')) {
        for (const item of state.items) {
          if (
            item.batch_id === params[0] &&
            item.envelope_index === params[1] &&
            item.status === 'pending'
          ) {
            item.status = 'submitted';
            item.envelope_id = params[2] ?? null;
            item.updated_at = new Date();
          }
        }
        return { rows: [] };
      }
      const status = params[0];
      for (const item of state.items) {
        if (item.batch_id === params[3] && item.envelope_index === params[4]) {
          item.status = status;
          item.tx_hash = params[1] ?? null;
          item.error_message = params[2] ?? null;
          item.updated_at = new Date();
        }
      }
      return { rows: [] };
    }

    if (text.startsWith('UPDATE bulk_payment_batches')) {
      const batch = state.batches.find((row) => row.batch_id === params[0]);
      if (!batch) return { rows: [] };
      if (text.includes('resume_count = resume_count + 1')) {
        if (!['interrupted', 'processing'].includes(batch.status)) return { rows: [] };
        batch.status = 'processing';
        batch.resume_count += 1;
        batch.last_resumed_at = new Date();
        return { rows: [{ ...batch }] };
      }
      if (text.includes("status = 'interrupted'")) {
        if (!['processing', 'interrupted'].includes(batch.status)) return { rows: [] };
        batch.status = 'interrupted';
        return { rows: [{ ...batch }] };
      }
      if (!['processing', 'interrupted'].includes(batch.status)) return { rows: [] };
      batch.successful_items = params[1];
      batch.failed_items = params[2];
      batch.status = params[3];
      if (['completed', 'partial', 'failed'].includes(batch.status)) batch.completed_at = new Date();
      return { rows: [{ ...batch }] };
    }

    if (text.startsWith('SELECT * FROM bulk_payment_envelopes WHERE batch_id')) {
      const rows = state.envelopes
        .filter(
          (envelope) =>
            envelope.batch_id === params[0] &&
            (params.length < 2 || envelope.envelope_index === params[1])
        )
        .sort((a, b) => a.envelope_index - b.envelope_index);
      return { rows: rows.map((row) => ({ ...row })) };
    }

    if (text.startsWith('SELECT status, COUNT(*)')) {
      const counts = new Map<string, number>();
      for (const item of state.items) {
        if (item.batch_id === params[0]) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
      }
      return {
        rows: [...counts.entries()].map(([status, count]) => ({ status, count })),
      };
    }

    if (text.startsWith('SELECT * FROM bulk_payment_items WHERE batch_id')) {
      return {
        rows: state.items
          .filter((item) => item.batch_id === params[0])
          .map((item) => ({ ...item })),
      };
    }

    throw new Error(`Unhandled fake DB query: ${text}`);
  };

  const connect = async () => ({
    query,
    release: () => undefined,
  });

  return { state, reset, query, connect };
}

const fakeDb = createFakeDb();
const mockSubmit = jest.fn();
const mockGetTransaction = jest.fn();
const submissions: { xdr: string; hash: string; sequence?: string }[] = [];
const receipts = new Map<string, { hash: string; successful: boolean }>();

jest.mock('../config/database.js', () => ({ pool: fakeDb }));

jest.mock('../services/circuitBreakerService.js', () => ({
  circuitBreakerService: { execute: async (_n: string, fn: () => unknown) => fn() },
}));

jest.mock('../services/stellarService.js', () => ({
  StellarService: {
    getServer: () => ({
      loadAccount: async () => ({ sequenceNumber: () => '1000' }),
      getTransaction: (...args: unknown[]) => mockGetTransaction(...args),
    }),
    getNetworkPassphrase: () => 'Test SDF Network ; September 2015',
    submitTransaction: (...args: unknown[]) => mockSubmit(...args),
    transactionFromXDR: (xdr: string) =>
      TransactionBuilder.fromXDR(xdr, 'Test SDF Network ; September 2015'),
  },
  isStellarInfrastructureFailure: (error: any) => Boolean(error?.simulatedCrash),
}));

import { BulkPaymentService } from '../services/bulkPaymentService.js';

const hashForXdr = (xdr: string) => createHash('sha256').update(xdr).digest('hex');
const source = Keypair.random();
const destination = Keypair.random().publicKey();
const items = Array.from({ length: 6 }, (_, i) => ({
  destination,
  amount: '1.0000000',
  referenceId: `ref-${i}`,
}));

let crashOnSecondSubmission = true;

describe('BulkPaymentService crash recovery (#1797)', () => {
  beforeEach(() => {
    fakeDb.reset();
    submissions.length = 0;
    receipts.clear();
    crashOnSecondSubmission = true;
    jest.clearAllMocks();
    mockGetTransaction.mockImplementation(async (hash: string) => {
      const receipt = receipts.get(hash);
      if (!receipt) {
        throw Object.assign(new Error('Not Found'), { response: { status: 404 } });
      }
      return receipt;
    });
    mockSubmit.mockImplementation(async (transaction: any) => {
      const xdr: string = transaction.toXDR();
      const hash =
        typeof transaction.hash === 'function'
          ? transaction.hash().toString('hex')
          : hashForXdr(xdr);
      submissions.push({ xdr, hash, sequence: transaction.sequence });
      receipts.set(hash, { hash, successful: true });
      if (crashOnSecondSubmission && submissions.length === 2) {
        throw Object.assign(new Error('simulated crash after submit'), { simulatedCrash: true });
      }
      return { hash, ledger: 1, success: true };
    });
  });

  it('persists the signed envelope and per-item state before an ambiguous crash', async () => {
    const result = await BulkPaymentService.submitBatch(source, items, {
      organizationId: 1,
      idempotencyKey: 'crash-key',
    });

    expect(submissions).toHaveLength(2);
    expect(result.envelopes.map((envelope) => envelope.successful)).toEqual([true, false]);
    expect(fakeDb.state.batches[0]!.status).toBe('interrupted');
    expect(fakeDb.state.envelopes).toHaveLength(3);
    expect(fakeDb.state.envelopes.every((envelope) => envelope.inner_xdr && envelope.inner_hash)).toBe(
      true
    );

    const inFlight = fakeDb.state.envelopes.find((envelope) => envelope.envelope_index === 1)!;
    expect(inFlight.status).toBe('submitted');
    expect(inFlight.inner_xdr).toBe(submissions[1]!.xdr);
    expect(inFlight.inner_hash).toBe(submissions[1]!.hash);
    expect(
      fakeDb.state.items
        .filter((item) => item.envelope_index === 1)
        .every((item) => item.status === 'submitted')
    ).toBe(true);
  });

  it('resumes by batchId without resubmitting envelopes that already have receipts', async () => {
    const crashed = await BulkPaymentService.submitBatch(source, items, {
      organizationId: 1,
      idempotencyKey: 'crash-key',
    });
    const submittedBeforeResume = submissions.map((submission) => submission.hash);

    crashOnSecondSubmission = false;
    const resumed = await BulkPaymentService.submitBatch(source, [], {
      batchId: crashed.batchId,
      organizationId: 1,
    });

    expect(submissions).toHaveLength(3);
    expect(submissions.slice(0, 2).map((submission) => submission.hash)).toEqual(
      submittedBeforeResume
    );
    expect(submissions[2]!.hash).not.toBe(submittedBeforeResume[1]);
    expect(new Set(submissions.map((submission) => submission.hash)).size).toBe(3);

    const inFlight = fakeDb.state.envelopes.find((envelope) => envelope.envelope_index === 1)!;
    expect(inFlight.status).toBe('completed');
    expect(inFlight.tx_hash).toBe(submittedBeforeResume[1]);
    expect(mockGetTransaction).toHaveBeenCalledWith(submittedBeforeResume[1]);

    expect(resumed.batchId).toBe(crashed.batchId);
    expect(resumed.totalItems).toBe(6);
    expect(resumed.successfulItems).toBe(6);
    expect(resumed.failedItems).toBe(0);
    expect(fakeDb.state.batches[0]!.status).toBe('completed');
    expect(fakeDb.state.batches[0]!.successful_items).toBe(6);
    expect(fakeDb.state.batches[0]!.failed_items).toBe(0);
    expect(fakeDb.state.batches[0]!.resume_count).toBe(1);
    expect(fakeDb.state.items.every((item) => item.status === 'completed')).toBe(true);
  });

  it('reuses a batch for the same idempotency key and rejects a changed payload', async () => {
    crashOnSecondSubmission = false;
    const first = await BulkPaymentService.submitBatch(source, items, {
      organizationId: 1,
      idempotencyKey: 'stable-key',
    });
    const afterFirstRun = submissions.map((submission) => submission.hash);

    const replay = await BulkPaymentService.submitBatch(source, items, {
      organizationId: 1,
      idempotencyKey: 'stable-key',
    });

    expect(replay.batchId).toBe(first.batchId);
    expect(fakeDb.state.batches).toHaveLength(1);
    expect(submissions.map((submission) => submission.hash)).toEqual(afterFirstRun);
    expect(fakeDb.state.batches[0]!.resume_count).toBe(0);

    await expect(
      BulkPaymentService.submitBatch(
        source,
        [{ ...items[0]!, amount: '9.0000000' }, ...items.slice(1)],
        { organizationId: 1, idempotencyKey: 'stable-key' }
      )
    ).rejects.toThrow(/different bulk payment payload/);
  });
});
