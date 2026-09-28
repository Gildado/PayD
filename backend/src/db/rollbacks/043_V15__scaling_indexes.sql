-- Rollback for Migration 043 (V15__scaling_indexes): Part of #721 and #722 Database Scaling
-- Drops the indexes introduced by the forward migration.

DROP INDEX IF EXISTS idx_payments_status_date;
DROP INDEX IF EXISTS idx_payroll_runs_organization_id;
DROP INDEX IF EXISTS idx_payments_employee_id;
DROP INDEX IF EXISTS idx_payments_created_at;
DROP INDEX IF EXISTS idx_employees_created_at;
