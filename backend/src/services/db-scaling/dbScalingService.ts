/**
 * DbScalingService Facade
 * Maintains the original public API while delegating to specialized modules.
 * No breaking changes to existing consumers.
 */

import { PoolMetricsCollector, PoolStats, ConnectionBreakdown, DbSetting } from './poolMetrics.js';
import { ReplicaRouter, HealthCheckResult, ReplicationStatus } from './replicaRouting.js';
import {
  QueryAnalyzer,
  SlowQuery,
  IndexUsage,
  SeqScanStat,
  UnusedIndex,
  QueryPlanCacheEntry,
  SlowQueryAggregate,
  IndexUsageStats,
} from './queryAnalyzer.js';
import {
  ResourceOptimizer,
  TableBloat,
  CacheHitRate,
  LongRunningTransaction,
  VacuumStat,
  TableSize,
  TableIoStat,
  IndexBloatEstimate,
  AutovacuumActivityEntry,
} from './resourceOptimizer.js';
import {
  DatabaseStatsCollector,
  DatabaseStats,
  BlockIoStats,
  BgwriterStats,
  TempFileUsage,
  WalStats,
} from './databaseStats.js';
import {
  LockContentionMonitor,
  LockWait,
  DeadlockHistoryEntry,
} from './lockContention.js';

// Re-export all types for backward compatibility
export type {
  PoolStats,
  ConnectionBreakdown,
  DbSetting,
  HealthCheckResult,
  ReplicationStatus,
  SlowQuery,
  IndexUsage,
  SeqScanStat,
  UnusedIndex,
  QueryPlanCacheEntry,
  SlowQueryAggregate,
  IndexUsageStats,
  TableBloat,
  CacheHitRate,
  LongRunningTransaction,
  VacuumStat,
  TableSize,
  TableIoStat,
  IndexBloatEstimate,
  AutovacuumActivityEntry,
  DatabaseStats,
  BlockIoStats,
  BgwriterStats,
  TempFileUsage,
  WalStats,
  LockWait,
  DeadlockHistoryEntry,
};

export class DbScalingService {
  private poolMetrics = new PoolMetricsCollector();
  private replicaRouter = new ReplicaRouter();
  private queryAnalyzer = new QueryAnalyzer();
  private resourceOptimizer = new ResourceOptimizer();
  private databaseStats = new DatabaseStatsCollector();
  private lockContention = new LockContentionMonitor();

  // ── Pool Metrics Delegation ────────────────────────────────────────────────

  async getPoolStats(): Promise<PoolStats> {
    return this.poolMetrics.getPoolStats();
  }

  getPoolConfig(): { min: number; max: number } {
    return this.poolMetrics.getPoolConfig();
  }

  async getConnectionBreakdown(): Promise<ConnectionBreakdown[]> {
    return this.poolMetrics.getConnectionBreakdown();
  }

  async getDbSettings(): Promise<DbSetting[]> {
    return this.poolMetrics.getDbSettings();
  }

  async getIdleInTransactionTimeout(): Promise<{
    setting: string;
    unit: string | null;
    source: string;
  }> {
    return this.poolMetrics.getIdleInTransactionTimeout();
  }

  // ── Replica Routing Delegation ─────────────────────────────────────────────

  async runHealthCheck(): Promise<HealthCheckResult> {
    return this.replicaRouter.runHealthCheck();
  }

  async getReplicationLag(): Promise<ReplicationStatus[]> {
    return this.replicaRouter.getReplicationLag();
  }

  async selectHealthyReplica(): Promise<ReplicationStatus | null> {
    return this.replicaRouter.selectHealthyReplica();
  }

  async getHealthStatus(): Promise<{
    primary: HealthCheckResult;
    replicaCount: number;
    totalLagBytes: number;
    maxLagBytes: number;
  }> {
    return this.replicaRouter.getHealthStatus();
  }

  // ── Query Analyzer Delegation ──────────────────────────────────────────────

  async getSlowQueries(
    thresholdMs?: number,
    limit?: number,
  ): Promise<SlowQuery[]> {
    return this.queryAnalyzer.getSlowQueries(thresholdMs, limit);
  }

  async getSlowQueryAggregates(windowMinutes?: number, limit?: number): Promise<SlowQueryAggregate[]> {
    return this.queryAnalyzer.getSlowQueryAggregates(windowMinutes, limit);
  }

  async getSeqScanStats(limit?: number): Promise<SeqScanStat[]> {
    return this.queryAnalyzer.getSeqScanStats(limit);
  }

  async getUnusedIndexes(): Promise<UnusedIndex[]> {
    return this.queryAnalyzer.getUnusedIndexes();
  }

  async getIndexUsage(): Promise<IndexUsage[]> {
    return this.queryAnalyzer.getIndexUsage();
  }

  async getIndexUsageStats(limit?: number): Promise<IndexUsageStats[]> {
    return this.queryAnalyzer.getIndexUsageStats(limit);
  }

  async getQueryPlanCache(limit?: number): Promise<QueryPlanCacheEntry[]> {
    return this.queryAnalyzer.getQueryPlanCache(limit);
  }

  // ── Resource Optimizer Delegation ──────────────────────────────────────────

  async getTableBloat(): Promise<TableBloat[]> {
    return this.resourceOptimizer.getTableBloat();
  }

  async getCacheHitRate(): Promise<CacheHitRate[]> {
    return this.resourceOptimizer.getCacheHitRate();
  }

  async getLongRunningTransactions(minDurationSec?: number): Promise<LongRunningTransaction[]> {
    return this.resourceOptimizer.getLongRunningTransactions(minDurationSec);
  }

  async getVacuumStats(): Promise<VacuumStat[]> {
    return this.resourceOptimizer.getVacuumStats();
  }

  async getTableIoStats(limit?: number): Promise<TableIoStat[]> {
    return this.resourceOptimizer.getTableIoStats(limit);
  }

  async getTableSizes(limit?: number): Promise<TableSize[]> {
    return this.resourceOptimizer.getTableSizes(limit);
  }

  async getIndexBloatEstimate(limit?: number): Promise<IndexBloatEstimate[]> {
    return this.resourceOptimizer.getIndexBloatEstimate(limit);
  }

  async getAutovacuumActivity(): Promise<AutovacuumActivityEntry[]> {
    return this.resourceOptimizer.getAutovacuumActivity();
  }

  // ── Database Stats Delegation ──────────────────────────────────────────────

  async getDatabaseStats(): Promise<DatabaseStats> {
    return this.databaseStats.getDatabaseStats();
  }

  async getBlockIoStats(): Promise<BlockIoStats> {
    return this.databaseStats.getBlockIoStats();
  }

  async getBgwriterStats(): Promise<BgwriterStats> {
    return this.databaseStats.getBgwriterStats();
  }

  async getTempFileUsage(): Promise<TempFileUsage> {
    return this.databaseStats.getTempFileUsage();
  }

  async getWalStats(): Promise<WalStats> {
    return this.databaseStats.getWalStats();
  }

  // ── Lock Contention Delegation ─────────────────────────────────────────────

  async getLockContention(): Promise<LockWait[]> {
    return this.lockContention.getLockContention();
  }

  async getDeadlockHistory(limit?: number): Promise<DeadlockHistoryEntry[]> {
    return this.lockContention.getDeadlockHistory(limit);
  }
}
