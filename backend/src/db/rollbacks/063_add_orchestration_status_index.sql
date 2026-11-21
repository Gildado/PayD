-- Rollback for migration 063.
DROP INDEX IF EXISTS idx_orchestration_records_status_updated;
