-- =============================================================================
-- Rollback 063: Undo "Bulk payment crash recovery"
-- Pairs with : 063_bulk_payment_crash_recovery.sql
-- Warning    : Drops persisted signed envelopes and idempotency metadata.
-- =============================================================================

DROP INDEX IF EXISTS idx_bulk_payment_items_batch_envelope;

ALTER TABLE bulk_payment_items
  DROP COLUMN IF EXISTS envelope_id,
  DROP COLUMN IF EXISTS updated_at;

DROP TABLE IF EXISTS bulk_payment_envelopes;

DROP INDEX IF EXISTS idx_bulk_payment_batches_org_idempotency;

ALTER TABLE bulk_payment_batches
  DROP CONSTRAINT IF EXISTS bulk_payment_batches_status_check;

ALTER TABLE bulk_payment_batches
  ADD CONSTRAINT bulk_payment_batches_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'partial', 'failed'));

ALTER TABLE bulk_payment_batches
  DROP COLUMN IF EXISTS last_resumed_at,
  DROP COLUMN IF EXISTS resume_count,
  DROP COLUMN IF EXISTS request_fingerprint,
  DROP COLUMN IF EXISTS idempotency_key;
