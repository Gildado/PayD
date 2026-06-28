-- Rollback: 005_create_employee_trustlines
DROP INDEX IF EXISTS idx_employee_trustlines_status;
DROP INDEX IF EXISTS idx_employee_trustlines_wallet;
DROP INDEX IF EXISTS idx_employee_trustlines_employee_asset;
DROP TABLE IF EXISTS employee_trustlines;
