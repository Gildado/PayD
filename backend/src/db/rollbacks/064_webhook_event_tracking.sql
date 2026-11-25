-- Rollback: 064_webhook_event_tracking.sql
-- Purpose: Remove webhook event tracking table

DROP INDEX IF EXISTS idx_webhook_event_ids_provider;
DROP INDEX IF EXISTS idx_webhook_event_ids_received_at;
DROP TABLE IF EXISTS webhook_event_ids;
