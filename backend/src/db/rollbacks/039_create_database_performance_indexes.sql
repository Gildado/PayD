-- Rollback migration 039: Remove database performance indexes

DROP INDEX IF EXISTS idx_employees_org_id_status;
DROP INDEX IF EXISTS idx_payroll_runs_org_date;
DROP INDEX IF EXISTS idx_transactions_org_status_created;
DROP INDEX IF EXISTS idx_payments_org_status;
DROP INDEX IF EXISTS idx_audit_logs_created_at;
DROP INDEX IF EXISTS idx_org_config_org_key;
DROP INDEX IF EXISTS idx_webhook_subscriptions_org_event;
DROP INDEX IF EXISTS idx_notifications_user_read;
DROP INDEX IF EXISTS idx_payroll_audit_run_id;
DROP INDEX IF EXISTS idx_contract_registry_org;
DROP INDEX IF EXISTS idx_bulk_payment_batches_org;
DROP INDEX IF EXISTS idx_employees_search_vector;
DROP INDEX IF EXISTS idx_transactions_search_vector;
