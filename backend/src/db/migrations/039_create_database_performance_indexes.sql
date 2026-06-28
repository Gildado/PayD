-- =============================================================================
-- Migration 039: Database Performance Indexes
-- Purpose : Add performance-optimizing indexes for common query patterns
--           to support API & Database Scaling.
-- =============================================================================

-- Index for organization lookups on employees
CREATE INDEX IF NOT EXISTS idx_employees_org_id_status
  ON employees (organization_id, status);

-- Composite index for payroll queries by organization and date
CREATE INDEX IF NOT EXISTS idx_payroll_runs_org_date
  ON payroll_runs (organization_id, created_at DESC);

-- Index for transaction queries by organization and status
CREATE INDEX IF NOT EXISTS idx_transactions_org_status_created
  ON transactions (organization_id, status, created_at DESC);

-- Index for payment operations
CREATE INDEX IF NOT EXISTS idx_payments_org_status
  ON transactions (organization_id, transaction_type, status);

-- Index for rate limiting and throttling logs cleanup
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON transaction_audit_logs (created_at DESC);

-- Index for organization settings lookups
CREATE INDEX IF NOT EXISTS idx_org_config_org_key
  ON tenant_configurations (organization_id, config_key);

-- Index for webhook subscription lookups
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org_event
  ON webhook_subscriptions (organization_id, events);

-- Index for notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (employee_id, status, created_at DESC);

-- Index for payroll audit queries
CREATE INDEX IF NOT EXISTS idx_payroll_audit_run_id
  ON payroll_audit_logs (payroll_run_id);



-- Index for bulk payment batches
CREATE INDEX IF NOT EXISTS idx_bulk_payment_batches_org
  ON bulk_payment_batches (organization_id, status, created_at DESC);

-- Index for employee search vector (full-text search performance)
CREATE INDEX IF NOT EXISTS idx_employees_search_vector
  ON employees USING gin (search_vector);

-- Index for transaction search vector (full-text search performance)
CREATE INDEX IF NOT EXISTS idx_transactions_search_vector
  ON transactions USING gin (search_vector);
