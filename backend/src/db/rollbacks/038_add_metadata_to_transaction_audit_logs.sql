-- =============================================================================
-- Rollback 038: Undo "Add metadata column to transaction_audit_logs"
-- Pairs with : 038_add_metadata_to_transaction_audit_logs.sql
-- Purpose    : Remove the metadata JSONB column and its GIN index from the
--              transaction_audit_logs table, reversing migration 038.
-- Warning    : Running this rollback will permanently delete all metadata
--              attached to existing audit log records. Back up the column
--              contents before executing if the data must be preserved.
-- =============================================================================

DROP INDEX IF EXISTS idx_tx_audit_metadata;

ALTER TABLE transaction_audit_logs
  DROP COLUMN IF EXISTS metadata;
