-- Migration 061: Durable organization-scoped appeal reviews and staged contributor payouts.
-- A unique business reference and conditional state transitions prevent duplicate execution.
CREATE TABLE IF NOT EXISTS orchestration_records (
  id UUID PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  kind TEXT NOT NULL CHECK (kind IN ('freeze-appeal', 'contributor-reward')),
  reference TEXT NOT NULL,
  status TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, kind, reference)
);

CREATE INDEX IF NOT EXISTS idx_orchestration_records_organization_created
  ON orchestration_records (organization_id, kind, created_at DESC);
