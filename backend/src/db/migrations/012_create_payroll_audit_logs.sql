CREATE TABLE IF NOT EXISTS payroll_audit_logs (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payroll_run_id INTEGER REFERENCES payroll_runs(id) ON DELETE SET NULL,
  payroll_item_id INTEGER REFERENCES payroll_items(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN (
    'run_created',
    'run_status_changed',
    'item_added',
    'item_deleted',
    'item_status_changed',
    'transaction_submitted',
    'transaction_succeeded',
    'transaction_failed'
  )),
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('system', 'user', 'api')),
  actor_id VARCHAR(255),
  actor_email VARCHAR(255),
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  tx_hash VARCHAR(64),
  stellar_ledger INTEGER,
  amount DECIMAL(20, 7),
  asset_code VARCHAR(12),
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payroll_audit_org_id ON payroll_audit_logs(organization_id);
CREATE INDEX idx_payroll_audit_run_id ON payroll_audit_logs(payroll_run_id);
CREATE INDEX idx_payroll_audit_action ON payroll_audit_logs(action);
CREATE INDEX idx_payroll_audit_created_at ON payroll_audit_logs(created_at);
CREATE INDEX idx_payroll_audit_tx_hash ON payroll_audit_logs(tx_hash);
CREATE INDEX idx_payroll_audit_employee_id ON payroll_audit_logs(employee_id);
CREATE INDEX idx_payroll_audit_actor ON payroll_audit_logs(actor_type, actor_id);
