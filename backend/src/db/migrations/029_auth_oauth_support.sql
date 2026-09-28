-- Add OAuth support to the existing wallet-based users table

ALTER TABLE users
  ALTER COLUMN wallet_address DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Email should be unique when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users(email)
  WHERE email IS NOT NULL;

-- Create social identities table used by Passport OAuth strategies
CREATE TABLE IF NOT EXISTS social_identities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_social_identities_user_id
  ON social_identities(user_id);
