-- Rollback for Migration 049: API & Database Scaling – Part 24 (Issue #269)

DROP FUNCTION IF EXISTS prune_org_query_throughput();
DROP FUNCTION IF EXISTS prune_pool_utilisation();

DROP INDEX IF EXISTS idx_bulk_batches_org_status;
DROP INDEX IF EXISTS idx_payroll_items_failed;
DROP INDEX IF EXISTS idx_payroll_audit_org_action_date;
DROP INDEX IF EXISTS idx_payroll_runs_org_status_period;

DROP INDEX IF EXISTS idx_org_throughput_high_error;
DROP INDEX IF EXISTS idx_org_throughput_window;
DROP INDEX IF EXISTS idx_org_throughput_org_window;
DROP TABLE IF EXISTS org_query_throughput;

DROP INDEX IF EXISTS idx_pool_utilisation_high;
DROP INDEX IF EXISTS idx_pool_utilisation_sampled_at;
DROP TABLE IF EXISTS db_pool_utilisation;
