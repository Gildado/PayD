-- Rollback: 016_create_claimable_balances
DROP TRIGGER IF EXISTS update_claimable_balances_updated_at ON claimable_balances;
DROP INDEX IF EXISTS idx_claimable_balances_claimant;
DROP INDEX IF EXISTS idx_claimable_balances_balance_id;
DROP INDEX IF EXISTS idx_claimable_balances_status;
DROP INDEX IF EXISTS idx_claimable_balances_payroll_run_id;
DROP INDEX IF EXISTS idx_claimable_balances_employee_id;
DROP INDEX IF EXISTS idx_claimable_balances_org_id;
DROP TABLE IF EXISTS claimable_balances;
