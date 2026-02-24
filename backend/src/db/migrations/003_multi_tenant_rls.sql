-- Migration 003: Multi-tenant Row-Level Security (RLS)
-- This migration implements strict data isolation between organizations using PostgreSQL RLS

-- Enable Row Level Security on all tenant-scoped tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create a function to get the current tenant ID from session
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS INTEGER AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', TRUE), '')::INTEGER;
$$ LANGUAGE SQL STABLE;

-- RLS Policies for employees table
-- Policy: Users can only see employees from their organization
CREATE POLICY tenant_isolation_employees_select ON employees
  FOR SELECT
  USING (organization_id = current_tenant_id());

-- Policy: Users can only insert employees into their organization
CREATE POLICY tenant_isolation_employees_insert ON employees
  FOR INSERT
  WITH CHECK (organization_id = current_tenant_id());

-- Policy: Users can only update employees from their organization
CREATE POLICY tenant_isolation_employees_update ON employees
  FOR UPDATE
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

-- Policy: Users can only delete employees from their organization
CREATE POLICY tenant_isolation_employees_delete ON employees
  FOR DELETE
  USING (organization_id = current_tenant_id());

-- RLS Policies for transactions table
-- Policy: Users can only see transactions from their organization
CREATE POLICY tenant_isolation_transactions_select ON transactions
  FOR SELECT
  USING (organization_id = current_tenant_id());

-- Policy: Users can only insert transactions into their organization
CREATE POLICY tenant_isolation_transactions_insert ON transactions
  FOR INSERT
  WITH CHECK (organization_id = current_tenant_id());

-- Policy: Users can only update transactions from their organization
CREATE POLICY tenant_isolation_transactions_update ON transactions
  FOR UPDATE
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

-- Policy: Users can only delete transactions from their organization
CREATE POLICY tenant_isolation_transactions_delete ON transactions
  FOR DELETE
  USING (organization_id = current_tenant_id());

-- Add tenant_id column to organizations for consistency (self-referential)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE organizations SET tenant_id = id WHERE tenant_id IS NULL;

-- Create index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_organizations_tenant_id ON organizations(tenant_id);

-- Add constraint to ensure organization_id matches in related tables
-- This provides an additional layer of protection at the database level
CREATE OR REPLACE FUNCTION validate_tenant_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- For employees, ensure the organization exists
  IF TG_TABLE_NAME = 'employees' THEN
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = NEW.organization_id) THEN
      RAISE EXCEPTION 'Invalid organization_id: %', NEW.organization_id;
    END IF;
  END IF;
  
  -- For transactions, ensure both organization and employee (if set) belong to same org
  IF TG_TABLE_NAME = 'transactions' THEN
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = NEW.organization_id) THEN
      RAISE EXCEPTION 'Invalid organization_id: %', NEW.organization_id;
    END IF;
    
    IF NEW.employee_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM employees 
        WHERE id = NEW.employee_id 
        AND organization_id = NEW.organization_id
      ) THEN
        RAISE EXCEPTION 'Employee % does not belong to organization %', 
          NEW.employee_id, NEW.organization_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply validation triggers
DROP TRIGGER IF EXISTS validate_employee_tenant ON employees;
CREATE TRIGGER validate_employee_tenant
  BEFORE INSERT OR UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION validate_tenant_consistency();

DROP TRIGGER IF EXISTS validate_transaction_tenant ON transactions;
CREATE TRIGGER validate_transaction_tenant
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION validate_tenant_consistency();

-- Create a view for tenant-specific statistics (optional, for monitoring)
CREATE OR REPLACE VIEW tenant_statistics AS
SELECT 
  o.id as organization_id,
  o.name as organization_name,
  COUNT(DISTINCT e.id) as employee_count,
  COUNT(DISTINCT t.id) as transaction_count,
  COALESCE(SUM(t.amount), 0) as total_transaction_amount,
  o.created_at as organization_created_at
FROM organizations o
LEFT JOIN employees e ON e.organization_id = o.id
LEFT JOIN transactions t ON t.organization_id = o.id
GROUP BY o.id, o.name, o.created_at;

-- Grant appropriate permissions (adjust based on your user roles)
-- GRANT SELECT ON tenant_statistics TO app_user;

COMMENT ON FUNCTION current_tenant_id() IS 'Returns the current tenant ID from session variable app.current_tenant_id';
COMMENT ON POLICY tenant_isolation_employees_select ON employees IS 'RLS: Isolate employee data by organization';
COMMENT ON POLICY tenant_isolation_transactions_select ON transactions IS 'RLS: Isolate transaction data by organization';
