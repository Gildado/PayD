-- Rollback: 019_create_bulk_payment_batches
DROP INDEX IF EXISTS idx_bulk_items_status;
DROP INDEX IF EXISTS idx_bulk_items_batch;
DROP INDEX IF EXISTS idx_bulk_batches_status;
DROP INDEX IF EXISTS idx_bulk_batches_org;
DROP TABLE IF EXISTS bulk_payment_items;
DROP TABLE IF EXISTS bulk_payment_batches;
