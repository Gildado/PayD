-- Migration to add roles and refresh token support to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'EMPLOYEE' CHECK (role IN ('EMPLOYER', 'EMPLOYEE'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT;

-- Add public_key to organizations for Stellar integration and data isolation
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS public_key VARCHAR(56);
CREATE INDEX IF NOT EXISTS idx_organizations_public_key ON organizations(public_key);
