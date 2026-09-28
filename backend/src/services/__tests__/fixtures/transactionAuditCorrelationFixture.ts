// Fixture data for TransactionAuditCorrelationReportAgent tests.
// Models `transaction_audit_logs` rows managed by transactionAuditService.ts.
// Pre-computed expected values for deterministic test assertions.

export interface FixtureAuditRow {
  id: number;
  tx_hash: string;
  source_account: string;
  fee_charged: number;
  successful: boolean;
  stellar_created_at: Date;
}

const DAY1 = new Date('2024-04-01T00:00:00Z');
const DAY2 = new Date('2024-04-02T00:00:00Z');
const DAY3 = new Date('2024-04-03T00:00:00Z');

// source_accounts: GAAAA (all success), GBBBBB (all failed),
// GCMIXED (mixed -> correlation), GDDDDD (all success)
export const FIXTURE_ROWS: FixtureAuditRow[] = [
  { id: 1, tx_hash: 'tx1', source_account: 'GAAAA', fee_charged: 100, successful: true, stellar_created_at: DAY1 },
  { id: 2, tx_hash: 'tx2', source_account: 'GAAAA', fee_charged: 110, successful: true, stellar_created_at: DAY1 },
  { id: 3, tx_hash: 'tx3', source_account: 'GAAAA', fee_charged: 105, successful: true, stellar_created_at: DAY2 },
  { id: 4, tx_hash: 'tx4', source_account: 'GBBBBB', fee_charged: 200, successful: false, stellar_created_at: DAY1 },
  { id: 5, tx_hash: 'tx5', source_account: 'GBBBBB', fee_charged: 220, successful: false, stellar_created_at: DAY2 },
  { id: 6, tx_hash: 'tx6', source_account: 'GCMIXED', fee_charged: 150, successful: true, stellar_created_at: DAY2 },
  { id: 7, tx_hash: 'tx7', source_account: 'GCMIXED', fee_charged: 160, successful: false, stellar_created_at: DAY3 },
  { id: 8, tx_hash: 'tx8', source_account: 'GDDDDD', fee_charged: 130, successful: true, stellar_created_at: DAY3 },
  { id: 9, tx_hash: 'tx9', source_account: 'GDDDDD', fee_charged: 140, successful: true, stellar_created_at: DAY3 },
];

export const FIXTURE_EXPECTED = {
  totalRecords: 9,
  successful: 6,
  failed: 3,
  successRate: 66.67, // 6/9 * 100
  uniqueSourceAccounts: 4,
  totalFees: 1315,
  avgFee: 146.11, // 1315/9 rounded to 2dp
  minFee: 100,
  maxFee: 220,
  bySourceAccountLength: 4,
  topSourceAccount: 'GAAAA',
  statusSuccessful: 6,
  statusFailed: 3,
  trendsLength: 3,
  correlationsLength: 1,
  mixedSourceAccount: 'GCMIXED',
  mixedOutcomeRatio: 0.5,
} as const;
