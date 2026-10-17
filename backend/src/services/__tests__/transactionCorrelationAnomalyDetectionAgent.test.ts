import { TransactionCorrelationAnomalyDetectionAgent } from '../transactionCorrelationAnomalyDetectionAgent.js';
import type { AuditRecord } from '../transactionAuditService.js';

function makeRecord(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    id: 1,
    tx_hash: 'a'.repeat(64),
    ledger_sequence: 1000,
    stellar_created_at: '2026-10-17T11:59:00.000Z',
    envelope_xdr: 'envelope',
    result_xdr: 'result',
    source_account: 'GSOURCE',
    fee_charged: 100,
    operation_count: 1,
    memo: null,
    successful: true,
    metadata: { correlationId: 'corr-1' },
    created_at: '2026-10-17T11:59:01.000Z',
    ...overrides,
  };
}

describe('TransactionCorrelationAnomalyDetectionAgent (#1197)', () => {
  let agent: TransactionCorrelationAnomalyDetectionAgent;

  beforeEach(() => {
    agent = new TransactionCorrelationAnomalyDetectionAgent({ maxLedgerSpread: 10 });
  });

  it('detects correlated records with mismatched source accounts (True Positive)', async () => {
    const records = [
      makeRecord({ id: 1, tx_hash: 'b'.repeat(64), source_account: 'GSOURCEA' }),
      makeRecord({ id: 2, tx_hash: 'c'.repeat(64), source_account: 'GSOURCEB' }),
    ];

    const anomalies = await agent.evaluateRecords({ records, organizationId: 7 });

    expect(anomalies.some((a) => a.reason === 'correlation_source_mismatch')).toBe(true);
    expect(anomalies[0].severity).toBe('critical');
    expect(anomalies[0].organizationId).toBe(7);
    expect(anomalies[0].metadata.correlationId).toBe('corr-1');
  });

  it('does not fire for consistently correlated records (True Negative)', async () => {
    const records = [
      makeRecord({ id: 1, tx_hash: 'b'.repeat(64), ledger_sequence: 1000 }),
      makeRecord({ id: 2, tx_hash: 'c'.repeat(64), ledger_sequence: 1002 }),
      makeRecord({ id: 3, tx_hash: 'd'.repeat(64), metadata: null }),
    ];

    const anomalies = await agent.evaluateRecords({ records });

    expect(anomalies).toHaveLength(0);
  });
});
