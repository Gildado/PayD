-- Rollback: 024_create_notifications
DROP TRIGGER IF EXISTS update_push_tokens_updated_at ON push_tokens;
DROP TRIGGER IF EXISTS update_notification_configs_updated_at ON notification_configs;
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;

DROP INDEX IF EXISTS idx_push_tokens_token;
DROP INDEX IF EXISTS idx_push_tokens_employee_id;
DROP TABLE IF EXISTS push_tokens;

DROP INDEX IF EXISTS idx_notification_configs_organization_id;
DROP TABLE IF EXISTS notification_configs;

DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_notifications_status;
DROP INDEX IF EXISTS idx_notifications_organization_id;
DROP INDEX IF EXISTS idx_notifications_employee_id;
DROP INDEX IF EXISTS idx_notifications_transaction_id;
DROP TABLE IF EXISTS notifications;
