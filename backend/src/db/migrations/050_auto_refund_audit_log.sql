-- Migration: 050_auto_refund_audit_log
-- Issue #600: Track automatic distribution account re-funding events

CREATE TABLE IF NOT EXISTS auto_refund_log (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    distribution_account VARCHAR(56) NOT NULL,
    funding_source  VARCHAR(56) NOT NULL,
    asset_code      VARCHAR(12) NOT NULL,
    amount          NUMERIC(20,7) NOT NULL,
    balance_before  NUMERIC(20,7) NOT NULL,
    balance_after   NUMERIC(20,7) NOT NULL,
    tx_hash         VARCHAR(128),
    status          VARCHAR(20) NOT NULL DEFAULT 'completed',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auto_refund_log_org ON auto_refund_log(organization_id);
CREATE INDEX idx_auto_refund_log_created ON auto_refund_log(created_at);
