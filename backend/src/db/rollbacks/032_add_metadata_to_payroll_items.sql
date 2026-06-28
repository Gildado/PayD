-- Rollback: 025_add_metadata_to_payroll_items
ALTER TABLE payroll_items DROP COLUMN IF EXISTS metadata;
