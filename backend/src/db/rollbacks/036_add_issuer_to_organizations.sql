-- =============================================================================
-- Rollback 036: Undo "Add issuer_account to organizations"
-- Pairs with : 036_add_issuer_to_organizations.sql
-- Purpose    : Drop the issuer_account column from the organizations table,
--              reversing migration 036 cleanly.
-- Warning    : Running this rollback will permanently delete all stored
--              issuer_account values. Ensure data is backed up if needed.
-- =============================================================================

ALTER TABLE organizations
  DROP COLUMN IF EXISTS issuer_account;
