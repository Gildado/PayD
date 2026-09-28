-- Rollback for Migration 051: Batch Archive Tracking (Issue #599)

DROP INDEX IF EXISTS idx_batch_archive_date;
DROP INDEX IF EXISTS idx_batch_archive_org;
DROP INDEX IF EXISTS idx_batch_archive_batch_id;

DROP TABLE IF EXISTS batch_archive;
