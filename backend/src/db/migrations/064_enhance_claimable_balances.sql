-- Migration 064: Enhance claimable_balances with predicate tracking and reclaim flow
-- Adds predicate tracking for conditional claims and audit trail for reclaims

ALTER TABLE claimable_balances
ADD COLUMN IF NOT EXISTS predicate_type VARCHAR(50) DEFAULT 'unconditional' CHECK (predicate_type IN ('unconditional', 'predicate_time', 'predicate_before_relative_time')),
ADD COLUMN IF NOT EXISTS predicate_data JSONB,
ADD COLUMN IF NOT EXISTS expiry_notification_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS reclaimed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS reclaim_reason TEXT;

-- Index for efficient querying of expiring balances
CREATE INDEX IF NOT EXISTS idx_claimable_balances_expires_at_status 
  ON claimable_balances(organization_id, status, expires_at) 
  WHERE status IN ('pending', 'claimed');

-- Index for finding balances approaching expiry
CREATE INDEX IF NOT EXISTS idx_claimable_balances_notification_pending 
  ON claimable_balances(organization_id, expires_at, expiry_notification_sent_at) 
  WHERE status = 'pending' AND expiry_notification_sent_at IS NULL;

-- Add comment to document column purpose
COMMENT ON COLUMN claimable_balances.predicate_type IS 'Type of predicate: unconditional (always claimable), predicate_time (must claim within timeframe), predicate_before_relative_time (must claim before relative deadline)';
COMMENT ON COLUMN claimable_balances.predicate_data IS 'JSON data describing predicate constraints (e.g., {\"maxAge\": 7776000, \"unit\": \"seconds\"})';
COMMENT ON COLUMN claimable_balances.expiry_notification_sent_at IS 'Timestamp when employer/employee was notified of approaching expiry';
COMMENT ON COLUMN claimable_balances.reclaimed_at IS 'Timestamp when employer clawed back the balance';
COMMENT ON COLUMN claimable_balances.reclaim_reason IS 'Reason provided by employer for reclaiming the balance';
