-- =============================================================================
-- Rollback 037: Undo "Add login lockout tracking columns to users"
-- Pairs with : 037_add_login_lockout_to_users.sql
-- Purpose    : Remove the failed_login_attempts and locked_until columns and
--              the supporting index added by migration 037.
-- Warning    : Running this rollback will permanently delete all lockout state
--              for every user. Confirm no in-flight lockout enforcement relies
--              on these columns before proceeding.
-- =============================================================================

DROP INDEX IF EXISTS idx_users_locked_until;

ALTER TABLE users
  DROP COLUMN IF EXISTS failed_login_attempts,
  DROP COLUMN IF EXISTS locked_until;
