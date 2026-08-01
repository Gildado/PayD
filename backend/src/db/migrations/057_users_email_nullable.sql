-- Migration 057: Allow NULL email on users
-- Wallet-only accounts (created via invite-token redemption in
-- AuthController.login) never set an email — the JWT payload for those
-- users even sets email: '' explicitly. A pre-existing partial unique index
-- (idx_users_email_unique ... WHERE email IS NOT NULL) already assumed
-- nullable emails, but the column itself still had a NOT NULL constraint,
-- so wallet-only signups failed with a not-null violation.

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
