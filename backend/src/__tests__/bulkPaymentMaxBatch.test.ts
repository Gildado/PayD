/**
 * Stress tests for BulkPaymentService at the 100-operation envelope ceiling (#1564).
 * Stellar, the circuit breaker, and the DB pool are mocked so the tests exercise
 * envelope chunking, sequence handling and bookkeeping at scale without a network.
 */

import { Keypair } from '@stellar/stellar-sdk';

const mockSubmit = jest.fn();
const mockQuery = jest.fn();

jest.mock('../services/stellarService.js', () => ({
  StellarService: {
    getServer: () => ({
      loadAccount: async () => ({ sequenceNumber: () => '1000' }),
    }),
    getNetworkPassphrase: () => 'Test SDF Network ; September 2015',
    submitTransaction: (...args: unknown[]) => mockSubmit(...args),
  },
  isStellarInfrastructureFailure: () => false,
}));

jest.mock('../services/circuitBreakerService.js', () => ({
  circuitBreakerService: { execute: async (_n: string, fn: () => unknown) => fn() },
}));

jest.mock('../config/database.js', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { BulkPaymentService, MAX_OPS_PER_ENVELOPE } from '../services/bulkPaymentService.js';

const source = Keypair.random();
const destination = Keypair.random().publicKey();

const makeItems = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    destination,
    amount: '1.0000000',
    referenceId: `ref-${i}`,
  }));

describe('BulkPaymentService at max batch size (#1564)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    let n = 0;
    mockSubmit.mockImplementation(async () => ({ hash: `hash-${n++}` }));
    mockQuery.mockResolvedValue({ rows: [{ batch_id: 'batch-1' }] });
  });

  it('keeps the envelope ceiling at 100 operations', () => {
    expect(MAX_OPS_PER_ENVELOPE).toBe(100);
  });

  it('submits exactly 100 payments as a single envelope with 100 operations', async () => {
    const res = await BulkPaymentService.submitBatch(source, makeItems(100));

    expect(res.envelopes).toHaveLength(1);
    expect(res.envelopes[0]).toMatchObject({ itemCount: 100, successful: true });
    expect(res.successfulItems).toBe(100);
    expect(res.failedItems).toBe(0);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(mockSubmit.mock.calls[0]![0].operations).toHaveLength(100);
  });

  it('splits 101 payments into a 100-op and a 1-op envelope', async () => {
    const res = await BulkPaymentService.submitBatch(source, makeItems(101));

    expect(res.envelopes.map((e) => e.itemCount)).toEqual([100, 1]);
    expect(res.successfulItems).toBe(101);
  });

  it('handles 1,000 payments across 10 envelopes with sequential sequence numbers', async () => {
    const start = Date.now();
    const res = await BulkPaymentService.submitBatch(source, makeItems(1000));
    const elapsedMs = Date.now() - start;

    expect(res.envelopes).toHaveLength(10);
    expect(res.envelopes.every((e) => e.itemCount === 100 && e.successful)).toBe(true);
    expect(res.successfulItems).toBe(1000);

    const sequences = mockSubmit.mock.calls.map((c) => BigInt(c[0].sequence));
    sequences.slice(1).forEach((s, i) => expect(s - sequences[i]!).toBe(BigInt(1)));

    // Bookkeeping overhead with a mocked network must stay small.
    expect(elapsedMs).toBeLessThan(10_000);
  });

  it('isolates a failed envelope and still submits the rest', async () => {
    let call = 0;
    mockSubmit.mockImplementation(async () => {
      if (call++ === 1) throw new Error('tx_failed');
      return { hash: `hash-${call}` };
    });

    const res = await BulkPaymentService.submitBatch(source, makeItems(300));

    expect(res.envelopes.map((e) => e.successful)).toEqual([true, false, true]);
    expect(res.successfulItems).toBe(200);
    expect(res.failedItems).toBe(100);
  });

  it('rejects an empty batch', async () => {
    await expect(BulkPaymentService.submitBatch(source, [])).rejects.toThrow(/at least one/);
  });
});
