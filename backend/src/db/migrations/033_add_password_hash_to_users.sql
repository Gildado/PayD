-- Migration 026: Add password_hash to users
-- Supports email+password organization account creation alongside
-- the existing wallet-based authentication flow.
-- The column is nullable so existing wallet-only users are unaffected.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN users.password_hash IS
  'Scrypt-hashed password for email+password org admin accounts. '
  'NULL for wallet-only users. Format: <salt_hex>:<hash_hex>';
