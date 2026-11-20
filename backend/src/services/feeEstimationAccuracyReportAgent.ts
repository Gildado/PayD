/**
 * Fee Estimation Accuracy Report Agent (#1316)
 *
 * Compares estimated vs actual fees paid to measure estimation accuracy.
 * Sources data from feeEstimationService.ts and payroll transaction history.
 *
 * Output schema:
 *   - summary: totalEstimations, accuracyRate, avgEstimationError, totalOverestimated
 *   - accuracyBuckets: distribution of estimation accuracy
 *   - significantDeviations: transactions with large estimation errors
 *   - insights: accuracy improvement insights
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface FeeAccuracyFilters {
  organizationId: number;
  startDate?: string;
  endDate?: string;
  minDeviation?: number;
}

export interface AccuracyBucket {
  bucket: string;
  count: number;
  percentage: number;
  description: string;
}

export interface SignificantDeviation {
  transactionId: string;
  estimatedFee: number;
  actualFee: number;
  deviation: number;
  deviationPercent: number;
  createdAt: Date;
  contractType: string | null;
}

export interface AccuracyInsight {
  type: 'strength' | 'weakness' | 'recommendation';
  message: string;
  affectedCount?: number;
  metric?: string;
}

export interface FeeEstimationAccuracyReport {
  schemaVersion: string;
  summary: {
    totalEstimations: number;
    accuracyRate: number;
    avgEstimationError: number;
    avgEstimationErrorPercent: number;
    totalOverestimated: number;
    totalUnderestimated: number;
    totalAccurate: number;
  };
  accuracyBuckets: AccuracyBucket[];
  significantDeviations: SignificantDeviation[];
  insights: AccuracyInsight[];
}

export class FeeEstimationAccuracyReportAgent implements IReportAgent {
  id = 'fee-estimation-accuracy';
  name = 'Fee Estimation Accuracy Report';
  description = 'Compares estimated vs actual fees paid to measure estimation accuracy';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as FeeAccuracyFilters | undefined;
    const organizationId = f?.organizationId ?? 0;
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const startDate = f?.startDate;
    const endDate = f?.endDate;
    const minDeviation = f?.minDeviation ?? 10;

    const conditions = ['organization_id = $1', 'fee_estimated IS NOT NULL', 'fee_charged IS NOT NULL'];
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

    // Summary statistics
    const summaryResult = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total_estimations,
        COALESCE(AVG(ABS(fee_charged - fee_estimated)), 0)::numeric(18,7) AS avg_error,
        COALESCE(AVG(ABS((fee_charged - fee_estimated) * 100.0 / NULLIF(fee_estimated, 0))), 0)::numeric(18,2) AS avg_error_percent,
        COUNT(*) FILTER (WHERE fee_charged > fee_estimated)::int AS overestimated,
        COUNT(*) FILTER (WHERE fee_charged < fee_estimated)::int AS underestimated,
        COUNT(*) FILTER (WHERE ABS(fee_charged - fee_estimated) <= 5)::int AS accurate
      FROM payroll_transactions
      WHERE ${conditions.join(' AND ')}`,
      params
    );

    const totalEstimations = summaryResult.rows[0]?.total_estimations ?? 0;
    const avgError = parseFloat(summaryResult.rows[0]?.avg_error ?? '0');
    const avgErrorPercent = parseFloat(summaryResult.rows[0]?.avg_error_percent ?? '0');
    const totalOverestimated = summaryResult.rows[0]?.overestimated ?? 0;
    const totalUnderestimated = summaryResult.rows[0]?.underestimated ?? 0;
    const totalAccurate = summaryResult.rows[0]?.accurate ?? 0;

    const accuracyRate = totalEstimations > 0
      ? Math.round((totalAccurate / totalEstimations) * 10000) / 100
      : 0;

    // Accuracy buckets
    const bucketResult = await this.pool.query(
      `SELECT
        CASE
          WHEN ABS(fee_charged - fee_estimated) <= 5 THEN 'excellent'
          WHEN ABS(fee_charged - fee_estimated) <= 20 THEN 'good'
          WHEN ABS(fee_charged - fee_estimated) <= 50 THEN 'fair'
          ELSE 'poor'
        END AS bucket,
        COUNT(*)::int AS count
      FROM payroll_transactions
      WHERE ${conditions.join(' AND ')}
      GROUP BY bucket
      ORDER BY
        CASE bucket
          WHEN 'excellent' THEN 1
          WHEN 'good' THEN 2
          WHEN 'fair' THEN 3
          WHEN 'poor' THEN 4
        END`,
      params
    );

    const bucketDescriptions: Record<string, string> = {
      excellent: '±5 stroops or less',
      good: '±6-20 stroops',
      fair: '±21-50 stroops',
      poor: 'More than ±50 stroops',
    };

    const accuracyBuckets: AccuracyBucket[] = bucketResult.rows.map((row) => ({
      bucket: row.bucket,
      count: row.count,
      percentage: totalEstimations > 0
        ? Math.round((row.count / totalEstimations) * 10000) / 100
        : 0,
      description: bucketDescriptions[row.bucket] || 'Unknown',
    }));

    // Significant deviations
    const deviationResult = await this.pool.query(
      `SELECT
        transaction_id,
        fee_estimated,
        fee_charged,
        ABS(fee_charged - fee_estimated) AS deviation,
        ABS((fee_charged - fee_estimated) * 100.0 / NULLIF(fee_estimated, 0)) AS deviation_percent,
        created_at,
        contract_type
      FROM payroll_transactions
      WHERE ${conditions.join(' AND ')}
        AND ABS(fee_charged - fee_estimated) >= $${paramIndex}
      ORDER BY deviation DESC
      LIMIT 20`,
      [...params, minDeviation]
    );

    const significantDeviations: SignificantDeviation[] = deviationResult.rows.map((row) => ({
      transactionId: row.transaction_id,
      estimatedFee: parseFloat(row.fee_estimated),
      actualFee: parseFloat(row.fee_charged),
      deviation: parseFloat(row.deviation),
      deviationPercent: parseFloat(row.deviation_percent ?? '0'),
      createdAt: row.created_at,
      contractType: row.contract_type,
    }));

    // Generate insights
    const insights: AccuracyInsight[] = [];

    if (accuracyRate >= 80) {
      insights.push({
        type: 'strength',
        message: `Excellent accuracy rate of ${accuracyRate}% (±5 stroops). Fee estimation is performing well.`,
        affectedCount: totalAccurate,
        metric: 'accuracy',
      });
    } else if (accuracyRate < 50) {
      insights.push({
        type: 'weakness',
        message: `Low accuracy rate of ${accuracyRate}%. Fee estimation needs improvement.`,
        affectedCount: totalEstimations - totalAccurate,
        metric: 'accuracy',
      });
    }

    if (totalOverestimated > totalUnderestimated * 2) {
      insights.push({
        type: 'weakness',
        message: 'Fees are consistently overestimated. Consider adjusting estimation algorithm downward.',
        affectedCount: totalOverestimated,
      });
    } else if (totalUnderestimated > totalOverestimated * 2) {
      insights.push({
        type: 'weakness',
        message: 'Fees are consistently underestimated. Risk of transaction failures.',
        affectedCount: totalUnderestimated,
      });
      insights.push({
        type: 'recommendation',
        message: 'Increase fee estimation buffer to reduce risk of underpaying.',
      });
    }

    if (avgErrorPercent > 30) {
      insights.push({
        type: 'recommendation',
        message: `Average estimation error of ${avgErrorPercent.toFixed(1)}% suggests reviewing fee estimation sources.`,
      });
    }

    if (significantDeviations.length > 0) {
      const maxDeviation = significantDeviations[0];
      insights.push({
        type: 'recommendation',
        message: `${significantDeviations.length} transactions had significant deviations. Largest: ${maxDeviation.deviation.toFixed(0)} stroops.`,
        affectedCount: significantDeviations.length,
      });
    }

    const report: FeeEstimationAccuracyReport = {
      schemaVersion: '1.0',
      summary: {
        totalEstimations,
        accuracyRate,
        avgEstimationError: avgError,
        avgEstimationErrorPercent: avgErrorPercent,
        totalOverestimated,
        totalUnderestimated,
        totalAccurate,
      },
      accuracyBuckets,
      significantDeviations,
      insights,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: totalEstimations,
        processedRecords: totalEstimations,
        failedRecords: 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'fee-estimation-accuracy',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
