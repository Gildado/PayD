-- =============================================================================
-- Migration 012: Wallets Table
-- Purpose : Establish wallets as a first-class entity separate from employees.
--           A wallet represents a Stellar account (G-address) scoped to an
--           organization, optionally linked to an employee or used as an
--           org-level treasury / escrow account.
--
-- Design decisions:
--   • UUID primary key: avoids sequential ID enumeration attacks and plays
--     well with distributed write patterns (no hot SEQUENCE contention).
--   • (wallet_address, asset_code, asset_issuer) unique: one row per Stellar
--     trustline; native XLM is stored with asset_issuer = '' (empty string)
--     so the COALESCE trick is unnecessary and UNIQUE is always deterministic.
--   • balance is cached from Horizon for analytics — authoritative balance
--     lives on-chain. last_synced_at tracks staleness.
--   • Soft "active / frozen" flags mirror Stellar trustline flags, keeping
--     the DB state aligned with on-chain state without reprocessing history.
--   • All timestamps use TIMESTAMPTZ for timezone safety.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Core wallets table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallets (
  -- UUID prevents sequential enumeration and works without a central sequence.
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Every wallet belongs to exactly one organization (tenant boundary).
  organization_id  INTEGER         NOT NULL
                     REFERENCES organizations(id) ON DELETE CASCADE,

  -- Optional link to an employee. NULL means this is an org-level wallet
  -- (treasury, escrow, payroll disbursement source, etc.).
  employee_id      INTEGER
                     REFERENCES employees(id) ON DELETE SET NULL,

  -- Stellar G-address (56-character public key).
  -- Not UNIQUE alone because the same address can hold multiple trustlines.
  wallet_address   VARCHAR(56)     NOT NULL,

  -- Semantic category for query filtering and access-control logic.
  wallet_type      VARCHAR(20)     NOT NULL DEFAULT 'employee'
                     CHECK (wallet_type IN (
                       'employee',       -- Regular employee payout wallet
                       'organization',   -- Org master / treasury wallet
                       'escrow',         -- Funds held pending payroll approval
                       'treasury'        -- Reserve / multi-sig treasury
                     )),

  -- Asset held by this trustline.
  -- XLM (native) → asset_code='XLM', asset_issuer=''
  asset_code       VARCHAR(12)     NOT NULL DEFAULT 'XLM',

  -- Empty string for native XLM; Stellar G-address for issued assets.
  -- NOT NULL with default '' keeps the unique constraint simple.
  asset_issuer     VARCHAR(56)     NOT NULL DEFAULT '',

  -- Cached balance in 7-decimal fixed-point (Stellar's native precision).
  -- Always >= 0; the CHECK catches accidental negative writes.
  balance          DECIMAL(20, 7)  NOT NULL DEFAULT 0
                     CHECK (balance >= 0),

  -- Whether the wallet is actively used for payroll disbursements.
  is_active        BOOLEAN         NOT NULL DEFAULT TRUE,

  -- Mirrors Stellar's "authorized" trustline flag (freeze state).
  -- Synced by the freeze service whenever a setTrustLineFlags op is confirmed.
  is_frozen        BOOLEAN         NOT NULL DEFAULT FALSE,

  -- When the balance was last fetched from Horizon / SDS.
  -- NULL until the first sync. Used by the sync service to detect stale entries.
  last_synced_at   TIMESTAMPTZ,

  -- Immutable creation timestamp.
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- Auto-maintained by trigger (see below).
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- One row per (address × trustline). Prevents duplicates while allowing
  -- the same G-address to appear for XLM and USDC simultaneously.
  CONSTRAINT uq_wallet_trustline
    UNIQUE (wallet_address, asset_code, asset_issuer)
);

-- ---------------------------------------------------------------------------
-- Indexes  (all named with idx_wallets_ prefix for easy enumeration)
-- ---------------------------------------------------------------------------

-- Primary lookup: "give me all wallets for org X"  →  O(log n)
CREATE INDEX IF NOT EXISTS idx_wallets_org_id
  ON wallets (organization_id);

-- Employee dashboards query by employee_id frequently.
CREATE INDEX IF NOT EXISTS idx_wallets_employee_id
  ON wallets (employee_id)
  WHERE employee_id IS NOT NULL;   -- Partial index; skips org-level wallets.

-- The freeze service and payroll runner resolve a wallet by its address.
-- This is the most frequently executed single-row lookup.
CREATE INDEX IF NOT EXISTS idx_wallets_wallet_address
  ON wallets (wallet_address);

-- Payroll disbursement: "find the active XLM/USDC wallet for this employee".
-- Composite covers both equality predicates in a single index scan.
CREATE INDEX IF NOT EXISTS idx_wallets_org_asset
  ON wallets (organization_id, asset_code);

-- Freeze monitoring: quickly enumerate all currently-frozen wallets.
CREATE INDEX IF NOT EXISTS idx_wallets_frozen
  ON wallets (organization_id, is_frozen)
  WHERE is_frozen = TRUE;          -- Partial index; typically a small set.

-- Staleness detector: find wallets whose balance hasn't been synced recently.
CREATE INDEX IF NOT EXISTS idx_wallets_last_synced_at
  ON wallets (last_synced_at ASC NULLS FIRST);

-- Covering index for the payroll runner's "find active employee wallets" query:
-- SELECT id, wallet_address, balance FROM wallets
-- WHERE organization_id = $1 AND wallet_type = 'employee' AND is_active = TRUE
CREATE INDEX IF NOT EXISTS idx_wallets_payroll_disbursement
  ON wallets (organization_id, wallet_type, is_active)
  WHERE wallet_type = 'employee' AND is_active = TRUE;

-- ---------------------------------------------------------------------------
-- Row-Level Security (inherit org isolation pattern from migration 003)
-- ---------------------------------------------------------------------------
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_isolation_select ON wallets
  FOR SELECT
  USING (organization_id = current_tenant_id());

CREATE POLICY wallet_isolation_insert ON wallets
  FOR INSERT
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY wallet_isolation_update ON wallets
  FOR UPDATE
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY wallet_isolation_delete ON wallets
  FOR DELETE
  USING (organization_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- updated_at auto-maintenance trigger
-- (update_updated_at_column() was created in migration 001)
-- ---------------------------------------------------------------------------
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Cross-entity consistency guard
-- Ensures the employee_id (if set) belongs to the same organization as
-- the wallet row, preventing cross-tenant data leakage at the DB layer.
-- Time complexity: O(log n) via idx_employees_org_id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_wallet_employee_org()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM   employees e
      WHERE  e.id              = NEW.employee_id
        AND  e.organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION
        'Wallet employee_id=% does not belong to organization_id=%',
        NEW.employee_id, NEW.organization_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_wallet_employee_org_trigger ON wallets;
CREATE TRIGGER validate_wallet_employee_org_trigger
  BEFORE INSERT OR UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION validate_wallet_employee_org();

-- ---------------------------------------------------------------------------
-- Convenience view: active employee wallets denormalized for dashboards
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW active_employee_wallets AS
SELECT
  w.id,
  w.organization_id,
  w.employee_id,
  e.first_name || ' ' || e.last_name AS employee_name,
  e.email                             AS employee_email,
  w.wallet_address,
  w.asset_code,
  w.asset_issuer,
  w.balance,
  w.is_frozen,
  w.last_synced_at,
  w.created_at
FROM   wallets   w
JOIN   employees e ON e.id = w.employee_id
WHERE  w.is_active    = TRUE
  AND  w.wallet_type  = 'employee'
  AND  e.deleted_at   IS NULL;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE wallets IS
  'First-class wallet (Stellar account + trustline) entity. One row per '
  '(wallet_address, asset_code, asset_issuer) tuple per organization. '
  'Balance is a cached snapshot; authoritative balance lives on-chain.';

COMMENT ON COLUMN wallets.wallet_address IS
  'Stellar Ed25519 public key in StrKey format (G…, 56 chars).';

COMMENT ON COLUMN wallets.asset_issuer IS
  'Empty string for native XLM; Stellar public key for issued assets. '
  'Using empty string (not NULL) keeps the UNIQUE constraint deterministic.';

COMMENT ON COLUMN wallets.balance IS
  'Cached Stellar balance in 7-decimal precision (1 XLM = 10,000,000 stroops). '
  'Always query Horizon/SDS for the authoritative value before a disbursement.';

COMMENT ON COLUMN wallets.last_synced_at IS
  'Timestamp of the last successful balance sync from Horizon or SDS. '
  'NULL until the wallet has been synced at least once.';
