-- =============================================================================
-- Migration 029: Add login lockout tracking columns to users
-- Purpose : Track consecutive failed login / 2FA attempts per user so the
--           application can enforce a temporary lockout after repeated failures
--           without relying solely on Redis (persists across restarts).
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_locked_until
  ON users (locked_until)
  WHERE locked_until IS NOT NULL;
