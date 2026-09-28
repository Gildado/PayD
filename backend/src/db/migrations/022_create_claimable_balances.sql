CREATE TABLE IF NOT EXISTS claimable_balances (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  payroll_run_id INTEGER REFERENCES payroll_runs(id) ON DELETE CASCADE,
  payroll_item_id INTEGER REFERENCES payroll_items(id) ON DELETE CASCADE,
  balance_id VARCHAR(128) NOT NULL UNIQUE,
  claimant_public_key VARCHAR(56),
  amount DECIMAL(20, 7) NOT NULL,
  asset_code VARCHAR(12) NOT NULL,
  asset_issuer VARCHAR(56),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired', 'clawed_back')),
  sponsor_public_key VARCHAR(56) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  claimed_at TIMESTAMP,
  expires_at TIMESTAMP,
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMP,
  claim_instructions TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_claimable_balances_org_id ON claimable_balances(organization_id);
CREATE INDEX idx_claimable_balances_employee_id ON claimable_balances(employee_id);
CREATE INDEX idx_claimable_balances_payroll_run_id ON claimable_balances(payroll_run_id);
CREATE INDEX idx_claimable_balances_status ON claimable_balances(status);
CREATE INDEX idx_claimable_balances_balance_id ON claimable_balances(balance_id);
CREATE INDEX idx_claimable_balances_claimant ON claimable_balances(claimant_public_key);

CREATE TRIGGER update_claimable_balances_updated_at BEFORE UPDATE ON claimable_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
