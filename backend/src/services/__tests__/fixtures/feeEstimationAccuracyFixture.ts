// Fixture data for FeeEstimationAccuracyReportAgent tests.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_ORG_ID = 42;

export interface FixtureTransactionRow {
  id: number;
  organization_id: number;
  transaction_id: string;
  contract_type: string | null;
  fee_estimated: number;
  fee_charged: number;
  created_at: Date;
}

const NOW = new Date('2024-03-15T12:00:00Z');

export const FIXTURE_ROWS: FixtureTransactionRow[] = [
  // Excellent (±5 stroops)
  { id: 1, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx1', contract_type: 'payroll', fee_estimated: 100, fee_charged: 102, created_at: NOW },
  { id: 2, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx2', contract_type: 'payroll', fee_estimated: 110, fee_charged: 110, created_at: NOW },
  { id: 3, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx3', contract_type: 'payroll', fee_estimated: 105, fee_charged: 103, created_at: NOW },
  
  // Good (±6-20 stroops)
  { id: 4, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx4', contract_type: 'vesting', fee_estimated: 200, fee_charged: 215, created_at: NOW },
  { id: 5, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx5', contract_type: 'vesting', fee_estimated: 190, fee_charged: 180, created_at: NOW },
  
  // Fair (±21-50 stroops)
  { id: 6, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx6', contract_type: 'trustline', fee_estimated: 100, fee_charged: 130, created_at: NOW },
  
  // Poor (>±50 stroops)
  { id: 7, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx7', contract_type: 'bulk', fee_estimated: 150, fee_charged: 250, created_at: NOW },
  { id: 8, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx8', contract_type: 'bulk', fee_estimated: 200, fee_charged: 130, created_at: NOW },
];

// Pre-computed expected values
export const FIXTURE_EXPECTED = {
  totalEstimations: 8,
  excellentCount: 3,
  goodCount: 2,
  fairCount: 1,
  poorCount: 2,
  accuracyRate: 37.5, // 3/8 * 100
  
  // Errors: |102-100|=2, |110-110|=0, |103-105|=2, |215-200|=15, |180-190|=10, |130-100|=30, |250-150|=100, |130-200|=70
  avgError: 28.625, // (2+0+2+15+10+30+100+70)/8
  
  // Overestimated: tx2 (0), tx5 (10), tx8 (70) = 3 transactions where estimated > charged
  // Underestimated: tx1 (2), tx4 (15), tx6 (30), tx7 (100) = 4 transactions where estimated < charged
  // Accurate (±5): tx1, tx2, tx3 = 3 transactions
  overestimated: 2, // tx5, tx8
  underestimated: 5, // tx1, tx4, tx6, tx7, and tx3 is exact but counted as neither
  accurate: 3,
} as const;
