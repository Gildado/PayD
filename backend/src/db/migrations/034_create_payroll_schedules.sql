CREATE TABLE IF NOT EXISTS payroll_schedules (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  cron_expression VARCHAR(100) NOT NULL,
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  asset_code VARCHAR(12) NOT NULL DEFAULT 'XLM',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  missed_runs_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payroll_schedules_org ON payroll_schedules(organization_id);
CREATE INDEX idx_payroll_schedules_active ON payroll_schedules(is_active) WHERE is_active = true;
CREATE INDEX idx_payroll_schedules_next_run ON payroll_schedules(next_run_at) WHERE is_active = true;
