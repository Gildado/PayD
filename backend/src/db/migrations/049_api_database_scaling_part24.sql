-- =============================================================================
-- Migration 049: API & Database Scaling – Part 24 (Issue #269)
-- Purpose : Add connection pool utilisation tracking, per-organisation query
--           throughput counters, and additional covering indexes for the
--           highest-traffic read paths identified in Part 23.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Connection pool utilisation snapshots
--    Records periodic snapshots of pg_stat_activity so operators can
--    correlate pool exhaustion events with application load spikes.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS db_pool_utilisation (
  id              BIGSERIAL    PRIMARY KEY,
  sampled_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  total_conns     INTEGER      NOT NULL DEFAULT 0,
  active_conns    INTEGER      NOT NULL DEFAULT 0,
  idle_conns      INTEGER      NOT NULL DEFAULT 0,
  waiting_conns   INTEGER      NOT NULL DEFAULT 0,
  max_conns       INTEGER      NOT NULL DEFAULT 0,
  utilisation_pct NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN max_conns > 0
         THEN ROUND((active_conns::NUMERIC / max_conns) * 100, 2)
         ELSE 0
    END
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_pool_utilisation_sampled_at
  ON db_pool_utilisation (sampled_at DESC);

CREATE INDEX IF NOT EXISTS idx_pool_utilisation_high
  ON db_pool_utilisation (utilisation_pct DESC, sampled_at DESC)
  WHERE utilisation_pct >= 80;

COMMENT ON TABLE db_pool_utilisation IS
  'Periodic snapshots of PostgreSQL connection pool utilisation for capacity planning.';

-- ---------------------------------------------------------------------------
-- 2. Per-organisation query throughput counters
--    Tracks request volume per organisation per time window so the API can
--    enforce fair-use limits and surface noisy-neighbour patterns.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_query_throughput (
  id              BIGSERIAL    PRIMARY KEY,
  organization_id INTEGER      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  window_start    TIMESTAMPTZ  NOT NULL,
  window_end      TIMESTAMPTZ  NOT NULL,
  query_count     BIGINT       NOT NULL DEFAULT 0,
  error_count     BIGINT       NOT NULL DEFAULT 0,
  avg_latency_ms  NUMERIC(10,3),
  p95_latency_ms  NUMERIC(10,3),
  recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_throughput_org_window
  ON org_query_throughput (organization_id, window_start);

CREATE INDEX IF NOT EXISTS idx_org_throughput_window
  ON org_query_throughput (window_start DESC, organization_id);

CREATE INDEX IF NOT EXISTS idx_org_throughput_high_error
  ON org_query_throughput (organization_id, error_count DESC)
  WHERE error_count > 0;

COMMENT ON TABLE org_query_throughput IS
  'Per-organisation API query throughput counters for fair-use enforcement and noisy-neighbour detection.';

-- ---------------------------------------------------------------------------
-- 3. Covering index: payroll_runs list by org + status + period (hot path)
--    Avoids heap fetch for the payroll run list endpoint.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payroll_runs_org_status_period
  ON payroll_runs (organization_id, status, period_start DESC)
  INCLUDE (batch_id, total_amount, asset_code, created_at);

-- ---------------------------------------------------------------------------
-- 4. Covering index: payroll_audit_logs by org + action + date
--    Speeds up the audit log list endpoint with action filter.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payroll_audit_org_action_date
  ON payroll_audit_logs (organization_id, action, created_at DESC)
  INCLUDE (actor_type, actor_email, tx_hash, amount);

-- ---------------------------------------------------------------------------
-- 5. Partial index: payroll_items with failed status
--    The failure-investigation query only cares about failed items.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payroll_items_failed
  ON payroll_items (payroll_run_id, employee_id, created_at DESC)
  WHERE status = 'failed';

-- ---------------------------------------------------------------------------
-- 6. Covering index: bulk_payment_batches by org + status (dashboard hot path)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_bulk_batches_org_status
  ON bulk_payment_batches (organization_id, status, created_at DESC)
  INCLUDE (total_items, asset_code);

-- ---------------------------------------------------------------------------
-- 7. Prune function: pool utilisation (retain 7 days)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prune_pool_utilisation() RETURNS void
LANGUAGE sql AS $$
  DELETE FROM db_pool_utilisation WHERE sampled_at < NOW() - INTERVAL '7 days';
$$;

-- ---------------------------------------------------------------------------
-- 8. Prune function: org query throughput (retain 30 days)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prune_org_query_throughput() RETURNS void
LANGUAGE sql AS $$
  DELETE FROM org_query_throughput WHERE window_start < NOW() - INTERVAL '30 days';
$$;
