import axios from 'axios';
import stellarConfig from '../config/index.js';
import { XlmStringAmount } from '../types/assets.js';

const STROOPS_PER_XLM = 10_000_000;

export type CongestionLevel = 'low' | 'moderate' | 'high';

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

export interface HorizonFeeStats {
  last_ledger: string;
  last_ledger_base_fee: string;
  ledger_capacity_usage: string;
  fee_charged: FeeStatsPercentiles;
  max_fee: FeeStatsPercentiles;
}

export interface FeeRecommendation {
  baseFee: number;
  recommendedFee: number;
  maxFee: number;
  congestionLevel: CongestionLevel;
  shouldBumpFee: boolean;
  ledgerCapacityUsage: number;
  lastLedger: number;
  recommendedFeeXLM: XlmStringAmount;
  maxFeeXLM: XlmStringAmount;
  baseFeeXLM: XlmStringAmount;
}

export interface BatchBudgetEstimate {
  transactionCount: number;
  feePerTransaction: number;
  totalBudget: number;
  totalBudgetXLM: XlmStringAmount;
  feePerTransactionXLM: XlmStringAmount;
  safetyMargin: number;
  congestionLevel: CongestionLevel;
}

const SAFETY_MARGIN: Record<CongestionLevel, number> = {
  low: 1.0,
  moderate: 1.2,
  high: 1.5,
};

function stroopsToXLM(stroops: number): XlmStringAmount {
  return {
    asset: { code: 'XLM' },
    value: (stroops / STROOPS_PER_XLM).toFixed(7)
  };
}

function deriveCongestionLevel(usage: number): CongestionLevel {
  if (usage < 0.25) return 'low';
  if (usage < 0.75) return 'moderate';
  return 'high';
}

export async function fetchHorizonFeeStats(): Promise<HorizonFeeStats> {
  const base = stellarConfig.stellar.horizonUrl.replace(/\/+$/, '');
  const { data } = await axios.get<HorizonFeeStats>(`${base}/fee_stats`);
  return data;
}

export async function getFeeRecommendation(): Promise<FeeRecommendation> {
  const stats = await fetchHorizonFeeStats();
  const baseFee = Number(stats.last_ledger_base_fee);
  const ledgerCapacityUsage = parseFloat(stats.ledger_capacity_usage);
  const congestionLevel = deriveCongestionLevel(ledgerCapacityUsage);

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

  recommendedFee = Math.max(recommendedFee || baseFee, baseFee);
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

export async function estimateBatchPaymentBudget(
  transactionCount: number
): Promise<BatchBudgetEstimate> {
  if (!Number.isFinite(transactionCount) || transactionCount < 1) {
    throw new Error('transactionCount must be a positive integer');
  }
  const recommendation = await getFeeRecommendation();
  const margin = SAFETY_MARGIN[recommendation.congestionLevel];
  const feePerTransaction = Math.ceil(recommendation.recommendedFee * margin);
  const totalBudget = feePerTransaction * Math.floor(transactionCount);

  return {
    transactionCount: Math.floor(transactionCount),
    feePerTransaction,
    totalBudget,
    totalBudgetXLM: stroopsToXLM(totalBudget),
    feePerTransactionXLM: stroopsToXLM(feePerTransaction),
    safetyMargin: margin,
    congestionLevel: recommendation.congestionLevel,
  };
}
