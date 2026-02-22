-- Create clawback_audit_logs table
CREATE TABLE IF NOT EXISTS clawback_audit_logs (
  id SERIAL PRIMARY KEY,
  transaction_hash VARCHAR(64) NOT NULL,
  asset_code VARCHAR(12) NOT NULL,
  amount DECIMAL(20, 7) NOT NULL,
  from_account VARCHAR(56) NOT NULL,
  issuer_account VARCHAR(56) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_clawback_tx_hash ON clawback_audit_logs(transaction_hash);
CREATE INDEX idx_clawback_from_account ON clawback_audit_logs(from_account);
