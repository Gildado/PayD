-- Migration: 054_create_invites.sql
-- Adds org-scoped invite tokens required for unknown wallets to self-register.

CREATE TABLE IF NOT EXISTS invites (
  id SERIAL PRIMARY KEY,
  token VARCHAR(128) NOT NULL UNIQUE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL DEFAULT 'EMPLOYEE',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by_wallet_address VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_organization_id ON invites(organization_id);
