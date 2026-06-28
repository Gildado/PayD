-- Rollback: 012_create_wallets
DROP VIEW IF EXISTS active_employee_wallets;

DROP TRIGGER IF EXISTS validate_wallet_employee_org_trigger ON wallets;
DROP FUNCTION IF EXISTS validate_wallet_employee_org();
DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;

DROP POLICY IF EXISTS wallet_isolation_delete ON wallets;
DROP POLICY IF EXISTS wallet_isolation_update ON wallets;
DROP POLICY IF EXISTS wallet_isolation_insert ON wallets;
DROP POLICY IF EXISTS wallet_isolation_select ON wallets;

ALTER TABLE wallets DISABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS idx_wallets_payroll_disbursement;
DROP INDEX IF EXISTS idx_wallets_last_synced_at;
DROP INDEX IF EXISTS idx_wallets_frozen;
DROP INDEX IF EXISTS idx_wallets_org_asset;
DROP INDEX IF EXISTS idx_wallets_wallet_address;
DROP INDEX IF EXISTS idx_wallets_employee_id;
DROP INDEX IF EXISTS idx_wallets_org_id;

DROP TABLE IF EXISTS wallets;
