-- Rollback: 005_auth_rbac_updates
DROP INDEX IF EXISTS idx_organizations_public_key;
ALTER TABLE organizations DROP COLUMN IF EXISTS public_key;
ALTER TABLE users DROP COLUMN IF EXISTS refresh_token;
ALTER TABLE users DROP COLUMN IF EXISTS role;
