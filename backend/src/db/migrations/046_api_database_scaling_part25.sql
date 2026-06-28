-- =============================================================================
-- Migration 046: API & Database Scaling – Part 25
-- Purpose : Introduce a per-endpoint latency histogram table for fine-grained
--           p50/p95/p99 monitoring, and covering indexes for the highest-traffic
--           API query paths.
--           Closes Issue #715 – API & Database Scaling Part 25.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Endpoint latency histogram
--    Stores bucketed latency observations so the API can serve pre-computed
--    percentiles without hitting pg_stat_statements directly.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api_latency_histogram (
  id            BIGSERIAL    PRIMARY KEY,
  endpoint      TEXT         NOT NULL,
  method        VARCHAR(10)  NOT NULL DEFAULT 'GET',
  bucket_ms     INTEGER      NOT NULL CHECK (bucket_ms > 0),
  observations  BIGINT       NOT NULL DEFAULT 1 CHECK (observations > 0),
  window_start  TIMESTAMPTZ  NOT NULL,
  window_end    TIMESTAMPTZ  NOT NULL,
  recorded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_latency_endpoint_window
  ON api_latency_histogram (endpoint, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_api_latency_bucket
  ON api_latency_histogram (bucket_ms, recorded_at DESC);

-- Retain only the last 30 days of histogram data
CREATE OR REPLACE FUNCTION prune_api_latency_histogram() RETURNS void
LANGUAGE sql AS $$
  DELETE FROM api_latency_histogram WHERE recorded_at < NOW() - INTERVAL '30 days';
$$;

-- ---------------------------------------------------------------------------
-- 2. Covering index for employee list API (org + status + name — Issue #715)
--    Avoids a heap fetch for the most common list-view SELECT.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_employees_list_covering
  ON employees (organization_id, status, created_at DESC)
  INCLUDE (first_name, last_name, email, wallet_address);

-- ---------------------------------------------------------------------------
-- 3. Covering index for transaction list API (org + status + date)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_transactions_list_covering
  ON transactions (organization_id, status, created_at DESC)
  INCLUDE (amount, transaction_type);

-- ---------------------------------------------------------------------------
-- 4. Comments
-- ---------------------------------------------------------------------------

COMMENT ON TABLE api_latency_histogram IS
  'Pre-bucketed API latency observations for p50/p95/p99 computation without pg_stat_statements.';
