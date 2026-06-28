-- Rollback for Migration 045: Add Performance Bonus Fields to Payroll Items

DROP INDEX IF EXISTS idx_payroll_items_performance_score;
DROP INDEX IF EXISTS idx_payroll_items_bonus_type;

ALTER TABLE payroll_items DROP COLUMN IF EXISTS performance_score;
ALTER TABLE payroll_items DROP COLUMN IF EXISTS bonus_type;
