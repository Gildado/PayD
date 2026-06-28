CREATE TABLE IF NOT EXISTS payroll_runs (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_id VARCHAR(64) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'processing', 'completed', 'failed')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_base_amount DECIMAL(20, 7) DEFAULT 0,
  total_bonus_amount DECIMAL(20, 7) DEFAULT 0,
  total_amount DECIMAL(20, 7) DEFAULT 0,
  asset_code VARCHAR(12) NOT NULL DEFAULT 'XLM',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_items (
  id SERIAL PRIMARY KEY,
  payroll_run_id INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('base', 'bonus')),
  amount DECIMAL(20, 7) NOT NULL,
  description TEXT,
  tx_hash VARCHAR(64),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payroll_runs_org_id ON payroll_runs(organization_id);
CREATE INDEX idx_payroll_runs_batch_id ON payroll_runs(batch_id);
CREATE INDEX idx_payroll_runs_status ON payroll_runs(status);
CREATE INDEX idx_payroll_runs_period ON payroll_runs(period_start, period_end);
CREATE INDEX idx_payroll_items_run_id ON payroll_items(payroll_run_id);
CREATE INDEX idx_payroll_items_employee_id ON payroll_items(employee_id);
CREATE INDEX idx_payroll_items_type ON payroll_items(item_type);

CREATE TRIGGER update_payroll_runs_updated_at BEFORE UPDATE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payroll_items_updated_at BEFORE UPDATE ON payroll_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
