-- Migration 060: Mainnet payroll/report query indexes
-- Purpose: Cover slow-query and N+1 monitoring workflows plus hot payroll/report lookups.

CREATE INDEX IF NOT EXISTS idx_query_stats_recorded_endpoint_hash_rows
  ON db_query_stats (recorded_at DESC, endpoint, query_hash)
  INCLUDE (execution_ms, rows_returned, cache_hit);

CREATE INDEX IF NOT EXISTS idx_query_stats_endpoint_hash_window
  ON db_query_stats (endpoint, query_hash, recorded_at DESC)
  INCLUDE (execution_ms, rows_returned);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_org_status_created
  ON payroll_runs (organization_id, status, created_at DESC)
  INCLUDE (total_amount, asset_code);

CREATE INDEX IF NOT EXISTS idx_payroll_items_run_employee_status
  ON payroll_items (payroll_run_id, employee_id, status);

CREATE INDEX IF NOT EXISTS idx_report_executions_org_status_started
  ON report_executions (organization_id, status, started_at DESC)
  INCLUDE (agent_id, row_count, file_size);

CREATE INDEX IF NOT EXISTS idx_report_delivery_logs_status_retry
  ON report_delivery_logs (status, next_retry_at)
  WHERE status IN ('PENDING', 'FAILED');

COMMENT ON INDEX idx_query_stats_recorded_endpoint_hash_rows
  IS 'Covers slow-query trend windows and N+1 candidate scans over db_query_stats.';
COMMENT ON INDEX idx_query_stats_endpoint_hash_window
  IS 'Supports grouping repeated query fingerprints by endpoint for N+1 detection.';
