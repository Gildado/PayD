-- Rollback for Migration 044: Migration Rollback Audit Log
-- Drops the audit table and its indexes.

DROP INDEX IF EXISTS idx_migration_rollback_log_ts;
DROP INDEX IF EXISTS idx_migration_rollback_log_filename;
DROP TABLE IF EXISTS migration_rollback_log;
