-- Rollback: 006_create_transaction_audit_logs
DROP INDEX IF EXISTS idx_tx_audit_hash;
DROP TABLE IF EXISTS transaction_audit_logs;
