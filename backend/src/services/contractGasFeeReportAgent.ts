/**
 * Contract Gas/Fee Cost Report Agent (#1297)
 *
 * Tracks and reports on-chain fee cost trends across contract types.
 * Sources data from feeEstimationService.ts and payroll transaction history.
 *
 * Output schema:
 *   - summary: totalTransactions, totalFees, avgFeePerTransaction, totalFeeXLM
 *   - byContractType: per-contract-type fee stats
 *   - trends: time-series fee cost trends
 *   - recommendations: fee optimization suggestions
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface GasFeeFilters {
  organizationId: number;
  startDate?: string;
  endDate?: string;
  contractType?: string;
}

export interface ContractTypeFees {
  contractType: string;
  transactionCount: number;
  totalFees: number;
  avgFee: number;
  minFee: number;
  maxFee: number;
  totalFeeXLM: string;
}

export interface FeeTrend {
  period: string;
  transactionCount: number;
  totalFees: number;
  avgFee: number;
}

export interface FeeRecommendation {
  type: 'optimization' | 'warning' | 'info';
  contractType?: string;
  message: string;
  potentialSavings?: number;
}

export interface ContractGasFeeReport {
  schemaVersion: string;
  summary: {
    totalTransactions: number;
    totalFees: number;
    avgFeePerTransaction: number;
    totalFeeXLM: string;
    periodStart: string | null;
    periodEnd: string | null;
  };
  byContractType: ContractTypeFees[];
  trends: FeeTrend[];
  recommendations: FeeRecommendation[];
}

export class ContractGasFeeReportAgent implements IReportAgent {
  id = 'contract-gas-fee';
  name = 'Contract Gas/Fee Cost Report';
  description = 'Tracks and reports on-chain fee cost trends across contract types';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as GasFeeFilters | undefined;
    const organizationId = f?.organizationId ?? 0;
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const startDate = f?.startDate;
    const endDate = f?.endDate;
    const contractType = f?.contractType;

    const conditions = ['organization_id = $1'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
    if (contractType) {
      conditions.push(`contract_type = $${paramIndex}`);
      params.push(contractType);
      paramIndex++;
    }

    // Summary stats
    const summaryResult = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total_transactions,
        COALESCE(SUM(fee_charged), 0)::numeric(18,7) AS total_fees,
        COALESCE(AVG(fee_charged), 0)::numeric(18,7) AS avg_fee,
        MIN(created_at) AS period_start,
        MAX(created_at) AS period_end
      FROM payroll_transactions
      WHERE ${conditions.join(' AND ')} AND fee_charged IS NOT NULL`,
      params
    );

    const totalTransactions = summaryResult.rows[0]?.total_transactions ?? 0;
    const totalFees = parseFloat(summaryResult.rows[0]?.total_fees ?? '0');
    const avgFee = parseFloat(summaryResult.rows[0]?.avg_fee ?? '0');
    const periodStart = summaryResult.rows[0]?.period_start;
    const periodEnd = summaryResult.rows[0]?.period_end;

    // Convert to XLM (1 XLM = 10^7 stroops)
    const totalFeeXLM = (totalFees / 10_000_000).toFixed(7);

    // By contract type
    const typeResult = await this.pool.query(
      `SELECT
        COALESCE(contract_type, 'unknown') AS contract_type,
        COUNT(*)::int AS transaction_count,
        COALESCE(SUM(fee_charged), 0)::numeric(18,7) AS total_fees,
        COALESCE(AVG(fee_charged), 0)::numeric(18,7) AS avg_fee,
        COALESCE(MIN(fee_charged), 0)::numeric(18,7) AS min_fee,
        COALESCE(MAX(fee_charged), 0)::numeric(18,7) AS max_fee
      FROM payroll_transactions
      WHERE ${conditions.join(' AND ')} AND fee_charged IS NOT NULL
      GROUP BY contract_type
      ORDER BY total_fees DESC`,
      params
    );

    const byContractType: ContractTypeFees[] = typeResult.rows.map((row) => ({
      contractType: row.contract_type,
      transactionCount: row.transaction_count,
      totalFees: parseFloat(row.total_fees),
      avgFee: parseFloat(row.avg_fee),
      minFee: parseFloat(row.min_fee),
      maxFee: parseFloat(row.max_fee),
      totalFeeXLM: (parseFloat(row.total_fees) / 10_000_000).toFixed(7),
    }));

    // Time-series trends (daily)
    const trendResult = await this.pool.query(
      `SELECT
        DATE(created_at) AS period,
        COUNT(*)::int AS transaction_count,
        COALESCE(SUM(fee_charged), 0)::numeric(18,7) AS total_fees,
        COALESCE(AVG(fee_charged), 0)::numeric(18,7) AS avg_fee
      FROM payroll_transactions
      WHERE ${conditions.join(' AND ')} AND fee_charged IS NOT NULL
      GROUP BY DATE(created_at)
      ORDER BY period DESC
      LIMIT 30`,
      params
    );

    const trends: FeeTrend[] = trendResult.rows.map((row) => ({
      period: row.period.toISOString().split('T')[0],
      transactionCount: row.transaction_count,
      totalFees: parseFloat(row.total_fees),
      avgFee: parseFloat(row.avg_fee),
    }));

    // Generate recommendations
    const recommendations: FeeRecommendation[] = [];

    // High avg fee warning
    if (avgFee > 100) {
      recommendations.push({
        type: 'warning',
        message: 'Average fee is above 100 stroops. Consider implementing fee optimization strategies.',
        potentialSavings: Math.round((avgFee - 100) * totalTransactions),
      });
    }

    // Contract type optimization
    for (const ct of byContractType) {
      if (ct.avgFee > avgFee * 1.5 && ct.transactionCount > 10) {
        recommendations.push({
          type: 'optimization',
          contractType: ct.contractType,
          message: `${ct.contractType} contract fees are 50% higher than average. Review transaction patterns.`,
          potentialSavings: Math.round((ct.avgFee - avgFee) * ct.transactionCount),
        });
      }
    }

    // General info
    recommendations.push({
      type: 'info',
      message: `Monitored ${totalTransactions} transactions with total fees of ${totalFeeXLM} XLM.`,
    });

    const report: ContractGasFeeReport = {
      schemaVersion: '1.0',
      summary: {
        totalTransactions,
        totalFees,
        avgFeePerTransaction: avgFee,
        totalFeeXLM,
        periodStart: periodStart ? periodStart.toISOString() : null,
        periodEnd: periodEnd ? periodEnd.toISOString() : null,
      },
      byContractType,
      trends,
      recommendations,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: totalTransactions,
        processedRecords: totalTransactions,
        failedRecords: 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'contract-gas-fee',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
