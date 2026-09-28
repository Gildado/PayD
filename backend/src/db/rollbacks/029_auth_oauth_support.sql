-- Rollback: 022_auth_oauth_support
DROP INDEX IF EXISTS idx_social_identities_user_id;
DROP TABLE IF EXISTS social_identities;

DROP INDEX IF EXISTS idx_users_email_unique;
ALTER TABLE users DROP COLUMN IF EXISTS name;
ALTER TABLE users DROP COLUMN IF EXISTS email;

ALTER TABLE users ALTER COLUMN wallet_address SET NOT NULL;
