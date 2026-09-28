-- Rollback for Migration 041: API & Database Scaling – Part 11 (Circuit Breaker)
-- Reverses all schema objects introduced by the forward migration.

-- ---------------------------------------------------------------------------
-- 3. Drop auto-prune function
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS prune_circuit_breaker_events();

-- ---------------------------------------------------------------------------
-- 2. Drop event log table and its indexes
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS idx_cb_events_type_ts;
DROP INDEX IF EXISTS idx_cb_events_name_ts;
DROP TABLE IF EXISTS circuit_breaker_events;

-- ---------------------------------------------------------------------------
-- 1. Drop circuit-breaker state table
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS circuit_breaker_state;
