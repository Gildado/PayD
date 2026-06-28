/**
 * Fee Estimation Service
 *
 * Fetches current network fee statistics from the Stellar Horizon API and
 * provides accurate fee recommendations for payroll transactions.
 * Supports fee bumping indicators for high-congestion periods.
 *
 * Issue: https://github.com/Gildado/PayD/issues/42
 */
import { XlmStringAmount } from '../types/assets';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 1 XLM = 10,000,000 stroops */
const STROOPS_PER_XLM = 10_000_000;

/** Safety‑margin multiplier per congestion level */
const SAFETY_MARGIN: Record<CongestionLevel, number> = {
  low: 1.0,
  moderate: 1.2,
  high: 1.5,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw percentile bucket returned by Horizon for both accepted fees & max fee bids */
export interface FeeStatsPercentiles {
  min: string;
  mode: string;
  p10: string;
  p20: string;
  p30: string;
  p40: string;
  p50: string;
  p60: string;
  p70: string;
  p80: string;
  p90: string;
  p95: string;
  p99: string;
  max: string;
}

/** Shape of the JSON body from `GET /fee_stats` */
export interface HorizonFeeStats {
  last_ledger: string;
  last_ledger_base_fee: string;
  ledger_capacity_usage: string;
  fee_charged: FeeStatsPercentiles;
  max_fee: FeeStatsPercentiles;
}

/** High‑level congestion classification */
export type CongestionLevel = 'low' | 'moderate' | 'high';

/** Processed fee recommendation for consumers */
export interface FeeRecommendation {
  /** Base fee in stroops defined in the last ledger */
  baseFee: number;
  /** Recommended fee in stroops – smart pick based on congestion */
  recommendedFee: number;
  /** Maximum fee ceiling in stroops (p99) */
  maxFee: number;
  /** Current network congestion classification */
  congestionLevel: CongestionLevel;
  /** Indicates that the user should bump the fee due to high congestion */
  shouldBumpFee: boolean;
  /** Raw ledger capacity usage (0–1) */
  ledgerCapacityUsage: number;
  /** Sequence number of the most recent ledger */
  lastLedger: number;
  /** Recommended fee converted to XLM */
  recommendedFeeXLM: XlmStringAmount;
  /** Max fee converted to XLM */
  maxFeeXLM: XlmStringAmount;
  /** Base fee converted to XLM */
  baseFeeXLM: XlmStringAmount;
}

/** Batch payment budget estimate */
export interface BatchBudgetEstimate {
  /** Number of transactions in the batch */
  transactionCount: number;
  /** Fee per transaction in stroops */
  feePerTransaction: number;
  /** Total budget in stroops (with safety margin) */
  totalBudget: number;
  /** Total budget in XLM */
  totalBudgetXLM: XlmStringAmount;
  /** Cost per transaction in XLM */
  feePerTransactionXLM: XlmStringAmount;
  /** Safety margin multiplier applied */
  safetyMargin: number;
  /** Congestion level used for calculation */
  congestionLevel: CongestionLevel;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts stroops to XLM with 7‑decimal precision.
 */
export function stroopsToXLM(stroops: number): XlmStringAmount {
  return {
    asset: { code: 'XLM' },
    value: (stroops / STROOPS_PER_XLM).toFixed(7),
  };
}

/**
 * Derives a congestion level from the ledger capacity usage ratio.
 *
 * - < 0.25  → low
 * - < 0.75  → moderate
 * - ≥ 0.75  → high
 */
function deriveCongestionLevel(usage: number): CongestionLevel {
  if (usage < 0.25) return 'low';
  if (usage < 0.75) return 'moderate';
  return 'high';
}

/**
 * Resolves the Horizon base URL from the `PUBLIC_STELLAR_HORIZON_URL` env var.
 * Falls back to the public Stellar testnet if the variable is not set.
 */
function getHorizonUrl(): string {
  const envUrl = import.meta.env.PUBLIC_STELLAR_HORIZON_URL as string | undefined;
  return envUrl?.replace(/\/+$/, '') || 'https://horizon-testnet.stellar.org';
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Fetches the raw fee statistics from the Horizon `/fee_stats` endpoint.
 */
export async function fetchFeeStats(): Promise<HorizonFeeStats> {
  const url = `${getHorizonUrl()}/fee_stats`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Horizon fee_stats request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<HorizonFeeStats>;
}

/**
 * Fetches fee stats and returns a processed `FeeRecommendation`.
 */
export async function getFeeRecommendation(): Promise<FeeRecommendation> {
  const stats = await fetchFeeStats();

  const baseFee = Number(stats.last_ledger_base_fee);
  const ledgerCapacityUsage = parseFloat(stats.ledger_capacity_usage);
  const congestionLevel = deriveCongestionLevel(ledgerCapacityUsage);

  // Pick recommended fee based on congestion
  let recommendedFee: number;
  switch (congestionLevel) {
    case 'low':
      recommendedFee = Number(stats.fee_charged.p50);
      break;
    case 'moderate':
      recommendedFee = Number(stats.fee_charged.p70);
      break;
    case 'high':
      recommendedFee = Number(stats.fee_charged.p95);
      break;
  }

  // Ensure recommended fee is never below the base fee
  recommendedFee = Math.max(recommendedFee, baseFee);

  const maxFee = Math.max(Number(stats.fee_charged.p99), recommendedFee);

  return {
    baseFee,
    recommendedFee,
    maxFee,
    congestionLevel,
    shouldBumpFee: congestionLevel === 'high',
    ledgerCapacityUsage,
    lastLedger: Number(stats.last_ledger),
    recommendedFeeXLM: stroopsToXLM(recommendedFee),
    maxFeeXLM: stroopsToXLM(maxFee),
    baseFeeXLM: stroopsToXLM(baseFee),
  };
}

/**
 * Estimates the total fee budget for a batch of payroll transactions.
 *
 * Applies a safety margin multiplier:
 * - Low congestion   → 1.0×
 * - Moderate          → 1.2×
 * - High              → 1.5×
 */
export async function estimateBatchPaymentBudget(
  transactionCount: number
): Promise<BatchBudgetEstimate> {
  const recommendation = await getFeeRecommendation();
  const margin = SAFETY_MARGIN[recommendation.congestionLevel];
  const feePerTransaction = Math.ceil(recommendation.recommendedFee * margin);
  const totalBudget = feePerTransaction * transactionCount;

  return {
    transactionCount,
    feePerTransaction,
    totalBudget,
    totalBudgetXLM: stroopsToXLM(totalBudget),
    feePerTransactionXLM: stroopsToXLM(feePerTransaction),
    safetyMargin: margin,
    congestionLevel: recommendation.congestionLevel,
  };
}
