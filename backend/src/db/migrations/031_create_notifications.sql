-- Migration: Create notifications infrastructure
-- Description: Add tables for email and push notifications tracking

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('email', 'push')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_transaction_id ON notifications(transaction_id);
CREATE INDEX IF NOT EXISTS idx_notifications_employee_id ON notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Create notification_configs table
CREATE TABLE IF NOT EXISTS notification_configs (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT false,
  email_provider VARCHAR(20) NOT NULL DEFAULT 'resend' CHECK (email_provider IN ('resend', 'sendgrid')),
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  locale VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for notification_configs table
CREATE INDEX IF NOT EXISTS idx_notification_configs_organization_id ON notification_configs(organization_id);

-- Create push_tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  token VARCHAR(512) NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, token)
);

-- Create indexes for push_tokens table
CREATE INDEX IF NOT EXISTS idx_push_tokens_employee_id ON push_tokens(employee_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

-- Add locale column to employees table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'locale'
  ) THEN
    ALTER TABLE employees ADD COLUMN locale VARCHAR(10) DEFAULT 'en';
  END IF;
END $$;

-- Create or replace function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at columns
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at 
  BEFORE UPDATE ON notifications
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_configs_updated_at ON notification_configs;
CREATE TRIGGER update_notification_configs_updated_at 
  BEFORE UPDATE ON notification_configs
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_push_tokens_updated_at ON push_tokens;
CREATE TRIGGER update_push_tokens_updated_at 
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
