CREATE TABLE IF NOT EXISTS contract_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ledger_sequence BIGINT NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_events_event_id
  ON contract_events (event_id, contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_events_contract_ledger
  ON contract_events (contract_id, ledger_sequence DESC);

CREATE TABLE IF NOT EXISTS contract_event_index_state (
  id BIGSERIAL PRIMARY KEY,
  state_key TEXT NOT NULL UNIQUE,
  last_ledger_sequence BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indexed_streams (
  id BIGSERIAL PRIMARY KEY,
  stream_id TEXT NOT NULL UNIQUE,
  sender TEXT,
  recipient TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_ledger BIGINT,
  cancelled_ledger BIGINT,
  withdrawn_amount NUMERIC(30,7) NOT NULL DEFAULT 0,
  last_event_ledger BIGINT NOT NULL DEFAULT 0,
  last_tx_hash TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indexed_streams_status
  ON indexed_streams (status, updated_at DESC);
