-- =============================================================================
-- Migration 030: Add metadata column to transaction_audit_logs
-- Purpose : Allow callers to attach arbitrary key-value context to an audit
--           record (e.g. payroll run ID, employee ID, notes) without polluting
--           the core immutable fields.  JSONB enables indexed queries.
-- =============================================================================

ALTER TABLE transaction_audit_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_tx_audit_metadata
  ON transaction_audit_logs USING gin (metadata)
  WHERE metadata IS NOT NULL;
