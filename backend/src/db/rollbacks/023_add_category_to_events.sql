-- Rollback: 017_add_category_to_events
DROP INDEX IF EXISTS idx_contract_events_category;
ALTER TABLE contract_events DROP COLUMN IF EXISTS category;
