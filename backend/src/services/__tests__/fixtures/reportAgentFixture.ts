// Shared fixture dataset for report agent tests.
// All expected values below are pre-computed so every report agent test
// asserts against known output.

import { buildSyntheticTransactions } from '../../../utils/syntheticTransactions.js';

export interface ReportAgentTransaction {
  txHash: string;
  employeeId: string | null;
  amount: string;
  assetCode: string;
  successful: boolean;
  /** Unix timestamp in seconds. */
  timestamp: number;
}

// 2024-03-01T10:00:00Z .. 2024-03-01T15:00:00Z
export const FIXTURE_BASE_TIMESTAMP = 1709287200;

export const REPORT_FIXTURE_TRANSACTIONS: ReportAgentTransaction[] = [
  {
    txHash: 'fixture-tx-001',
    employeeId: 'EMP-001',
    amount: '500.00',
    assetCode: 'USDC',
    successful: true,
    timestamp: FIXTURE_BASE_TIMESTAMP,
  },
  {
    txHash: 'fixture-tx-002',
    employeeId: 'EMP-002',
    amount: '750.50',
    assetCode: 'USDC',
    successful: true,
    timestamp: FIXTURE_BASE_TIMESTAMP + 3600,
  },
  {
    txHash: 'fixture-tx-003',
    employeeId: 'EMP-003',
    amount: '1200.25',
    assetCode: 'EURC',
    successful: true,
    timestamp: FIXTURE_BASE_TIMESTAMP + 7200,
  },
  {
    txHash: 'fixture-tx-004',
    employeeId: 'EMP-001',
    amount: '99.99',
    assetCode: 'USDC',
    successful: false,
    timestamp: FIXTURE_BASE_TIMESTAMP + 10800,
  },
  {
    txHash: 'fixture-tx-005',
    employeeId: null,
    amount: '310.00',
    assetCode: 'EURC',
    successful: true,
    timestamp: FIXTURE_BASE_TIMESTAMP + 14400,
  },
  {
    txHash: 'fixture-tx-006',
    employeeId: 'EMP-002',
    amount: '42.42',
    assetCode: 'USDC',
    successful: true,
    timestamp: FIXTURE_BASE_TIMESTAMP + 18000,
  },
];

// Pre-computed expectations over the fixture above.
export const FIXTURE_EXPECTED = {
  totalTransactions: 6,
  successfulTransactions: 5,
  failedTransactions: 1,
  uniqueEmployees: 3, // EMP-001, EMP-002, EMP-003 (null excluded)
  totalAmountUsdc: '1392.91', // 500.00 + 750.50 + 99.99 + 42.42
  totalAmountEurc: '1510.25', // 1200.25 + 310.00
  lastGeneratedAtIso: '2024-03-01T15:00:00.000Z',
} as const;

/** Builds a deterministic synthetic large-org dataset of `size` rows. */
export function buildSyntheticDataset(size: number): ReportAgentTransaction[] {
  return buildSyntheticTransactions(size);
}
