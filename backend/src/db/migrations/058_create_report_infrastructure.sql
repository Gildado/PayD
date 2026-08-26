-- Migration 058: Create reporting agent infrastructure
-- Purpose: Establish tables and indexes for report agents, executions, delivery, and access control
-- Design: Supports multi-format reports, flexible delivery channels, row-level security, and audit logging

CREATE TABLE IF NOT EXISTS report_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id INTEGER NOT NULL,
  agent_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  query_type VARCHAR(50) NOT NULL CHECK (query_type IN ('PAYROLL', 'TRANSACTIONS', 'AUDIT', 'CUSTOM')),
  output_schema JSONB NOT NULL,
  input_filters JSONB,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  organization_id INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  filters JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  row_count INTEGER,
  file_size INTEGER,
  file_path VARCHAR(1000),
  executed_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (agent_id) REFERENCES report_agents(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS report_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL UNIQUE,
  format VARCHAR(50) NOT NULL CHECK (format IN ('JSON', 'CSV', 'XLSX', 'PDF')),
  data JSONB,
  summary JSONB NOT NULL,
  metadata JSONB NOT NULL,
  checksum VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (execution_id) REFERENCES report_executions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_delivery_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  channel VARCHAR(50) NOT NULL CHECK (channel IN ('EMAIL', 'WEBHOOK', 'IN_APP')),
  enabled BOOLEAN DEFAULT TRUE,
  config JSONB NOT NULL,
  retry_policy JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (agent_id) REFERENCES report_agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL,
  channel VARCHAR(50) NOT NULL,
  recipient VARCHAR(255),
  status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'BOUNCED')),
  error_message TEXT,
  attempt_count INTEGER DEFAULT 1,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (execution_id) REFERENCES report_executions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_access_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rules JSONB NOT NULL,
  row_level_security JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (agent_id) REFERENCES report_agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  payload JSONB,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_report_agents_organization ON report_agents(organization_id);
CREATE INDEX idx_report_agents_created_by ON report_agents(created_by);
CREATE INDEX idx_report_executions_agent_id ON report_executions(agent_id);
CREATE INDEX idx_report_executions_organization_id ON report_executions(organization_id);
CREATE INDEX idx_report_executions_status ON report_executions(status);
CREATE INDEX idx_report_executions_created_at ON report_executions(created_at DESC);
CREATE INDEX idx_report_results_execution_id ON report_results(execution_id);
CREATE INDEX idx_report_delivery_configs_agent_id ON report_delivery_configs(agent_id);
CREATE INDEX idx_report_delivery_logs_execution_id ON report_delivery_logs(execution_id);
CREATE INDEX idx_report_delivery_logs_status ON report_delivery_logs(status);
CREATE INDEX idx_report_access_policies_agent_id ON report_access_policies(agent_id);
CREATE INDEX idx_in_app_notifications_user_id ON in_app_notifications(user_id);
CREATE INDEX idx_in_app_notifications_read ON in_app_notifications(read);
CREATE INDEX idx_in_app_notifications_created_at ON in_app_notifications(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_report_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER trigger_report_agents_updated
BEFORE UPDATE ON report_agents
FOR EACH ROW
EXECUTE FUNCTION update_report_timestamp();

CREATE TRIGGER trigger_report_executions_updated
BEFORE UPDATE ON report_executions
FOR EACH ROW
EXECUTE FUNCTION update_report_timestamp();

CREATE TRIGGER trigger_report_delivery_configs_updated
BEFORE UPDATE ON report_delivery_configs
FOR EACH ROW
EXECUTE FUNCTION update_report_timestamp();

CREATE TRIGGER trigger_report_delivery_logs_updated
BEFORE UPDATE ON report_delivery_logs
FOR EACH ROW
EXECUTE FUNCTION update_report_timestamp();

CREATE TRIGGER trigger_report_access_policies_updated
BEFORE UPDATE ON report_access_policies
FOR EACH ROW
EXECUTE FUNCTION update_report_timestamp();

CREATE TRIGGER trigger_in_app_notifications_updated
BEFORE UPDATE ON in_app_notifications
FOR EACH ROW
EXECUTE FUNCTION update_report_timestamp();
