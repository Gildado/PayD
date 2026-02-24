-- Migration 004: Tenant-Specific Configurations
-- Support for organization-level configuration and customization

-- Create tenant configurations table
CREATE TABLE IF NOT EXISTS tenant_configurations (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  config_key VARCHAR(100) NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, config_key)
);

-- Enable RLS on tenant configurations
ALTER TABLE tenant_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant_configurations
CREATE POLICY tenant_isolation_configs_select ON tenant_configurations
  FOR SELECT
  USING (organization_id = current_tenant_id());

CREATE POLICY tenant_isolation_configs_insert ON tenant_configurations
  FOR INSERT
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_isolation_configs_update ON tenant_configurations
  FOR UPDATE
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_isolation_configs_delete ON tenant_configurations
  FOR DELETE
  USING (organization_id = current_tenant_id());

-- Create indexes
CREATE INDEX idx_tenant_configs_org_id ON tenant_configurations(organization_id);
CREATE INDEX idx_tenant_configs_key ON tenant_configurations(config_key);
CREATE INDEX idx_tenant_configs_org_key ON tenant_configurations(organization_id, config_key);

-- Apply updated_at trigger
CREATE TRIGGER update_tenant_configurations_updated_at BEFORE UPDATE ON tenant_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default configurations for existing organizations
INSERT INTO tenant_configurations (organization_id, config_key, config_value, description)
SELECT 
  id,
  'payment_settings',
  '{"default_currency": "USDC", "auto_approve_threshold": 1000, "require_dual_approval": false}'::jsonb,
  'Default payment processing settings'
FROM organizations
ON CONFLICT (organization_id, config_key) DO NOTHING;

INSERT INTO tenant_configurations (organization_id, config_key, config_value, description)
SELECT 
  id,
  'notification_settings',
  '{"email_notifications": true, "sms_notifications": false, "webhook_url": null}'::jsonb,
  'Notification preferences'
FROM organizations
ON CONFLICT (organization_id, config_key) DO NOTHING;

INSERT INTO tenant_configurations (organization_id, config_key, config_value, description)
SELECT 
  id,
  'security_settings',
  '{"session_timeout_minutes": 30, "require_2fa": false, "ip_whitelist": []}'::jsonb,
  'Security and access control settings'
FROM organizations
ON CONFLICT (organization_id, config_key) DO NOTHING;

INSERT INTO tenant_configurations (organization_id, config_key, config_value, description)
SELECT 
  id,
  'branding',
  '{"logo_url": null, "primary_color": "#3B82F6", "company_name": null}'::jsonb,
  'Branding and customization settings'
FROM organizations
ON CONFLICT (organization_id, config_key) DO NOTHING;

-- Create a helper function to get tenant configuration
CREATE OR REPLACE FUNCTION get_tenant_config(key VARCHAR)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT config_value INTO result
  FROM tenant_configurations
  WHERE organization_id = current_tenant_id()
    AND config_key = key;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a helper function to set tenant configuration
CREATE OR REPLACE FUNCTION set_tenant_config(key VARCHAR, value JSONB, desc TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  INSERT INTO tenant_configurations (organization_id, config_key, config_value, description)
  VALUES (current_tenant_id(), key, value, desc)
  ON CONFLICT (organization_id, config_key)
  DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    description = COALESCE(EXCLUDED.description, tenant_configurations.description),
    updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE tenant_configurations IS 'Stores tenant-specific configuration settings with RLS isolation';
COMMENT ON FUNCTION get_tenant_config(VARCHAR) IS 'Retrieves configuration value for current tenant';
COMMENT ON FUNCTION set_tenant_config(VARCHAR, JSONB, TEXT) IS 'Sets or updates configuration value for current tenant';
