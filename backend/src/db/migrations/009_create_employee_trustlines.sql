-- Track ORGUSD trustline status per employee wallet
CREATE TABLE IF NOT EXISTS employee_trustlines (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  wallet_address VARCHAR(56) NOT NULL,
  asset_code VARCHAR(12) NOT NULL DEFAULT 'ORGUSD',
  asset_issuer VARCHAR(56) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'none',  -- 'none', 'pending', 'established'
  last_checked_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_trustlines_employee_asset
  ON employee_trustlines (employee_id, asset_code, asset_issuer);

CREATE INDEX IF NOT EXISTS idx_employee_trustlines_wallet
  ON employee_trustlines (wallet_address);

CREATE INDEX IF NOT EXISTS idx_employee_trustlines_status
  ON employee_trustlines (status);
