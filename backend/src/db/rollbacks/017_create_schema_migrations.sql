-- Rollback: 011_create_schema_migrations
-- WARNING: Dropping this table removes the migration tracking history.
-- The migration runner will treat all migrations as unapplied on next run.
DROP INDEX IF EXISTS idx_schema_migrations_applied_at;
DROP INDEX IF EXISTS idx_schema_migrations_filename;
DROP TABLE IF EXISTS schema_migrations;
