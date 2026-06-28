-- Rollback: 004_create_clawback_audit_logs
DROP INDEX IF EXISTS idx_clawback_from_account;
DROP INDEX IF EXISTS idx_clawback_tx_hash;
DROP TABLE IF EXISTS clawback_audit_logs;
