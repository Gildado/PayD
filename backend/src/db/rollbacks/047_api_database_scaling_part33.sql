-- Rollback for Migration 047: API & Database Scaling – Part 33 (Issue #278)

DROP FUNCTION IF EXISTS prune_query_plan_cache();
DROP FUNCTION IF EXISTS prune_deadlock_history();

DROP INDEX IF EXISTS idx_circuit_breaker_open;
DROP INDEX IF EXISTS idx_webhook_subs_active_event;
DROP INDEX IF EXISTS idx_bulk_items_batch_envelope;
DROP INDEX IF EXISTS idx_payroll_items_run_status;

DROP INDEX IF EXISTS idx_query_plan_cache_resets;
DROP INDEX IF EXISTS idx_query_plan_cache_hash;
DROP TABLE IF EXISTS db_query_plan_cache;

DROP INDEX IF EXISTS idx_deadlock_history_ts;
DROP TABLE IF EXISTS db_deadlock_history;

-- Reset idle_in_transaction_session_timeout back to the cluster default (disabled).
DO $$
BEGIN
  EXECUTE 'ALTER DATABASE ' || current_database()
       || ' SET idle_in_transaction_session_timeout = ''0''';
END;
$$;
