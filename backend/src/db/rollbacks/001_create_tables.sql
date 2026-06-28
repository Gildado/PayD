-- Rollback: 001_create_tables
-- Drops all base tables created in the initial schema migration.
-- Order matters: child tables (with FK references) must be dropped before parents.

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;

DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS organizations;

DROP FUNCTION IF EXISTS update_updated_at_column();
