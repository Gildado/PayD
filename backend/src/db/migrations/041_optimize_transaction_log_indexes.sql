-- Migration #040: Optimize PostgreSQL Indexes for Large Transaction Logs
-- Issue #693: Improve query performance for large transaction audit logs

-- Drop existing indexes that will be replaced with optimized versions
DROP INDEX IF EXISTS idx_tx_audit_created;
DROP INDEX IF EXISTS idx_tx_audit_source;

-- Create composite index for common query patterns (source + timestamp)
CREATE INDEX IF NOT EXISTS idx_tx_audit_source_created 
  ON transaction_audit_logs (source_account, created_at DESC);

-- Create composite index for ledger sequence + timestamp queries
CREATE INDEX IF NOT EXISTS idx_tx_audit_ledger_created 
  ON transaction_audit_logs (ledger_sequence DESC, created_at DESC);

-- Create partial index for successful transactions only (most common query)
CREATE INDEX IF NOT EXISTS idx_tx_audit_successful 
  ON transaction_audit_logs (created_at DESC) 
  WHERE successful = true;

-- Create partial index for failed transactions (for error analysis)
CREATE INDEX IF NOT EXISTS idx_tx_audit_failed 
  ON transaction_audit_logs (source_account, created_at DESC) 
  WHERE successful = false;

-- Create BRIN index for created_at (efficient for time-series data)
CREATE INDEX IF NOT EXISTS idx_tx_audit_created_brin 
  ON transaction_audit_logs USING BRIN (created_at);

-- Create index for operation count queries (analytics)
CREATE INDEX IF NOT EXISTS idx_tx_audit_op_count 
  ON transaction_audit_logs (operation_count, created_at DESC);

-- Add index for fee analysis queries
CREATE INDEX IF NOT EXISTS idx_tx_audit_fee_charged 
  ON transaction_audit_logs (fee_charged DESC, created_at DESC);

-- Analyze table to update statistics for query planner
ANALYZE transaction_audit_logs;

-- Create materialized view for common aggregations (optional performance boost)
CREATE MATERIALIZED VIEW IF NOT EXISTS transaction_audit_summary AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  source_account,
  COUNT(*) as tx_count,
  SUM(CASE WHEN successful THEN 1 ELSE 0 END) as successful_count,
  SUM(CASE WHEN successful THEN 0 ELSE 1 END) as failed_count,
  SUM(fee_charged) as total_fees,
  AVG(operation_count) as avg_operations,
  MIN(created_at) as first_tx,
  MAX(created_at) as last_tx
FROM transaction_audit_logs
GROUP BY DATE_TRUNC('hour', created_at), source_account;

CREATE INDEX IF NOT EXISTS idx_tx_summary_hour_account 
  ON transaction_audit_summary (hour DESC, source_account);

-- Add comment for documentation
COMMENT ON INDEX idx_tx_audit_source_created IS 'Optimized composite index for source account + timestamp queries';
COMMENT ON INDEX idx_tx_audit_ledger_created IS 'Optimized composite index for ledger sequence + timestamp queries';
COMMENT ON INDEX idx_tx_audit_successful IS 'Partial index for successful transactions only';
COMMENT ON INDEX idx_tx_audit_failed IS 'Partial index for failed transactions analysis';
COMMENT ON INDEX idx_tx_audit_created_brin IS 'BRIN index for efficient time-series queries';
COMMENT ON MATERIALIZED VIEW transaction_audit_summary IS 'Hourly aggregated transaction statistics for fast analytics';
