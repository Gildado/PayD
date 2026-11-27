/**
 * Re-export from the modularized db-scaling package.
 * Maintains backward compatibility for all existing imports.
 */

export {
  DbScalingService,
  type PoolStats,
  type ConnectionBreakdown,
  type DbSetting,
  type HealthCheckResult,
  type ReplicationStatus,
  type SlowQuery,
  type IndexUsage,
  type SeqScanStat,
  type UnusedIndex,
  type QueryPlanCacheEntry,
  type SlowQueryAggregate,
  type IndexUsageStats,
  type TableBloat,
  type CacheHitRate,
  type LongRunningTransaction,
  type VacuumStat,
  type TableSize,
  type TableIoStat,
  type IndexBloatEstimate,
  type AutovacuumActivityEntry,
  type DatabaseStats,
  type BlockIoStats,
  type BgwriterStats,
  type TempFileUsage,
  type WalStats,
  type LockWait,
  type DeadlockHistoryEntry,
} from './db-scaling/dbScalingService.js';

export { PoolMetricsCollector } from './db-scaling/poolMetrics.js';
export { ReplicaRouter } from './db-scaling/replicaRouting.js';
export { QueryAnalyzer } from './db-scaling/queryAnalyzer.js';
export { ResourceOptimizer } from './db-scaling/resourceOptimizer.js';
export { DatabaseStatsCollector } from './db-scaling/databaseStats.js';
export { LockContentionMonitor } from './db-scaling/lockContention.js';
