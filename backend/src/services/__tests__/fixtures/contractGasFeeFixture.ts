// Fixture data for ContractGasFeeReportAgent tests.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_ORG_ID = 42;

export interface FixtureTransactionRow {
  id: number;
  organization_id: number;
  transaction_id: string;
  contract_type: string | null;
  fee_charged: number;
  fee_estimated: number;
  created_at: Date;
}

const NOW = new Date('2024-03-15T12:00:00Z');
const DAY_AGO = new Date('2024-03-14T12:00:00Z');
const WEEK_AGO = new Date('2024-03-08T12:00:00Z');

export const FIXTURE_ROWS: FixtureTransactionRow[] = [
  // Payroll contract transactions
  { id: 1, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx1', contract_type: 'payroll', fee_charged: 100, fee_estimated: 95, created_at: NOW },
  { id: 2, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx2', contract_type: 'payroll', fee_charged: 110, fee_estimated: 100, created_at: DAY_AGO },
  { id: 3, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx3', contract_type: 'payroll', fee_charged: 105, fee_estimated: 105, created_at: WEEK_AGO },
  
  // Vesting contract transactions
  { id: 4, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx4', contract_type: 'vesting', fee_charged: 200, fee_estimated: 180, created_at: NOW },
  { id: 5, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx5', contract_type: 'vesting', fee_charged: 190, fee_estimated: 185, created_at: DAY_AGO },
  
  // Trustline contract transactions
  { id: 6, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx6', contract_type: 'trustline', fee_charged: 50, fee_estimated: 55, created_at: NOW },
  { id: 7, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx7', contract_type: 'trustline', fee_charged: 45, fee_estimated: 50, created_at: DAY_AGO },
  { id: 8, organization_id: FIXTURE_ORG_ID, transaction_id: 'tx8', contract_type: 'trustline', fee_charged: 55, fee_estimated: 50, created_at: WEEK_AGO },
];

// Pre-computed expected values
export const FIXTURE_EXPECTED = {
  totalTransactions: 8,
  totalFees: 855, // 100+110+105+200+190+50+45+55
  avgFee: 106.875, // 855/8
  totalFeeXLM: '0.0000855', // 855/10_000_000
  
  // By contract type
  payroll: {
    count: 3,
    totalFees: 315,
    avgFee: 105,
    minFee: 100,
    maxFee: 110,
  },
  vesting: {
    count: 2,
    totalFees: 390,
    avgFee: 195,
    minFee: 190,
    maxFee: 200,
  },
  trustline: {
    count: 3,
    totalFees: 150,
    avgFee: 50,
    minFee: 45,
    maxFee: 55,
  },
} as const;
