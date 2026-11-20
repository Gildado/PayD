/**
 * Revenue Split Distribution Report Agent (#1303)
 *
 * Summarizes historical revenue split distributions and recipient share
 * changes from the on-chain RevenueSplitContract.
 *
 * Output schema:
 *   - summary: totalDistributions, totalAmount, uniqueTokens, recipientCount
 *   - byToken: per-token distribution totals
 *   - byRecipient: per-recipient cumulative share amounts
 *   - distributionTimeline: chronological distribution history
 */

import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface RevenueSplitFilters {
  organizationPublicKey?: string;
  startDate?: string;
  endDate?: string;
}

export interface TokenDistribution {
  tokenAddress: string;
  totalDistributed: number;
  distributionCount: number;
  avgDistribution: number;
}

export interface RecipientShare {
  address: string;
  label: string;
  basisPoints: number;
  cumulativeAmount: number;
  percentageOfTotal: number;
}

export interface DistributionRecord {
  id: string;
  tokenAddress: string;
  totalAmount: number;
  recipientCount: number;
  timestamp: number;
  txHash: string;
}

export interface RevenueSplitDistributionReport {
  summary: {
    totalDistributions: number;
    totalDistributedAmount: number;
    uniqueTokens: number;
    recipientCount: number;
    avgDistributionAmount: number;
  };
  byToken: TokenDistribution[];
  byRecipient: RecipientShare[];
  distributionTimeline: DistributionRecord[];
}

export class RevenueSplitDistributionReportAgent implements IReportAgent {
  id = 'revenue-split-distribution';
  name = 'Revenue Split Distribution Report';
  description = 'Summarizes historical revenue split distributions and recipient share changes';

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as RevenueSplitFilters | undefined;

    const { distributions, recipients } = await this.fetchRevenueSplitData(f);

    // Per-token aggregation
    const tokenMap = new Map<string, { total: number; count: number }>();
    for (const d of distributions) {
      const entry = tokenMap.get(d.tokenAddress) ?? { total: 0, count: 0 };
      entry.total += d.totalAmount;
      entry.count += 1;
      tokenMap.set(d.tokenAddress, entry);
    }

    const byToken: TokenDistribution[] = [...tokenMap.entries()].map(
      ([tokenAddress, { total, count }]) => ({
        tokenAddress,
        totalDistributed: total,
        distributionCount: count,
        avgDistribution: Math.round(total / count),
      })
    );

    // Per-recipient cumulative shares
    const totalDistributed = distributions.reduce((s, d) => s + d.totalAmount, 0);
    const byRecipient: RecipientShare[] = recipients.map((r) => {
      const cumulativeAmount = Math.round((totalDistributed * r.basisPoints) / 10000);
      return {
        address: r.address,
        label: r.label,
        basisPoints: r.basisPoints,
        cumulativeAmount,
        percentageOfTotal: Math.round((r.basisPoints / 10000) * 10000) / 100,
      };
    });

    const report: RevenueSplitDistributionReport = {
      summary: {
        totalDistributions: distributions.length,
        totalDistributedAmount: totalDistributed,
        uniqueTokens: tokenMap.size,
        recipientCount: recipients.length,
        avgDistributionAmount: distributions.length
          ? Math.round(totalDistributed / distributions.length)
          : 0,
      },
      byToken,
      byRecipient,
      distributionTimeline: distributions.sort((a, b) => b.timestamp - a.timestamp),
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: distributions.length,
        processedRecords: distributions.length,
        failedRecords: 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'revenue-split-distribution',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }

  private async fetchRevenueSplitData(_filters?: RevenueSplitFilters): Promise<{
    distributions: DistributionRecord[];
    recipients: Array<{ address: string; label: string; basisPoints: number }>;
  }> {
    // In production, query from the Stellar contract state and
    // event history. The agent defines the aggregation schema.
    return { distributions: [], recipients: [] };
  }
}
