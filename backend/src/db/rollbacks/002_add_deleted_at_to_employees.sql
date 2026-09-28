-- Rollback: 002_add_deleted_at_to_employees
DROP INDEX IF EXISTS idx_employees_deleted_at;
ALTER TABLE employees DROP COLUMN IF EXISTS deleted_at;
