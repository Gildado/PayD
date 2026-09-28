import type { ReportAgentTransaction } from '../services/__tests__/fixtures/reportAgentFixture.js';

export interface SyntheticTransaction {
  txHash: string;
  employeeId: string | null;
  amount: string;
  assetCode: string;
  successful: boolean;
  /** Unix timestamp in seconds. */
  timestamp: number;
}

/** Builds a deterministic synthetic large-org dataset of `size` rows. */
export function buildSyntheticTransactions(size: number): SyntheticTransaction[] {
  const baseTimestamp = 1709287200; // 2024-03-01T10:00:00Z
  const rows: SyntheticTransaction[] = new Array(size);
  for (let i = 0; i < size; i += 1) {
    rows[i] = {
      txHash: `synthetic-tx-${i}`,
      employeeId: `EMP-${i % 1000}`,
      amount: ((i % 500) + 1).toFixed(2),
      assetCode: i % 2 === 0 ? 'USDC' : 'EURC',
      successful: i % 10 !== 0,
      timestamp: baseTimestamp + i * 60,
    };
  }
  return rows;
}
