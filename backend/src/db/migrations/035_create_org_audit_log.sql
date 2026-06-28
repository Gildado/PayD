-- =============================================================================
-- Migration 027: Organization Audit Log
-- Purpose : Dedicated, append-only table that records every change made to an
--           organization's name, settings (tenant_configurations), or issuer
--           account.  Kept separate from the generic audit_logs table so that
--           compliance queries targeting org-level data stay fast and clear.
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_audit_log (
  id              BIGSERIAL PRIMARY KEY,

  -- Which organization was changed
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- What kind of change occurred
  -- Allowed values: 'name_updated' | 'setting_upserted' | 'setting_deleted'
  --                 | 'issuer_updated' | 'org_created' | 'org_deleted'
  change_type     VARCHAR(50) NOT NULL,

  -- The config key that was changed (NULL for name / issuer changes)
  config_key      VARCHAR(100),

  -- JSON snapshots of the value before and after the change
  old_value       JSONB,
  new_value       JSONB,

  -- Who made the change
  actor_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_email     VARCHAR(255),
  actor_ip        INET,

  -- When the change happened (immutable)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce append-only semantics: no UPDATE or DELETE on existing rows
CREATE RULE org_audit_log_no_update AS ON UPDATE TO org_audit_log DO INSTEAD NOTHING;
CREATE RULE org_audit_log_no_delete AS ON DELETE TO org_audit_log DO INSTEAD NOTHING;

-- Index for the most common query patterns
CREATE INDEX IF NOT EXISTS idx_org_audit_log_org       ON org_audit_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_audit_log_actor     ON org_audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_audit_log_type      ON org_audit_log (change_type, created_at DESC);

COMMENT ON TABLE  org_audit_log IS
  'Append-only log of every change made to an organization''s name, settings, or issuer account.';
COMMENT ON COLUMN org_audit_log.change_type IS
  'Classifies the kind of change: name_updated, setting_upserted, setting_deleted, issuer_updated, org_created, org_deleted.';
COMMENT ON COLUMN org_audit_log.config_key IS
  'The tenant_configurations key that was changed; NULL for name/issuer changes.';
