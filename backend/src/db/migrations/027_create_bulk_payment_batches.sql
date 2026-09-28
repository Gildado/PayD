-- Tracks bulk payment batch submissions for rollback and status reporting.
CREATE TABLE IF NOT EXISTS bulk_payment_batches (
  id SERIAL PRIMARY KEY,
  batch_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  source_account VARCHAR(56) NOT NULL,
  total_items INTEGER NOT NULL,
  successful_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'partial', 'failed')),
  asset_code VARCHAR(12) NOT NULL,
  asset_issuer VARCHAR(56),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bulk_payment_items (
  id SERIAL PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES bulk_payment_batches(batch_id) ON DELETE CASCADE,
  envelope_index INTEGER NOT NULL,
  destination VARCHAR(56) NOT NULL,
  amount NUMERIC(20, 7) NOT NULL,
  reference_id VARCHAR(255),
  tx_hash VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulk_batches_org ON bulk_payment_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_bulk_batches_status ON bulk_payment_batches(status);
CREATE INDEX IF NOT EXISTS idx_bulk_items_batch ON bulk_payment_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_bulk_items_status ON bulk_payment_items(status);
