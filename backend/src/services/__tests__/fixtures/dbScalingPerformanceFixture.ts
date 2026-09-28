// Fixture data for DbScalingPerformanceInsightAgent tests.
// Models the metrics returned by DbScalingService methods.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_POOL = {
  activeConnections: 18,
  idleConnections: 2,
  waitingRequests: 1,
  maxConnections: 20,
};

export const FIXTURE_HEALTH = {
  ok: true,
  latencyMs: 450,
};

export const FIXTURE_DB_STATS = {
  database: 'payd',
  numBackends: 20,
  xactCommit: 9500,
  xactRollback: 120,
  blksRead: 1200,
  blksHit: 8800,
  cacheHitRatio: 0.88,
  deadlocks: 2,
  tempFiles: 15,
  tempBytes: 8_000_000,
};

export const FIXTURE_SLOW_QUERIES = [
  { query: 'SELECT * FROM payroll WHERE org=...', calls: 80, avgMs: 2500, totalMs: 200000 },
];

export const FIXTURE_CACHE_HIT_RATES = [
  { table: 'payroll_transactions', heapHitRate: 0.82, idxHitRate: 0.9 },
  { table: 'employees', heapHitRate: 0.95, idxHitRate: 0.98 },
];

export const FIXTURE_UNUSED_INDEXES = [
  { table: 'payroll_transactions', index: 'idx_unused_payroll', indexSizeBytes: 52_428_800 },
];

export const FIXTURE_EXPECTED = {
  healthy: true,
  latencyMs: 450,
  totalConnections: 20,
  activeConnections: 18,
  idleConnections: 2,
  waitingRequests: 1,
  poolUtilisationPct: 90, // 18/20 * 100
  cacheHitRatio: 0.885, // avg(0.82, 0.95)
  deadlocks: 2,
  transactions: 9620, // xactCommit + xactRollback
  slowQueryCount: 1,
  unusedIndexCount: 1,
  unusedIndexWastedMb: '50', // 52_428_800 bytes / 1024 / 1024
  hasHealthWarning: true, // latency 450ms < 2000 -> info, not warning
} as const;
