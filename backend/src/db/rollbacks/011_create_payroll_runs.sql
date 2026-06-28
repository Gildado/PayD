-- Rollback: 007_create_payroll_runs
DROP TRIGGER IF EXISTS update_payroll_items_updated_at ON payroll_items;
DROP TRIGGER IF EXISTS update_payroll_runs_updated_at ON payroll_runs;

DROP INDEX IF EXISTS idx_payroll_items_type;
DROP INDEX IF EXISTS idx_payroll_items_employee_id;
DROP INDEX IF EXISTS idx_payroll_items_run_id;
DROP INDEX IF EXISTS idx_payroll_runs_period;
DROP INDEX IF EXISTS idx_payroll_runs_status;
DROP INDEX IF EXISTS idx_payroll_runs_batch_id;
DROP INDEX IF EXISTS idx_payroll_runs_org_id;

DROP TABLE IF EXISTS payroll_items;
DROP TABLE IF EXISTS payroll_runs;
