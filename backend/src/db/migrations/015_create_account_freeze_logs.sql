-- ====================================================================
-- Migration: 010_create_account_freeze_logs
-- Purpose  : Audit trail for all freeze / unfreeze operations on
--            Stellar trustlines. A separate table from clawback_audit_logs
--            because freeze is a reversible, flag-based operation while
--            clawback is an irreversible asset burn.
-- ====================================================================

CREATE TABLE IF NOT EXISTS account_freeze_logs (
  id                SERIAL        PRIMARY KEY,
  -- The Stellar public key of the account whose trustline was toggled.
  target_account    VARCHAR(56)   NOT NULL,
  -- Asset that was frozen / unfrozen.
  asset_code        VARCHAR(12)   NOT NULL,
  asset_issuer      VARCHAR(56)   NOT NULL,
  -- 'freeze' | 'unfreeze'
  action            VARCHAR(10)   NOT NULL CHECK (action IN ('freeze', 'unfreeze')),
  -- Whether the freeze covers the whole asset class or one account.
  scope             VARCHAR(10)   NOT NULL DEFAULT 'account' CHECK (scope IN ('account', 'global')),
  -- Stellar transaction hash produced by setTrustLineFlags / allowTrust.
  tx_hash           VARCHAR(64),
  -- The admin who triggered the action (issuer public key or operator id).
  initiated_by      VARCHAR(56)   NOT NULL,
  -- Human-readable reason supplied by the admin.
  reason            TEXT,
  -- Timestamps
  created_at        TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- Indexes for O(log n) lookups on the most common query patterns
CREATE INDEX IF NOT EXISTS idx_freeze_logs_target
  ON account_freeze_logs (target_account);

CREATE INDEX IF NOT EXISTS idx_freeze_logs_asset
  ON account_freeze_logs (asset_code, asset_issuer);

CREATE INDEX IF NOT EXISTS idx_freeze_logs_action
  ON account_freeze_logs (action);

CREATE INDEX IF NOT EXISTS idx_freeze_logs_created_at
  ON account_freeze_logs (created_at DESC);

-- Composite index for getLatestLog: covers the three equality filters and the
-- ORDER BY created_at DESC in a single index scan instead of four separate ones.
-- Time complexity of getLatestLog improves from O(k log n) to O(log n).
CREATE INDEX IF NOT EXISTS idx_freeze_logs_latest
  ON account_freeze_logs (target_account, asset_code, asset_issuer, created_at DESC);
