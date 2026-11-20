-- Rollback for Migration 055: Migration Run Log

DROP INDEX IF EXISTS idx_migration_run_log_status_time;
DROP INDEX IF EXISTS idx_migration_run_log_filename;

DROP TABLE IF EXISTS migration_run_log;
