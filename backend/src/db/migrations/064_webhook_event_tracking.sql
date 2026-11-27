-- Migration: 064_webhook_event_tracking.sql
-- Purpose: Create table for tracking webhook event IDs to prevent replay attacks
-- Related: Email webhook signature verification (#security-enhancement)

CREATE TABLE IF NOT EXISTS webhook_event_ids (
  event_id VARCHAR(255) PRIMARY KEY,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('sendgrid', 'resend')),
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for cleanup queries (remove old events after 7 days)
CREATE INDEX IF NOT EXISTS idx_webhook_event_ids_received_at
  ON webhook_event_ids (received_at);

-- Index for provider-specific queries
CREATE INDEX IF NOT EXISTS idx_webhook_event_ids_provider
  ON webhook_event_ids (provider);

COMMENT ON TABLE webhook_event_ids IS 'Tracks processed webhook event IDs to prevent replay attacks';
COMMENT ON COLUMN webhook_event_ids.event_id IS 'Unique event identifier from the webhook provider';
COMMENT ON COLUMN webhook_event_ids.provider IS 'Email provider that sent the webhook (sendgrid or resend)';
COMMENT ON COLUMN webhook_event_ids.received_at IS 'Timestamp when the webhook event was first processed';
