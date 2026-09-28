-- Rollback: 014_create_contract_registry
DROP INDEX IF EXISTS idx_upgrade_logs_created_at_brin;
DROP INDEX IF EXISTS idx_upgrade_logs_active_status;
DROP INDEX IF EXISTS idx_upgrade_logs_registry_id;
DROP TABLE IF EXISTS contract_upgrade_logs;

DROP INDEX IF EXISTS idx_contract_registry_network;
DROP TABLE IF EXISTS contract_registry;
