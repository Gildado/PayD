/**
 * Contributor Rewards Distribution Report Agent (#1314)
 *
 * Generates a report summarising contributor reward distributions over a
 * period, sourcing data from the contributor_rewards and contributions
 * tables (backing the ContributorRewards.tsx frontend page).
 *
 * Output schema:
 *   - summary: total rewards, total amount, by-tier breakdown
 *   - tierBreakdown: per-tier reward counts and amounts
 *   - recentRewards: latest N reward records
 *   - topContributors: highest-earning contributors
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface ContributorRewardsFilters {
  organizationId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface TierDistribution {
  tier: string;
  xlmAmount: number;
  count: number;
  percentage: number;
}

export interface RewardRecord {
  id: number;
  contributorAddress: string;
  tier: string;
  amount: number;
  issueNumber: number | null;
  status: string;
  distributedAt: Date;
}

export interface TopContributor {
  contributorAddress: string;
  totalRewards: number;
  totalXlm: number;
  tiers: string[];
}

export interface ContributorRewardsReport {
  summary: {
    totalRewards: number;
    totalXlmDistributed: number;
    uniqueContributors: number;
    tierBreakdown: TierDistribution[];
  };
  recentRewards: RewardRecord[];
  topContributors: TopContributor[];
}

export class ContributorRewardsReportAgent implements IReportAgent {
  id = 'contributor-rewards';
  name = 'Contributor Rewards Distribution Report';
  description = 'Summarises contributor reward distributions over a period';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as ContributorRewardsFilters | undefined;
    const limit = f?.limit ?? 20;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (f?.startDate) {
      conditions.push(`distributed_at >= $${paramIndex++}`);
      params.push(f.startDate);
    }
    if (f?.endDate) {
      conditions.push(`distributed_at <= $${paramIndex++}`);
      params.push(f.endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Summary by tier
    const tierResult = await this.pool.query(
      `SELECT tier, COUNT(*)::int AS count, SUM(amount)::float AS total_amount
       FROM contributor_rewards
       ${where}
       GROUP BY tier
       ORDER BY total_amount DESC`,
      params
    );

    const tierBreakdown: TierDistribution[] = [];
    let totalRewards = 0;
    let totalXlm = 0;

    for (const row of tierResult.rows) {
      totalRewards += row.count;
      totalXlm += row.total_amount;
      tierBreakdown.push({
        tier: row.tier,
        xlmAmount: row.total_amount,
        count: row.count,
        percentage: 0,
      });
    }

    // Compute percentages
    for (const tier of tierBreakdown) {
      tier.percentage = totalXlm > 0 ? Math.round((tier.xlmAmount / totalXlm) * 10000) / 100 : 0;
    }

    // Unique contributors
    const uniqueResult = await this.pool.query(
      `SELECT COUNT(DISTINCT contributor_address)::int AS unique_count
       FROM contributor_rewards
       ${where}`,
      params
    );

    const uniqueContributors = uniqueResult.rows[0]?.unique_count ?? 0;

    // Recent rewards
    const recentResult = await this.pool.query(
      `SELECT id, contributor_address, tier, amount, issue_number, status, distributed_at
       FROM contributor_rewards
       ${where}
       ORDER BY distributed_at DESC
       LIMIT $${paramIndex}`,
      [...params, limit]
    );

    const recentRewards: RewardRecord[] = recentResult.rows.map((row) => ({
      id: row.id,
      contributorAddress: row.contributor_address,
      tier: row.tier,
      amount: row.amount,
      issueNumber: row.issue_number,
      status: row.status,
      distributedAt: row.distributed_at,
    }));

    // Top contributors
    const topResult = await this.pool.query(
      `SELECT contributor_address,
              COUNT(*)::int AS total_rewards,
              SUM(amount)::float AS total_xlm,
              ARRAY_AGG(DISTINCT tier) AS tiers
       FROM contributor_rewards
       ${where}
       GROUP BY contributor_address
       ORDER BY total_xlm DESC
       LIMIT $${paramIndex}`,
      [...params, limit]
    );

    const topContributors: TopContributor[] = topResult.rows.map((row) => ({
      contributorAddress: row.contributor_address,
      totalRewards: row.total_rewards,
      totalXlm: row.total_xlm,
      tiers: row.tiers,
    }));

    const report: ContributorRewardsReport = {
      summary: {
        totalRewards,
        totalXlmDistributed: totalXlm,
        uniqueContributors,
        tierBreakdown,
      },
      recentRewards,
      topContributors,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: totalRewards,
        processedRecords: totalRewards,
        failedRecords: 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'contributor-rewards',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
