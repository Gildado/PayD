-- =============================================================================
-- Migration 044: Migration Rollback Audit Log
-- Purpose : Persist a rollback event log so operators can track which
--           migrations were rolled back, when, and by whom.
--           Closes Issue #698 – Implement Database Migration Rollback Strategy.
-- =============================================================================

CREATE TABLE IF NOT EXISTS migration_rollback_log (
  id              BIGSERIAL    PRIMARY KEY,
  filename        VARCHAR(255) NOT NULL,
  rolled_back_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  rolled_back_by  VARCHAR(255) NOT NULL DEFAULT current_user,
  reason          TEXT,
  execution_ms    INTEGER      CHECK (execution_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_migration_rollback_log_filename
  ON migration_rollback_log (filename);

CREATE INDEX IF NOT EXISTS idx_migration_rollback_log_ts
  ON migration_rollback_log (rolled_back_at DESC);

COMMENT ON TABLE migration_rollback_log IS
  'Immutable audit log of every database migration rollback event.';
