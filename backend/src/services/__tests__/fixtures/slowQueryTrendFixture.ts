// Fixture data for SlowQueryTrendReportAgent tests.
// Models the `db_query_stats` rows persisted by slowQueryMonitorService.ts.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_THRESHOLD_MS = 500;

export interface FixtureQueryStatRow {
  endpoint: string;
  query_hash: string;
  execution_ms: number;
  rows_returned: number;
  cache_hit: boolean;
  recorded_at: Date;
}

const DAY1 = new Date('2024-03-13T00:00:00Z');
const DAY2 = new Date('2024-03-14T00:00:00Z');
const DAY3 = new Date('2024-03-15T00:00:00Z');

export const FIXTURE_ROWS: FixtureQueryStatRow[] = [
  // GET /payroll — one slow (600ms), two fast
  { endpoint: 'GET /payroll', query_hash: 'h1', execution_ms: 600, rows_returned: 40, cache_hit: false, recorded_at: DAY1 },
  { endpoint: 'GET /payroll', query_hash: 'h1', execution_ms: 120, rows_returned: 40, cache_hit: true, recorded_at: DAY1 },
  { endpoint: 'GET /payroll', query_hash: 'h1', execution_ms: 80, rows_returned: 40, cache_hit: true, recorded_at: DAY2 },

  // POST /bulk-pay — both slow (700ms, 900ms)
  { endpoint: 'POST /bulk-pay', query_hash: 'h2', execution_ms: 700, rows_returned: 20, cache_hit: false, recorded_at: DAY1 },
  { endpoint: 'POST /bulk-pay', query_hash: 'h2', execution_ms: 900, rows_returned: 20, cache_hit: false, recorded_at: DAY2 },

  // GET /employees — both fast, cached
  { endpoint: 'GET /employees', query_hash: 'h3', execution_ms: 90, rows_returned: 5, cache_hit: true, recorded_at: DAY2 },
  { endpoint: 'GET /employees', query_hash: 'h3', execution_ms: 110, rows_returned: 5, cache_hit: true, recorded_at: DAY3 },
];

// Pre-computed expected values (threshold 500ms).
export const FIXTURE_EXPECTED = {
  totalQueries: 7,
  slowQueries: 3, // 600, 700, 900
  slowQueryRate: 42.86, // 3/7 * 100
  avgExecutionMs: 371.43, // (600+120+80+700+900+90+110)/7
  p95ExecutionMs: 840, // PERCENTILE_CONT(0.95) over sorted durations
  maxExecutionMs: 900,
  cacheHitRate: 0.5714285714285714, // 4/7
  trendsLength: 3,

  // Top offending queries ordered by slow_calls DESC then avg DESC
  topOffender0: { endpoint: 'POST /bulk-pay', slowCalls: 2, avgExecutionMs: 800 },
  topOffender1: { endpoint: 'GET /payroll', slowCalls: 1, avgExecutionMs: 266.67 },
} as const;
