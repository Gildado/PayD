-- Rollback: 013_create_audit_logs
DROP FUNCTION IF EXISTS log_audit_event(TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT);
DROP VIEW IF EXISTS recent_security_events;

DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS idx_audit_logs_new_values_gin;
DROP INDEX IF EXISTS idx_audit_logs_metadata_gin;
DROP INDEX IF EXISTS idx_audit_logs_created_at_brin;
DROP INDEX IF EXISTS idx_audit_logs_severity;
DROP INDEX IF EXISTS idx_audit_logs_actor_ip;
DROP INDEX IF EXISTS idx_audit_logs_actor;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_entity;
DROP INDEX IF EXISTS idx_audit_logs_org_id;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS audit_log_actions;
DROP TABLE IF EXISTS audit_log_entity_types;
