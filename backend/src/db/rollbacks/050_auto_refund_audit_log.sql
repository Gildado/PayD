-- Rollback for Migration 050: Auto Refund Audit Log (Issue #600)

DROP INDEX IF EXISTS idx_auto_refund_log_created;
DROP INDEX IF EXISTS idx_auto_refund_log_org;

DROP TABLE IF EXISTS auto_refund_log;
