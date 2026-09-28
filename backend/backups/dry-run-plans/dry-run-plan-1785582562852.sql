-- Dry-run migration plan generated 2026-08-01T11:09:22.851Z
-- 7 pending migration(s) would run, in this exact order.
-- Nothing has been executed. Review before applying with: npm run db:migrate

-- ===== 050_auto_refund_audit_log.sql  (checksum 6dba261bbcd43ec248d6915638739debf8430b4910b36651faa495040e3128f0) =====
-- Migration: 050_auto_refund_audit_log
-- Issue #600: Track automatic distribution account re-funding events

CREATE TABLE IF NOT EXISTS auto_refund_log (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    distribution_account VARCHAR(56) NOT NULL,
    funding_source  VARCHAR(56) NOT NULL,
    asset_code      VARCHAR(12) NOT NULL,
    amount          NUMERIC(20,7) NOT NULL,
    balance_before  NUMERIC(20,7) NOT NULL,
    balance_after   NUMERIC(20,7) NOT NULL,
    tx_hash         VARCHAR(128),
    status          VARCHAR(20) NOT NULL DEFAULT 'completed',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auto_refund_log_org ON auto_refund_log(organization_id);
CREATE INDEX idx_auto_refund_log_created ON auto_refund_log(created_at);


-- ===== 051_batch_archive_tracking.sql  (checksum 8d783f72275b2f66e5c90eda54a6bd3f28b6cbfbc6dc6b5bcff265291764b70f) =====
-- Migration: 051_batch_archive_tracking
-- Issue #599: Track archived batch status maps for off-chain querying

CREATE TABLE IF NOT EXISTS batch_archive (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    batch_id        BIGINT NOT NULL,
    payment_count   INTEGER NOT NULL,
    success_count   INTEGER NOT NULL DEFAULT 0,
    fail_count      INTEGER NOT NULL DEFAULT 0,
    total_sent      NUMERIC(20,7) NOT NULL DEFAULT 0,
    asset_code      VARCHAR(12) NOT NULL,
    status_data     BYTEA,
    archived_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_batch_archive_batch_id ON batch_archive(organization_id, batch_id);
CREATE INDEX idx_batch_archive_org ON batch_archive(organization_id);
CREATE INDEX idx_batch_archive_date ON batch_archive(archived_at);


-- ===== 052_api_database_scaling_part23.sql  (checksum 9e15b887baf080c6f691d37347911029fadaf6e3b171f04f2198be147ce80fdb) =====
-- =============================================================================
-- Migration 052: API & Database Scaling – Part 23
-- Purpose : Add composite / partial indexes that accelerate the highest-traffic
--           dashboard query paths:
--             * Payroll run lists filtered by organization + status, newest-first
--               (BulkPaymentStatusTracker, payroll dashboards).
--             * Fast lookup of failed payroll items for the retry flow.
--           These are read-path optimizations only — no schema or data changes.
--           Closes Issue #713 – API & Database Scaling Part 23 (ref #268).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Payroll runs: org + status + recency
--    Backs the default "runs for my org, newest first, filtered by status"
--    query used by the bulk-payment status tracker and payroll dashboards.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payroll_runs_org_status_created
  ON payroll_runs (organization_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Payroll items: failed-item fast path
--    Partial index so the "retry failed payments" flow can locate failed items
--    for a run without scanning completed/pending rows.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payroll_items_failed
  ON payroll_items (payroll_run_id)
  WHERE status = 'failed';

-- ---------------------------------------------------------------------------
-- 3. Comments
-- ---------------------------------------------------------------------------

COMMENT ON INDEX idx_payroll_runs_org_status_created IS
  'Covers org-scoped, status-filtered, newest-first payroll run listings.';
COMMENT ON INDEX idx_payroll_items_failed IS
  'Partial index over failed payroll items, used by the payment retry flow.';


-- ===== 053_add_email_verification.sql  (checksum e939006407c744fc2145c26d8e7a42af4daf7aae41106e6740dc16818ff4f3d5) =====
-- Add email verification fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_token VARCHAR(128),
  ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);


-- ===== 054_create_invites.sql  (checksum 24d83a25a84184b5c4a7eccac186272f0b020331b42080fe54fe10b7c43dc3ab) =====
﻿-- Migration: 054_create_invites.sql
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


-- ===== 055_create_migration_run_log.sql  (checksum 606ae918992d97a03d3a7030c4a7fd59aec351a89b8b09968af16cd764d9dadf) =====
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


-- ===== 056_email_delivery_tracking.sql  (checksum 62731dcf0c3aff2a8f86afc93e9bf5d6fa14b3b2e321e999b4ad63fb6333ffbb) =====
-- Migration 056: Email Delivery Tracking Tables (#1050)
-- Note: renumbered from 050 -> 056 to resolve a duplicate numeric prefix with
-- 050_auto_refund_audit_log.sql (both files were previously named "050_"),
-- which broke the migration runner's duplicate-prefix guard. See Issue #1039.

-- Email delivery logs table
CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('sendgrid', 'resend')),
  bounce_type TEXT CHECK (bounce_type IN ('hard', 'soft')),
  bounce_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  retry_scheduled_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_message_id ON email_delivery_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_email ON email_delivery_logs(email);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status ON email_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_created_at ON email_delivery_logs(created_at DESC);

-- Invalid emails table
CREATE TABLE IF NOT EXISTS invalid_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  flagged_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invalid_emails_email ON invalid_emails(email);

-- Add email_status and email_invalid_reason to employees table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'employees' AND column_name = 'email_status') THEN
    ALTER TABLE employees ADD COLUMN email_status TEXT DEFAULT 'valid' CHECK (email_status IN ('valid', 'invalid'));
    ALTER TABLE employees ADD COLUMN email_invalid_reason TEXT;
  END IF;
END $$;

COMMENT ON TABLE email_delivery_logs IS 'Tracks email delivery status and events from email providers';
COMMENT ON TABLE invalid_emails IS 'List of invalid email addresses flagged due to hard bounces';

