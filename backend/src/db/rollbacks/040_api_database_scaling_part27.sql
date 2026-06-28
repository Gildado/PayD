-- Rollback for Migration 040: API & Database Scaling – Part 27
-- Reverses all schema objects introduced by the forward migration.

-- ---------------------------------------------------------------------------
-- 5. Drop materialised view and its index
-- ---------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS mv_org_daily_tx_summary;

-- ---------------------------------------------------------------------------
-- 4. Drop connection-pool health table and its index/function
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS prune_pool_health();
DROP INDEX IF EXISTS idx_pool_health_ts;
DROP TABLE IF EXISTS db_pool_health;

-- ---------------------------------------------------------------------------
-- 3. Drop query-statistics table and its indexes
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS idx_query_stats_slow;
DROP INDEX IF EXISTS idx_query_stats_endpoint_ts;
DROP TABLE IF EXISTS db_query_stats;

-- ---------------------------------------------------------------------------
-- 2. Drop covering indexes
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS idx_employees_org_name;
DROP INDEX IF EXISTS idx_payroll_runs_covering;

-- ---------------------------------------------------------------------------
-- 1. Drop partial indexes
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS idx_notifications_unread;
DROP INDEX IF EXISTS idx_transactions_pending;
DROP INDEX IF EXISTS idx_employees_active_org;
