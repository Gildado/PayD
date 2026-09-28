-- =============================================================================
-- Migration 041: API & Database Scaling – Part 11
-- Purpose : Introduce circuit-breaker state persistence and event logging to
--           support the CircuitBreakerService (Issue #256 – Part 11).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Circuit-breaker state table
--    Stores the current state of each named circuit (one row per service).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  name              TEXT        PRIMARY KEY,
  state             TEXT        NOT NULL DEFAULT 'CLOSED'
                                CHECK (state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
  failure_count     INTEGER     NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  success_count     INTEGER     NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  last_failure_at   TIMESTAMPTZ,
  opened_at         TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  circuit_breaker_state IS
  'Persisted state for each named circuit breaker (one row per service).';
COMMENT ON COLUMN circuit_breaker_state.state IS
  'CLOSED = healthy, OPEN = blocking all requests, HALF_OPEN = probing recovery.';

-- ---------------------------------------------------------------------------
-- 2. Circuit-breaker event log
--    Immutable log of every state-transition event for auditing & metrics.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS circuit_breaker_events (
  id              BIGSERIAL   PRIMARY KEY,
  breaker_name    TEXT        NOT NULL,
  event_type      TEXT        NOT NULL
                              CHECK (event_type IN (
                                'FAILURE', 'SUCCESS', 'OPENED', 'CLOSED', 'HALF_OPENED', 'RESET'
                              )),
  from_state      TEXT,
  to_state        TEXT,
  failure_count   INTEGER,
  message         TEXT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cb_events_name_ts
  ON circuit_breaker_events (breaker_name, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_cb_events_type_ts
  ON circuit_breaker_events (event_type, recorded_at DESC);

COMMENT ON TABLE circuit_breaker_events IS
  'Immutable audit log of circuit-breaker state transitions and failure events.';

-- ---------------------------------------------------------------------------
-- 3. Auto-prune old events (retain last 30 days)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prune_circuit_breaker_events() RETURNS void
LANGUAGE sql AS $$
  DELETE FROM circuit_breaker_events
  WHERE recorded_at < NOW() - INTERVAL '30 days';
$$;

-- ---------------------------------------------------------------------------
-- 4. Seed well-known circuit names so health checks can reference them
-- ---------------------------------------------------------------------------

INSERT INTO circuit_breaker_state (name, state) VALUES
  ('database',     'CLOSED'),
  ('redis',        'CLOSED'),
  ('stellar-api',  'CLOSED'),
  ('email',        'CLOSED')
ON CONFLICT (name) DO NOTHING;
