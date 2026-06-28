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
