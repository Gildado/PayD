-- =============================================================================
-- Migration 028: Add issuer_account to organizations
-- Purpose : Store the Stellar issuer account address on the organization
--           so it can be audited when changed.
-- =============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS issuer_account VARCHAR(56);
