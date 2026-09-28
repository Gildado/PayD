-- Rollback: 003_multi_tenant_rls
DROP VIEW IF EXISTS tenant_statistics;

DROP TRIGGER IF EXISTS validate_transaction_tenant ON transactions;
DROP TRIGGER IF EXISTS validate_employee_tenant ON employees;
DROP FUNCTION IF EXISTS validate_tenant_consistency();

DROP POLICY IF EXISTS tenant_isolation_transactions_delete ON transactions;
DROP POLICY IF EXISTS tenant_isolation_transactions_update ON transactions;
DROP POLICY IF EXISTS tenant_isolation_transactions_insert ON transactions;
DROP POLICY IF EXISTS tenant_isolation_transactions_select ON transactions;

DROP POLICY IF EXISTS tenant_isolation_employees_delete ON employees;
DROP POLICY IF EXISTS tenant_isolation_employees_update ON employees;
DROP POLICY IF EXISTS tenant_isolation_employees_insert ON employees;
DROP POLICY IF EXISTS tenant_isolation_employees_select ON employees;

ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS idx_organizations_tenant_id;
ALTER TABLE organizations DROP COLUMN IF EXISTS tenant_id;

DROP FUNCTION IF EXISTS current_tenant_id();
