-- =============================================================================
-- Migration 055: Migration Run Log
-- Purpose : Persist an audit trail of every migration EXECUTION ATTEMPT (not
--           just successful applies) so operators can see failures, dry-runs,
--           backup status, and post-migration verification results.
--           Closes Issue #1039 – Database migration safety checks and rollback
--           scripts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS migration_run_log (
  id                  BIGSERIAL    PRIMARY KEY,
  filename            VARCHAR(255) NOT NULL,
  run_status          VARCHAR(20)  NOT NULL
                       CHECK (run_status IN ('success', 'failure', 'dry_run')),
  started_at          TIMESTAMPTZ  NOT NULL,
  finished_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  execution_ms        INTEGER      CHECK (execution_ms >= 0),
  backup_taken        BOOLEAN      NOT NULL DEFAULT FALSE,
  backup_path         TEXT,
  verification_passed BOOLEAN,
  verification_issues JSONB,
  error_message       TEXT,
  rollback_attempted  BOOLEAN      NOT NULL DEFAULT FALSE,
  rollback_succeeded  BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_migration_run_log_filename
  ON migration_run_log (filename);

CREATE INDEX IF NOT EXISTS idx_migration_run_log_status_time
  ON migration_run_log (run_status, finished_at DESC);

COMMENT ON TABLE migration_run_log IS
  'Audit trail of every migration execution attempt (success, failure, or dry-run), including backup and post-migration verification outcomes.';
COMMENT ON COLUMN migration_run_log.run_status IS
  'Outcome of this migration attempt: success, failure, or dry_run (planning only, nothing executed).';
COMMENT ON COLUMN migration_run_log.backup_taken IS
  'Whether a pg_dump backup was successfully captured before this migration ran.';
COMMENT ON COLUMN migration_run_log.verification_passed IS
  'Whether the post-migration schema verification query passed (NULL if not run, e.g. dry-run).';
COMMENT ON COLUMN migration_run_log.rollback_attempted IS
  'Whether the runner automatically attempted to execute the matching rollback script after a failure.';
