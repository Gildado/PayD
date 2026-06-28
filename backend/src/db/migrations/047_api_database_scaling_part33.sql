-- =============================================================================
-- Migration 047: API & Database Scaling – Part 33 (Issue #278)
-- Purpose : Introduce query-plan cache tracking, deadlock history logging,
--           idle-in-transaction timeout enforcement, and additional covering
--           indexes for the highest-traffic read paths.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. idle_in_transaction_session_timeout advisory
--    Prevents hung transactions from holding locks indefinitely.
--    Set at the database level so all new connections inherit it.
--    Value: 60 seconds (60000 ms).
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- Only apply if not already set to a non-zero value
  IF current_setting('idle_in_transaction_session_timeout') = '0' THEN
    EXECUTE 'ALTER DATABASE ' || current_database()
         || ' SET idle_in_transaction_session_timeout = ''60s''';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Deadlock history table
--    Records deadlock events detected by the application layer so operators
--    can correlate them with query patterns and circuit-breaker trips.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS db_deadlock_history (
  id              BIGSERIAL    PRIMARY KEY,
  detected_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  pid1            INTEGER,
  pid2            INTEGER,
  relation        TEXT,
  query1          TEXT,
  query2          TEXT,
  resolved        BOOLEAN      NOT NULL DEFAULT FALSE,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_deadlock_history_ts
  ON db_deadlock_history (detected_at DESC);

COMMENT ON TABLE db_deadlock_history IS
  'Application-layer deadlock event log for correlation with circuit-breaker trips.';

-- ---------------------------------------------------------------------------
-- 3. Query plan cache table
--    Tracks prepared-statement plan invalidations so the team can identify
--    queries that are being re-planned frequently (plan cache thrashing).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS db_query_plan_cache (
  id              BIGSERIAL    PRIMARY KEY,
  query_hash      TEXT         NOT NULL,
  query_text      TEXT         NOT NULL,
  plan_calls      BIGINT       NOT NULL DEFAULT 0,
  plan_resets     BIGINT       NOT NULL DEFAULT 0,
  last_plan_reset TIMESTAMPTZ,
  recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_query_plan_cache_hash
  ON db_query_plan_cache (query_hash);

CREATE INDEX IF NOT EXISTS idx_query_plan_cache_resets
  ON db_query_plan_cache (plan_resets DESC, recorded_at DESC);

COMMENT ON TABLE db_query_plan_cache IS
  'Tracks prepared-statement plan invalidations to detect plan-cache thrashing.';

-- ---------------------------------------------------------------------------
-- 4. Covering index: payroll items by run + status (hot path for run summary)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payroll_items_run_status
  ON payroll_items (payroll_run_id, status)
  INCLUDE (employee_id, amount, item_type);

-- ---------------------------------------------------------------------------
-- 5. Covering index: bulk_payment_items by batch + envelope (hot path for
--    batch status polling)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_bulk_items_batch_envelope
  ON bulk_payment_items (batch_id, envelope_index)
  INCLUDE (status, tx_hash, destination, amount);

-- ---------------------------------------------------------------------------
-- 6. Partial index: only active webhook subscriptions (avoids scanning
--    disabled/deleted rows on every event dispatch)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_webhook_subs_active_event
  ON webhook_subscriptions (events, organization_id)
  WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- 7. Partial index: circuit_breaker_state for non-CLOSED circuits
--    (the management API only cares about OPEN / HALF_OPEN rows)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_open
  ON circuit_breaker_state (name, updated_at DESC)
  WHERE state != 'CLOSED';

-- ---------------------------------------------------------------------------
-- 8. Prune function for deadlock history (retain 30 days)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prune_deadlock_history() RETURNS void
LANGUAGE sql AS $$
  DELETE FROM db_deadlock_history WHERE detected_at < NOW() - INTERVAL '30 days';
$$;

-- ---------------------------------------------------------------------------
-- 9. Prune function for query plan cache (retain 7 days of stale entries)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prune_query_plan_cache() RETURNS void
LANGUAGE sql AS $$
  DELETE FROM db_query_plan_cache WHERE recorded_at < NOW() - INTERVAL '7 days';
$$;
