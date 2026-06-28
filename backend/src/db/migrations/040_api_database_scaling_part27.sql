-- =============================================================================
-- Migration 040: API & Database Scaling – Part 27
-- Purpose : Introduce additional query-performance optimizations, a query-stats
--           materialised view, and a connection-health metadata table to support
--           continued API & Database Scaling efforts (Issue #272 / Wave #717).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Partial indexes for hot "active" record lookups
-- ---------------------------------------------------------------------------

-- Only index employees that are currently active (avoids scanning historical rows)
CREATE INDEX IF NOT EXISTS idx_employees_active_org
  ON employees (organization_id, created_at DESC)
  WHERE status = 'active';

-- Only index pending / in-flight transactions (completed rows excluded)
CREATE INDEX IF NOT EXISTS idx_transactions_pending
  ON transactions (organization_id, created_at DESC)
  WHERE status IN ('pending', 'processing');

-- Only index unread notifications (keeps hot-path notification queries sub-ms)
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (employee_id, created_at DESC)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. Covering indexes to avoid heap fetches on common SELECT patterns
-- ---------------------------------------------------------------------------

-- Payroll runs list view: org + date + status + id in a single index scan
CREATE INDEX IF NOT EXISTS idx_payroll_runs_covering
  ON payroll_runs (organization_id, created_at DESC)
  INCLUDE (status, total_amount, asset_code);

-- Employee list pagination (org + name lookup)
CREATE INDEX IF NOT EXISTS idx_employees_org_name
  ON employees (organization_id, lower(last_name), lower(first_name));

-- ---------------------------------------------------------------------------
-- 3. Query-statistics tracking table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS db_query_stats (
  id              BIGSERIAL PRIMARY KEY,
  endpoint        TEXT        NOT NULL,
  query_hash      TEXT        NOT NULL,
  execution_ms    INTEGER     NOT NULL CHECK (execution_ms >= 0),
  rows_returned   INTEGER     NOT NULL DEFAULT 0,
  cache_hit       BOOLEAN     NOT NULL DEFAULT FALSE,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_stats_endpoint_ts
  ON db_query_stats (endpoint, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_query_stats_slow
  ON db_query_stats (execution_ms DESC)
  WHERE execution_ms > 200;

-- ---------------------------------------------------------------------------
-- 4. Connection-pool health metadata table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS db_pool_health (
  id              BIGSERIAL PRIMARY KEY,
  total_conns     INTEGER     NOT NULL,
  idle_conns      INTEGER     NOT NULL,
  waiting_clients INTEGER     NOT NULL DEFAULT 0,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pool_health_ts
  ON db_pool_health (recorded_at DESC);

-- Retain only the last 7 days of pool-health snapshots (keep table small)
CREATE OR REPLACE FUNCTION prune_pool_health() RETURNS void
LANGUAGE sql AS $$
  DELETE FROM db_pool_health WHERE recorded_at < NOW() - INTERVAL '7 days';
$$;

-- ---------------------------------------------------------------------------
-- 5. Materialised view: per-organisation daily transaction summary
-- ---------------------------------------------------------------------------

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_org_daily_tx_summary AS
  SELECT
    organization_id,
    DATE_TRUNC('day', created_at)            AS tx_day,
    COUNT(*)                                 AS tx_count,
    SUM(amount)                              AS total_amount,
    AVG(amount)                              AS avg_amount,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
  FROM transactions
  GROUP BY organization_id, DATE_TRUNC('day', created_at)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_org_daily_tx_org_day
  ON mv_org_daily_tx_summary (organization_id, tx_day);

-- ---------------------------------------------------------------------------
-- 6. Comment all new objects for discoverability
-- ---------------------------------------------------------------------------

COMMENT ON TABLE  db_query_stats      IS 'Tracks per-endpoint query execution stats for slow-query analysis.';
COMMENT ON TABLE  db_pool_health      IS 'Periodic snapshots of PG connection-pool utilisation.';
COMMENT ON MATERIALIZED VIEW mv_org_daily_tx_summary
  IS 'Pre-aggregated daily transaction summary per organisation – refresh with REFRESH MATERIALIZED VIEW CONCURRENTLY.';
