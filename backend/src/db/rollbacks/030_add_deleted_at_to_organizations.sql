-- Rollback: 023_add_deleted_at_to_organizations
DROP INDEX IF EXISTS idx_organizations_deleted_at;
ALTER TABLE organizations DROP COLUMN IF EXISTS deleted_at;
