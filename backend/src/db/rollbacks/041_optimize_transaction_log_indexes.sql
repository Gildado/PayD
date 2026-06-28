-- Rollback for Migration 040: Optimize PostgreSQL Indexes for Large Transaction Logs
-- Issue #693: Reverses the optimized indexes and materialised view.

-- Drop materialised view and its index
DROP INDEX IF EXISTS idx_tx_summary_hour_account;
DROP MATERIALIZED VIEW IF EXISTS transaction_audit_summary;

-- Drop optimized indexes added by the forward migration
DROP INDEX IF EXISTS idx_tx_audit_fee_charged;
DROP INDEX IF EXISTS idx_tx_audit_op_count;
DROP INDEX IF EXISTS idx_tx_audit_created_brin;
DROP INDEX IF EXISTS idx_tx_audit_failed;
DROP INDEX IF EXISTS idx_tx_audit_successful;
DROP INDEX IF EXISTS idx_tx_audit_ledger_created;
DROP INDEX IF EXISTS idx_tx_audit_source_created;

-- Restore the original indexes that were dropped in the forward migration
CREATE INDEX IF NOT EXISTS idx_tx_audit_created
  ON transaction_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tx_audit_source
  ON transaction_audit_logs (source_account);
