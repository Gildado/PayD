-- Rollback 058: Drop reporting agent infrastructure
-- Purpose: Safely remove all reporting-related tables and functions

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_in_app_notifications_updated ON in_app_notifications;
DROP TRIGGER IF EXISTS trigger_report_access_policies_updated ON report_access_policies;
DROP TRIGGER IF EXISTS trigger_report_delivery_logs_updated ON report_delivery_logs;
DROP TRIGGER IF EXISTS trigger_report_delivery_configs_updated ON report_delivery_configs;
DROP TRIGGER IF EXISTS trigger_report_executions_updated ON report_executions;
DROP TRIGGER IF EXISTS trigger_report_agents_updated ON report_agents;

-- Drop function
DROP FUNCTION IF EXISTS update_report_timestamp();

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS in_app_notifications;
DROP TABLE IF EXISTS report_access_policies;
DROP TABLE IF EXISTS report_delivery_logs;
DROP TABLE IF EXISTS report_delivery_configs;
DROP TABLE IF EXISTS report_results;
DROP TABLE IF EXISTS report_executions;
DROP TABLE IF EXISTS report_agents;
