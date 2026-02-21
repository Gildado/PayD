-- Create users table for administrative and authentication purposes
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(56) UNIQUE NOT NULL,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  totp_secret VARCHAR(255),
  is_2fa_enabled BOOLEAN DEFAULT FALSE,
  recovery_codes TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on wallet_address
CREATE INDEX idx_users_wallet_address ON users(wallet_address);

-- Apply updated_at trigger
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
