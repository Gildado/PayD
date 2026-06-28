-- Rollback for Migration 052: API & Database Scaling – Part 23

DROP INDEX IF EXISTS idx_payroll_items_failed;
DROP INDEX IF EXISTS idx_payroll_runs_org_status_created;
