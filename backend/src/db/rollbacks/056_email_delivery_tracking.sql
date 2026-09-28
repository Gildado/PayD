-- Rollback for Migration 056: Email Delivery Tracking Tables (#1050)
-- (renumbered from 050 -> 056; see migrations/056_email_delivery_tracking.sql)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'employees' AND column_name = 'email_invalid_reason') THEN
    ALTER TABLE employees DROP COLUMN email_invalid_reason;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'employees' AND column_name = 'email_status') THEN
    ALTER TABLE employees DROP COLUMN email_status;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_invalid_emails_email;
DROP TABLE IF EXISTS invalid_emails;

DROP INDEX IF EXISTS idx_email_delivery_logs_created_at;
DROP INDEX IF EXISTS idx_email_delivery_logs_status;
DROP INDEX IF EXISTS idx_email_delivery_logs_email;
DROP INDEX IF EXISTS idx_email_delivery_logs_message_id;
DROP TABLE IF EXISTS email_delivery_logs;
