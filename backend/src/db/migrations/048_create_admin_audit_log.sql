-- =============================================================================
-- Migration 048: Advanced Admin Audit Log (Issue #696)
-- Purpose : Append-only table that records every action performed by admin
--           users across the entire platform — employee management, payment
--           approvals, asset operations, config changes, and more.
--           Supersedes the narrower org_audit_log (migration 035) for
--           cross-resource admin-level event tracking.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enum-style constants (stored as VARCHAR for flexibility)
--    action_type examples:
--      employee_created, employee_updated, employee_deleted,
--      payment_approved, payment_rejected, payment_sent,
--      asset_issued, asset_frozen, asset_unfrozen, asset_clawback,
--      user_invited, user_deactivated, user_role_changed,
--      config_updated, payroll_run_started, payroll_run_completed,
--      organization_created, organization_deleted, org_setting_changed,
--      bulk_payment_queued, trustline_authorized, trustline_revoked
--    severity: info | warning | critical
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id              BIGSERIAL PRIMARY KEY,

  -- Tenant scope (required — every action belongs to an org)
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- What happened
  action_type     VARCHAR(80)  NOT NULL,

  -- What kind of resource was affected (e.g. "employee", "payment", "asset")
  resource_type   VARCHAR(50)  NOT NULL,

  -- Primary key of the affected resource (nullable for bulk / list operations)
  resource_id     VARCHAR(100),

  -- JSON snapshots for diff-style auditing (nullable when N/A)
  old_state       JSONB,
  new_state       JSONB,

  -- Who performed the action
  actor_id        INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  actor_email     VARCHAR(255),
  actor_ip        INET,
  user_agent      TEXT,

  -- Correlate with request logs
  request_id      VARCHAR(64),

  -- Severity level: info | warning | critical
  severity        VARCHAR(20)  NOT NULL DEFAULT 'info'
                               CHECK (severity IN ('info', 'warning', 'critical')),

  -- Arbitrary extra context (e.g. stellar tx hash, bulk job id)
  metadata        JSONB,

  -- Immutable timestamp
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. Append-only enforcement — prevent UPDATE / DELETE
-- ---------------------------------------------------------------------------
CREATE RULE admin_audit_log_no_update
  AS ON UPDATE TO admin_audit_log DO INSTEAD NOTHING;

CREATE RULE admin_audit_log_no_delete
  AS ON DELETE TO admin_audit_log DO INSTEAD NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Indexes for the most common query patterns
-- ---------------------------------------------------------------------------
-- Primary lookup: all events for an org, newest-first
CREATE INDEX IF NOT EXISTS idx_admin_audit_org_time
  ON admin_audit_log (organization_id, created_at DESC);

-- Filter by action type within an org
CREATE INDEX IF NOT EXISTS idx_admin_audit_action
  ON admin_audit_log (organization_id, action_type, created_at DESC);

-- Filter by resource type within an org
CREATE INDEX IF NOT EXISTS idx_admin_audit_resource
  ON admin_audit_log (organization_id, resource_type, created_at DESC);

-- Filter by actor within an org
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor
  ON admin_audit_log (organization_id, actor_id, created_at DESC);

-- Filter by severity (e.g. "show me all critical events")
CREATE INDEX IF NOT EXISTS idx_admin_audit_severity
  ON admin_audit_log (organization_id, severity, created_at DESC);

-- Correlate with request logs
CREATE INDEX IF NOT EXISTS idx_admin_audit_request_id
  ON admin_audit_log (request_id)
  WHERE request_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE  admin_audit_log IS
  'Append-only log of every administrative action across the PayD platform.';
COMMENT ON COLUMN admin_audit_log.action_type IS
  'Machine-readable verb describing the action, e.g. employee_created, payment_approved.';
COMMENT ON COLUMN admin_audit_log.resource_type IS
  'Kind of entity the action targeted, e.g. employee, payment, asset, config.';
COMMENT ON COLUMN admin_audit_log.severity IS
  'Importance level: info (routine), warning (unusual), critical (security-relevant).';
COMMENT ON COLUMN admin_audit_log.old_state IS
  'JSON snapshot of the resource before the action (null for creates).';
COMMENT ON COLUMN admin_audit_log.new_state IS
  'JSON snapshot of the resource after the action (null for deletes).';
