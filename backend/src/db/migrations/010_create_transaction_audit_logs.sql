-- Immutable audit records for on-chain transaction verification.
-- No updated_at column or UPDATE trigger — records are append-only.
CREATE TABLE IF NOT EXISTS transaction_audit_logs (
  id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(64) UNIQUE NOT NULL,
  ledger_sequence BIGINT NOT NULL,
  stellar_created_at TIMESTAMP NOT NULL,
  envelope_xdr TEXT NOT NULL,
  result_xdr TEXT NOT NULL,
  source_account VARCHAR(56) NOT NULL,
  fee_charged BIGINT NOT NULL,
  operation_count INT NOT NULL,
  memo TEXT,
  successful BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_audit_hash
  ON transaction_audit_logs (tx_hash);

CREATE INDEX IF NOT EXISTS idx_tx_audit_source
  ON transaction_audit_logs (source_account);

CREATE INDEX IF NOT EXISTS idx_tx_audit_ledger
  ON transaction_audit_logs (ledger_sequence);

CREATE INDEX IF NOT EXISTS idx_tx_audit_created
  ON transaction_audit_logs (created_at);
