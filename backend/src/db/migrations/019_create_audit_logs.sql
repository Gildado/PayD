-- =============================================================================
-- Migration 013: Unified Audit Logs Table
-- Purpose : Single, append-only ledger for every auditable event in the
--           system: employee changes, payroll runs, wallet operations,
--           admin actions, API calls, and security events.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Enum-like domain tables for entity_type and action
-- (We use CHECK constraints rather than PG ENUMs to allow zero-downtime
--  extension: adding a new entity_type only requires adding a value to the
--  CHECK list in a new migration, not an ALTER TYPE which briefly locks.)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log_entity_types (
  entity_type  VARCHAR(50) PRIMARY KEY
);

INSERT INTO audit_log_entity_types (entity_type) VALUES
  ('organization'),
  ('employee'),
  ('wallet'),
  ('payroll_run'),
  ('payroll_item'),
  ('transaction'),
  ('tax_rule'),
  ('tax_report'),
  ('user'),
  ('trustline'),
  ('freeze'),
  ('clawback'),
  ('multisig'),
  ('tenant_config'),
  ('auth')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_log_actions (
  action  VARCHAR(100) PRIMARY KEY
);

INSERT INTO audit_log_actions (action) VALUES
  -- Lifecycle
  ('created'), ('updated'), ('deleted'), ('restored'),
  -- Auth
  ('login'), ('logout'), ('token_refreshed'), ('2fa_enabled'), ('2fa_disabled'),
  ('password_changed'), ('session_expired'),
  -- Payroll
  ('payroll_draft_created'), ('payroll_submitted'), ('payroll_approved'),
  ('payroll_rejected'), ('payroll_processing'), ('payroll_completed'),
  ('payroll_failed'), ('payroll_item_added'), ('payroll_item_removed'),
  -- Transactions
  ('tx_submitted'), ('tx_confirmed'), ('tx_failed'), ('tx_refunded'),
  -- Wallets
  ('wallet_synced'), ('wallet_frozen'), ('wallet_unfrozen'),
  ('wallet_activated'), ('wallet_deactivated'),
  -- Trustlines
  ('trustline_created'), ('trustline_established'), ('trustline_revoked'),
  -- Clawback
  ('clawback_initiated'), ('clawback_completed'), ('clawback_failed'),
  -- Admin
  ('admin_override'), ('config_changed'), ('role_assigned'), ('role_revoked'),
  -- Security
  ('suspicious_activity'), ('rate_limit_exceeded'), ('unauthorized_access')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Core audit_logs table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  -- BIGSERIAL supports ~9.2 × 10^18 rows before overflow.
  id               BIGSERIAL       PRIMARY KEY,

  -- Tenant scope. ON DELETE SET NULL so audit history survives org deletion.
  organization_id  INTEGER
                     REFERENCES organizations(id) ON DELETE SET NULL,

  -- What kind of entity was acted upon (employee, wallet, payroll_run, …).
  -- FK to audit_log_entity_types ensures controlled vocabulary.
  entity_type      VARCHAR(50)     NOT NULL
                     REFERENCES audit_log_entity_types(entity_type),

  -- Flexible ID of the affected entity. VARCHAR to accommodate UUID, INTEGER,
  -- or composite keys serialised as strings without schema coupling.
  entity_id        VARCHAR(255)    NOT NULL,

  -- What happened (created, updated, wallet_frozen, …).
  action           VARCHAR(100)    NOT NULL
                     REFERENCES audit_log_actions(action),

  -- Who triggered the action.
  actor_type       VARCHAR(20)     NOT NULL DEFAULT 'system'
                     CHECK (actor_type IN ('system', 'user', 'api', 'cron', 'webhook')),
  actor_id         VARCHAR(255),           -- user.id or service identifier
  actor_email      VARCHAR(255),           -- denormalised for readability in reports
  actor_ip         INET,                   -- INET validates & indexes IP ranges efficiently

  -- State snapshot before the change. NULL for create events.
  old_values       JSONB,

  -- State snapshot after the change. NULL for delete events.
  new_values       JSONB,

  -- Arbitrary extra context (request IDs, Stellar ledger numbers, etc.).
  metadata         JSONB           NOT NULL DEFAULT '{}',

  -- Severity enables alerting rules: anything 'warn' or above can be
  -- routed to a SIEM or PagerDuty without modifying application code.
  severity         VARCHAR(10)     NOT NULL DEFAULT 'info'
                     CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical')),

  -- Immutable creation timestamp. WITH TIME ZONE is mandatory for
  -- distributed / containerised deployments where TZ can differ.
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()

  -- NO updated_at — audit logs are write-once, read-many.
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Primary access pattern: "show me the audit trail for org X"
-- O(log n); covers the org-scoped list endpoint.
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id
  ON audit_logs (organization_id, created_at DESC);

-- Entity drill-down: "what happened to employee 42?"
-- Composite (entity_type, entity_id) → O(log n) for any entity type.
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs (entity_type, entity_id, created_at DESC);

-- Security dashboards: filter by action across the whole system.
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs (action, created_at DESC);

-- Actor trail: "what did user X do?"
-- Partial index excludes system events (actor_type='system') which are
-- never queried by actor_id, keeping the index small.
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs (actor_type, actor_id, created_at DESC)
  WHERE actor_type IN ('user', 'api', 'webhook');

-- IP investigation: "all events from this IP/subnet"
-- INET supports WHERE actor_ip << '10.0.0.0/8' subnet queries.
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_ip
  ON audit_logs USING GIST (actor_ip)
  WHERE actor_ip IS NOT NULL;

-- Severity alerting: quickly count critical events in rolling window.
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity
  ON audit_logs (severity, created_at DESC)
  WHERE severity IN ('warn', 'error', 'critical');

-- BRIN on monotonically-increasing created_at:
--   • Build cost: O(n / pages_per_range) — much cheaper than B-tree.
--   • Size: ~1,000× smaller than a B-tree on the same column.
--   • Effective for time-range scans which are the dominant query pattern.
--   pages_per_range=128 is a good default for ~1M rows/day write rate.
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_brin
  ON audit_logs USING BRIN (created_at)
  WITH (pages_per_range = 128);

-- GIN index on metadata JSONB for ad-hoc key/value filters.
-- e.g. WHERE metadata @> '{"stellar_ledger": 12345}'
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin
  ON audit_logs USING GIN (metadata);

-- GIN on new_values for diff queries without full-table scans.
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_values_gin
  ON audit_logs USING GIN (new_values)
  WHERE new_values IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Row-Level Security: read-only for application role; append-only enforced
-- ---------------------------------------------------------------------------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Application can read audit logs for its own organization.
CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT
  USING (
    organization_id IS NULL              -- system-wide events
    OR organization_id = current_tenant_id()
  );

-- Application can insert new audit events for its own organization.
CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT
  WITH CHECK (
    organization_id IS NULL
    OR organization_id = current_tenant_id()
  );

-- Explicitly NO UPDATE or DELETE policies → immutable at the DB layer.

-- ---------------------------------------------------------------------------
-- Convenience view: recent security events (last 7 days, severity >= warn)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW recent_security_events AS
SELECT
  al.id,
  o.name        AS organization_name,
  al.entity_type,
  al.entity_id,
  al.action,
  al.actor_type,
  al.actor_email,
  al.actor_ip,
  al.severity,
  al.metadata,
  al.created_at
FROM   audit_logs    al
LEFT   JOIN organizations o ON o.id = al.organization_id
WHERE  al.severity   IN ('warn', 'error', 'critical')
  AND  al.created_at >= NOW() - INTERVAL '7 days'
ORDER  BY al.created_at DESC;

-- ---------------------------------------------------------------------------
-- Helper function: append an audit event
-- Centralises the INSERT so application code never has to reference the
-- table directly, making future schema changes easier to apply.
-- Time complexity: O(log n) amortised — one B-tree index insert + BRIN update.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_audit_event(
  p_organization_id  INTEGER,
  p_entity_type      VARCHAR(50),
  p_entity_id        VARCHAR(255),
  p_action           VARCHAR(100),
  p_actor_type       VARCHAR(20)   DEFAULT 'system',
  p_actor_id         VARCHAR(255)  DEFAULT NULL,
  p_actor_email      VARCHAR(255)  DEFAULT NULL,
  p_actor_ip         INET          DEFAULT NULL,
  p_old_values       JSONB         DEFAULT NULL,
  p_new_values       JSONB         DEFAULT NULL,
  p_metadata         JSONB         DEFAULT '{}',
  p_severity         VARCHAR(10)   DEFAULT 'info'
)
RETURNS BIGINT AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO audit_logs (
    organization_id, entity_type, entity_id, action,
    actor_type, actor_id, actor_email, actor_ip,
    old_values, new_values, metadata, severity
  )
  VALUES (
    p_organization_id, p_entity_type, p_entity_id, p_action,
    p_actor_type, p_actor_id, p_actor_email, p_actor_ip,
    p_old_values, p_new_values, p_metadata, p_severity
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE audit_logs IS
  'Append-only, immutable ledger of every auditable event in the system. '
  'Rows are never updated or deleted. Partition by RANGE(created_at) monthly '
  'once the table exceeds ~50M rows.';

COMMENT ON COLUMN audit_logs.entity_id IS
  'String representation of the affected entity primary key. '
  'Accepts both integer IDs (e.g. "42") and UUIDs for wallet events.';

COMMENT ON COLUMN audit_logs.actor_ip IS
  'Client IP address using PostgreSQL native INET type. '
  'Supports GIST-indexed subnet queries: WHERE actor_ip << ''10.0.0.0/8''.';

COMMENT ON COLUMN audit_logs.metadata IS
  'Arbitrary key-value context (Stellar ledger, batch_id, request_id, …). '
  'GIN-indexed for fast @> containment queries.';

COMMENT ON FUNCTION log_audit_event IS
  'Convenience wrapper for INSERT INTO audit_logs. Use this function from '
  'application code to insulate callers from schema evolution.';
