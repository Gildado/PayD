-- SEP-31 cross-border send tracking: anchor + Stellar hops for payroll / treasury reporting.
CREATE TABLE IF NOT EXISTS sep31_cross_border_transactions (
  id                      SERIAL PRIMARY KEY,
  organization_id       INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  sender_public_key       VARCHAR(56) NOT NULL,
  anchor_domain           VARCHAR(255) NOT NULL,
  anchor_transaction_id   VARCHAR(255),
  stellar_transaction_id  VARCHAR(128),
  hop_ledger              JSONB NOT NULL DEFAULT '[]',
  status                  VARCHAR(64),
  request_payload         JSONB,
  anchor_response_init    JSONB,
  anchor_response_latest  JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sep31_org ON sep31_cross_border_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sep31_anchor_tx ON sep31_cross_border_transactions(anchor_domain, anchor_transaction_id);

COMMENT ON TABLE sep31_cross_border_transactions IS
  'Tracks SEP-31 sender transactions and multi-hop (Stellar + fiat rail) metadata for reconciliation.';
