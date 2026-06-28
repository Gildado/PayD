-- Rollback for Migration 046: API & Database Scaling – Part 25

DROP INDEX IF EXISTS idx_transactions_list_covering;
DROP INDEX IF EXISTS idx_employees_list_covering;
DROP FUNCTION IF EXISTS prune_api_latency_histogram();
DROP INDEX IF EXISTS idx_api_latency_bucket;
DROP INDEX IF EXISTS idx_api_latency_endpoint_window;
DROP TABLE IF EXISTS api_latency_histogram;
