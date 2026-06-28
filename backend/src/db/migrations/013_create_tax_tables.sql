-- Migration: Create tax rules and tax reports tables
-- Supports configurable per-organization tax rules and compliance reporting

CREATE TABLE IF NOT EXISTS tax_rules (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value DECIMAL(20, 7) NOT NULL CHECK (value >= 0),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tax_reports (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  tax_rule_id INTEGER NOT NULL REFERENCES tax_rules(id) ON DELETE CASCADE,
  gross_amount DECIMAL(20, 7) NOT NULL,
  tax_amount DECIMAL(20, 7) NOT NULL,
  net_amount DECIMAL(20, 7) NOT NULL,
  period_start DATE,
  period_end DATE,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for tax_rules
CREATE INDEX IF NOT EXISTS idx_tax_rules_org_id ON tax_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_tax_rules_active ON tax_rules(organization_id, is_active);

-- Indexes for tax_reports
CREATE INDEX IF NOT EXISTS idx_tax_reports_org_id ON tax_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_tax_reports_employee_id ON tax_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_tax_reports_period ON tax_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_tax_reports_rule_id ON tax_reports(tax_rule_id);

-- Apply updated_at trigger to tax_rules
CREATE TRIGGER update_tax_rules_updated_at BEFORE UPDATE ON tax_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
