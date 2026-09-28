-- Migration: 051_batch_archive_tracking
-- Issue #599: Track archived batch status maps for off-chain querying

CREATE TABLE IF NOT EXISTS batch_archive (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    batch_id        BIGINT NOT NULL,
    payment_count   INTEGER NOT NULL,
    success_count   INTEGER NOT NULL DEFAULT 0,
    fail_count      INTEGER NOT NULL DEFAULT 0,
    total_sent      NUMERIC(20,7) NOT NULL DEFAULT 0,
    asset_code      VARCHAR(12) NOT NULL,
    status_data     BYTEA,
    archived_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_batch_archive_batch_id ON batch_archive(organization_id, batch_id);
CREATE INDEX idx_batch_archive_org ON batch_archive(organization_id);
CREATE INDEX idx_batch_archive_date ON batch_archive(archived_at);
