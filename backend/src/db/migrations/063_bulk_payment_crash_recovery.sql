-- =============================================================================
-- Migration 063: Bulk payment crash recovery
-- Purpose : Persist batch identity, signed envelopes and per-item state so a
--           process killed mid-batch can resume without rebuilding payments.
-- Design  : An envelope is claimed with a conditional update before any submit;
--           its signed XDR and hash are durable recovery data. 'interrupted'
--           marks an ambiguous submit whose ledger outcome must be reconciled.
-- =============================================================================

ALTER TABLE bulk_payment_batches
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS request_fingerprint VARCHAR(64),
  ADD COLUMN IF NOT EXISTS resume_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_resumed_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bulk_payment_batches_org_idempotency
  ON bulk_payment_batches (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE bulk_payment_batches
  DROP CONSTRAINT IF EXISTS bulk_payment_batches_status_check;

ALTER TABLE bulk_payment_batches
  ADD CONSTRAINT bulk_payment_batches_status_check
  CHECK (status IN ('pending', 'processing', 'interrupted', 'completed', 'partial', 'failed'));

CREATE TABLE IF NOT EXISTS bulk_payment_envelopes (
  id SERIAL PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES bulk_payment_batches(batch_id) ON DELETE CASCADE,
  envelope_index INTEGER NOT NULL,
  item_count INTEGER NOT NULL,
  source_sequence BIGINT,
  inner_xdr TEXT,
  inner_hash VARCHAR(64),
  fee_bump_xdr TEXT,
  fee_bump_hash VARCHAR(64),
  tx_hash VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP,
  completed_at TIMESTAMP,
  UNIQUE (batch_id, envelope_index)
);

CREATE INDEX IF NOT EXISTS idx_bulk_payment_envelopes_status
  ON bulk_payment_envelopes (status);

ALTER TABLE bulk_payment_items
  ADD COLUMN IF NOT EXISTS envelope_id INTEGER REFERENCES bulk_payment_envelopes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_bulk_payment_items_batch_envelope
  ON bulk_payment_items (batch_id, envelope_index);
