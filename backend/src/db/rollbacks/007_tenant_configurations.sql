-- Rollback: 004_tenant_configurations
DROP FUNCTION IF EXISTS set_tenant_config(VARCHAR, JSONB, TEXT);
DROP FUNCTION IF EXISTS get_tenant_config(VARCHAR);

DROP TRIGGER IF EXISTS update_tenant_configurations_updated_at ON tenant_configurations;

DROP POLICY IF EXISTS tenant_isolation_configs_delete ON tenant_configurations;
DROP POLICY IF EXISTS tenant_isolation_configs_update ON tenant_configurations;
DROP POLICY IF EXISTS tenant_isolation_configs_insert ON tenant_configurations;
DROP POLICY IF EXISTS tenant_isolation_configs_select ON tenant_configurations;

DROP INDEX IF EXISTS idx_tenant_configs_org_key;
DROP INDEX IF EXISTS idx_tenant_configs_key;
DROP INDEX IF EXISTS idx_tenant_configs_org_id;

DROP TABLE IF EXISTS tenant_configurations;
