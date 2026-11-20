// Fixture data for RevenueSplitDistributionReportAgent tests.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_ORG_ID = 53;

export interface FixtureDistribution {
  id: string;
  tokenAddress: string;
  totalAmount: number;
  recipientCount: number;
  timestamp: number;
  txHash: string;
}

export interface FixtureRecipient {
  address: string;
  basisPoints: number;
  label: string;
}

export const FIXTURE_RECIPIENTS: FixtureRecipient[] = [
  { address: 'GABC...1111', basisPoints: 5000, label: 'Dev Team' },
  { address: 'GABC...2222', basisPoints: 3000, label: 'Operations' },
  { address: 'GABC...3333', basisPoints: 2000, label: 'Treasury' },
];

export const FIXTURE_DISTRIBUTIONS: FixtureDistribution[] = [
  { id: 'dist-1', tokenAddress: 'TOK...USDC', totalAmount: 1000000, recipientCount: 3, timestamp: Date.now() - 30 * 86400000, txHash: 'tx-hash-1' },
  { id: 'dist-2', tokenAddress: 'TOK...USDC', totalAmount: 1500000, recipientCount: 3, timestamp: Date.now() - 25 * 86400000, txHash: 'tx-hash-2' },
  { id: 'dist-3', tokenAddress: 'TOK...XLM', totalAmount: 50000000, recipientCount: 3, timestamp: Date.now() - 20 * 86400000, txHash: 'tx-hash-3' },
  { id: 'dist-4', tokenAddress: 'TOK...USDC', totalAmount: 2000000, recipientCount: 3, timestamp: Date.now() - 15 * 86400000, txHash: 'tx-hash-4' },
  { id: 'dist-5', tokenAddress: 'TOK...USDC', totalAmount: 800000, recipientCount: 3, timestamp: Date.now() - 10 * 86400000, txHash: 'tx-hash-5' },
];

// Pre-computed expected values
// USDC distributions: 1000000 + 1500000 + 2000000 + 800000 = 5300000
// XLM distributions: 50000000
// Total: 55300000
// Per-recipient (50/30/20 split):
//   Dev Team (50%): 5300000*0.5 + 50000000*0.5 = 2650000 + 25000000 = 27650000
//   Operations (30%): 5300000*0.3 + 50000000*0.3 = 1590000 + 15000000 = 16590000
//   Treasury (20%): 5300000*0.2 + 50000000*0.2 = 1060000 + 10000000 = 11060000
export const FIXTURE_EXPECTED = {
  totalDistributions: 5,
  totalDistributedAmount: 55300000,
  usdcDistributed: 5300000,
  xlmDistributed: 50000000,
  uniqueTokens: 2,
  recipientCount: 3,
  devTeamShare: 27650000,
  operationsShare: 16590000,
  treasuryShare: 11060000,
  avgDistributionPerToken: Math.round(55300000 / 2),
} as const;
