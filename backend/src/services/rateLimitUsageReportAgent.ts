/**
 * Rate Limit Usage Report Agent (#1313)
 *
 * Generates a report on rate limit utilization and near-threshold clients,
 * sourcing data from rate-limit tracking (Redis counters / in-memory state).
 *
 * Output schema:
 *   - summary: total identifiers, by-tier breakdown, near-threshold count
 *   - tierBreakdown: per-tier usage stats
 *   - nearThresholdClients: clients approaching their limit
 *   - topConsumers: highest usage identifiers
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface RateLimitUsageFilters {
  organizationId?: number;
  thresholdPercent?: number;
  limit?: number;
}

export interface TierUsage {
  tier: string;
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date | null;
}

export interface NearThresholdClient {
  identifier: string;
  tier: string;
  used: number;
  limit: number;
  percentUsed: number;
  resetAt: Date | null;
}

export interface TopConsumer {
  identifier: string;
  tier: string;
  used: number;
  limit: number;
  percentUsed: number;
}

export interface RateLimitUsageReport {
  summary: {
    totalIdentifiers: number;
    totalTiers: number;
    nearThresholdCount: number;
    tierBreakdown: TierUsage[];
  };
  nearThresholdClients: NearThresholdClient[];
  topConsumers: TopConsumer[];
}

export class RateLimitUsageReportAgent implements IReportAgent {
  id = 'rate-limit-usage';
  name = 'Rate Limit Usage Report';
  description = 'Reports on rate limit utilization and near-threshold clients';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as RateLimitUsageFilters | undefined;
    const thresholdPercent = f?.thresholdPercent ?? 80;
    const limit = f?.limit ?? 50;

    // Query rate limit tracking from the database (rate_limit_usage table)
    const usageResult = await this.pool.query(
      `SELECT identifier, tier, used, remaining, limit_value, reset_at
       FROM rate_limit_usage
       ORDER BY used DESC`
    );

    const allUsage = usageResult.rows;

    // Aggregate by tier
    const tierMap = new Map<string, { limit: number; used: number; remaining: number; count: number }>();
    for (const row of allUsage) {
      const tier = row.tier;
      if (!tierMap.has(tier)) {
        tierMap.set(tier, { limit: row.limit_value, used: 0, remaining: 0, count: 0 });
      }
      const bucket = tierMap.get(tier)!;
      bucket.used += row.used;
      bucket.remaining += row.remaining;
      bucket.count += 1;
    }

    const tierBreakdown: TierUsage[] = [];
    for (const [tier, data] of tierMap) {
      tierBreakdown.push({
        tier,
        limit: data.limit,
        used: data.used,
        remaining: data.remaining,
        resetAt: null,
      });
    }

    // Near-threshold clients
    const nearThreshold: NearThresholdClient[] = allUsage
      .filter((row) => {
        const percent = row.limit_value > 0 ? (row.used / row.limit_value) * 100 : 0;
        return percent >= thresholdPercent;
      })
      .slice(0, limit)
      .map((row) => ({
        identifier: row.identifier,
        tier: row.tier,
        used: row.used,
        limit: row.limit_value,
        percentUsed: row.limit_value > 0 ? Math.round((row.used / row.limit_value) * 10000) / 100 : 0,
        resetAt: row.reset_at,
      }));

    // Top consumers
    const topConsumers: TopConsumer[] = allUsage
      .slice(0, limit)
      .map((row) => ({
        identifier: row.identifier,
        tier: row.tier,
        used: row.used,
        limit: row.limit_value,
        percentUsed: row.limit_value > 0 ? Math.round((row.used / row.limit_value) * 10000) / 100 : 0,
      }));

    const report: RateLimitUsageReport = {
      summary: {
        totalIdentifiers: allUsage.length,
        totalTiers: tierBreakdown.length,
        nearThresholdCount: nearThreshold.length,
        tierBreakdown,
      },
      nearThresholdClients: nearThreshold,
      topConsumers,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: allUsage.length,
        processedRecords: allUsage.length,
        failedRecords: 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'rate-limit-usage',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
