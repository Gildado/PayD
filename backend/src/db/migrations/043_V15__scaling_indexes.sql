-- V15__scaling_indexes.sql
-- Part of #721 and #722 Database Scaling
-- Add indexes to improve pagination and common query performance

-- Create index for cursor-based pagination on created_at (common use case)
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Create index for foreign keys if missing (often overlooked and causes table scans)
CREATE INDEX IF NOT EXISTS idx_transactions_employee_id ON transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_organization_id ON payroll_runs(organization_id);

-- Create composite index for filtering payments by status and date (common in reporting)
CREATE INDEX IF NOT EXISTS idx_transactions_status_date ON transactions(status, created_at DESC);
