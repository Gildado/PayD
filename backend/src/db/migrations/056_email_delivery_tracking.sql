-- Migration 056: Email Delivery Tracking Tables (#1050)
-- Note: renumbered from 050 -> 056 to resolve a duplicate numeric prefix with
-- 050_auto_refund_audit_log.sql (both files were previously named "050_"),
-- which broke the migration runner's duplicate-prefix guard. See Issue #1039.

-- Email delivery logs table
CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('sendgrid', 'resend')),
  bounce_type TEXT CHECK (bounce_type IN ('hard', 'soft')),
  bounce_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  retry_scheduled_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_message_id ON email_delivery_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_email ON email_delivery_logs(email);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status ON email_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_created_at ON email_delivery_logs(created_at DESC);

-- Invalid emails table
CREATE TABLE IF NOT EXISTS invalid_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  flagged_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invalid_emails_email ON invalid_emails(email);

-- Add email_status and email_invalid_reason to employees table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'employees' AND column_name = 'email_status') THEN
    ALTER TABLE employees ADD COLUMN email_status TEXT DEFAULT 'valid' CHECK (email_status IN ('valid', 'invalid'));
    ALTER TABLE employees ADD COLUMN email_invalid_reason TEXT;
  END IF;
END $$;

COMMENT ON TABLE email_delivery_logs IS 'Tracks email delivery status and events from email providers';
COMMENT ON TABLE invalid_emails IS 'List of invalid email addresses flagged due to hard bounces';
