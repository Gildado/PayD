-- Migration to add category column for better filtering and audit trails
ALTER TABLE contract_events ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS idx_contract_events_category ON contract_events (category);
