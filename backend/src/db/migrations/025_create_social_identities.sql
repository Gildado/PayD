-- Create social_identities table for OAuth2 social login linking
CREATE TABLE IF NOT EXISTS social_identities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'github')),
  provider_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_id)
);

CREATE INDEX idx_social_identities_user_id ON social_identities(user_id);
CREATE INDEX idx_social_identities_provider ON social_identities(provider);

-- Apply updated_at trigger
CREATE TRIGGER update_social_identities_updated_at BEFORE UPDATE ON social_identities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
