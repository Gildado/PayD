-- Rollback for Migration 048: Advanced Admin Audit Log (Issue #696)

DROP INDEX IF EXISTS idx_admin_audit_request_id;
DROP INDEX IF EXISTS idx_admin_audit_severity;
DROP INDEX IF EXISTS idx_admin_audit_actor;
DROP INDEX IF EXISTS idx_admin_audit_resource;
DROP INDEX IF EXISTS idx_admin_audit_action;
DROP INDEX IF EXISTS idx_admin_audit_org_time;

DROP RULE IF EXISTS admin_audit_log_no_delete ON admin_audit_log;
DROP RULE IF EXISTS admin_audit_log_no_update ON admin_audit_log;

DROP TABLE IF EXISTS admin_audit_log;
