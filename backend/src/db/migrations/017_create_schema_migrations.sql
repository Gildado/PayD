-- =============================================================================
-- Migration 011: Schema Migration Tracking
-- Purpose : Provide idempotent, ordered migration execution with checksum
--           verification so the runner can detect file tampering and skip
--           already-applied migrations in O(1) per lookup.
-- Note    : This file MUST be the first migration executed by the runner,
--           even though it bootstraps the table used to track itself.
--           The runner handles this special case explicitly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  -- Surrogate PK; SERIAL keeps insertion order for free diagnostics.
  id             SERIAL          PRIMARY KEY,

  -- Filename is the canonical identity of a migration (e.g. "007_create_payroll_runs.sql").
  -- UNIQUE ensures each file is recorded exactly once.
  filename       VARCHAR(255)    NOT NULL UNIQUE,

  -- SHA-256 hex digest of the file's content at the time it was applied.
  -- The runner compares this on startup to detect accidental or malicious edits
  -- to already-applied migrations (drift detection).
  checksum       CHAR(64)        NOT NULL,

  -- Wall-clock timestamp of when the migration was applied.
  -- WITH TIME ZONE ensures correctness across server timezone changes.
  applied_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- Database role that applied the migration (useful in shared-DB environments).
  applied_by     VARCHAR(255)    NOT NULL DEFAULT current_user,

  -- How long the migration took, in milliseconds.
  -- NULL means timing was not captured (e.g. legacy migrations backfilled).
  execution_ms   INTEGER         CHECK (execution_ms >= 0)
);

-- Fast lookup: "has this migration been applied?"  O(log n) via B-tree.
CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename
  ON schema_migrations (filename);

-- Chronological audit queries scale at O(log n).
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at
  ON schema_migrations (applied_at DESC);

COMMENT ON TABLE schema_migrations IS
  'Tracks every applied SQL migration file. Managed exclusively by the '
  'TypeScript migration runner (src/db/migrate.ts). Do not edit manually.';

COMMENT ON COLUMN schema_migrations.checksum IS
  'SHA-256 of the migration file content. Runner aborts if an applied '
  'migration file is found to have changed (anti-drift guard).';
