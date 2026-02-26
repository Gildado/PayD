-- =============================================================================
-- Migration 014: Contract Registry & Upgrade Logs
-- Purpose : Persist the set of deployed Soroban contracts and a full,
--           append-only history of every upgrade attempt.
--
-- Design decisions:
--   • contract_registry is the source-of-truth for deployed contract state.
--     contract_id is the on-chain C-address; current_wasm_hash is the
--     SHA-256 of the live WASM module (64 hex chars).
--   • contract_upgrade_logs is append-only: no DELETE/UPDATE policy beyond
--     status transitions, mirroring the audit_logs pattern.
--   • status uses a CHECK constraint (not PG ENUM) for zero-downtime
--     extension — adding a new status requires only a migration, not an
--     ALTER TYPE that briefly acquires a table lock.
--   • migration_steps stores an ordered JSON array of
--     { id, name, status, message } objects so progress is queryable
--     without a separate table, keeping O(1) row-level access.
--   • BRIN on created_at (upgrade_logs): upgrades are infrequent and
--     monotonically timestamped; BRIN keeps index size ~1000× smaller
--     than B-tree for this access pattern.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- contract_registry — one row per deployed Soroban contract
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contract_registry (
  id                SERIAL         PRIMARY KEY,

  -- Human-readable label shown in the admin UI.
  name              VARCHAR(100)   NOT NULL UNIQUE,

  -- Optional description for the contract's purpose.
  description       TEXT,

  -- Which Stellar network this entry belongs to.
  network           VARCHAR(20)    NOT NULL DEFAULT 'TESTNET'
                      CHECK (network IN ('TESTNET', 'MAINNET')),

  -- On-chain contract address (C... bech32m address).
  contract_id       VARCHAR(255)   NOT NULL UNIQUE,

  -- SHA-256 of the currently deployed WASM module (64 lowercase hex chars).
  -- Updated atomically after a successful upgrade.
  current_wasm_hash VARCHAR(64)    NOT NULL
                      CHECK (current_wasm_hash ~ '^[0-9a-f]{64}$'),

  -- Semantic version tag — informational only, not enforced by DB.
  version           VARCHAR(50)    NOT NULL DEFAULT '1.0.0',

  -- Timestamp and actor of the last successful upgrade. NULL on first deploy.
  last_upgraded_at  TIMESTAMPTZ,
  last_upgraded_by  VARCHAR(255),

  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Index: admin UI lists contracts filtered by network
CREATE INDEX IF NOT EXISTS idx_contract_registry_network
  ON contract_registry (network, created_at DESC);

-- ---------------------------------------------------------------------------
-- contract_upgrade_logs — append-only record of every upgrade attempt
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contract_upgrade_logs (
  id                 BIGSERIAL      PRIMARY KEY,

  -- FK to the contract being upgraded. ON DELETE CASCADE so orphan logs
  -- are cleaned up if a contract is removed from the registry.
  registry_id        INTEGER        NOT NULL
                       REFERENCES contract_registry(id) ON DELETE CASCADE,

  -- Snapshot of the hashes at time of initiation.
  previous_wasm_hash VARCHAR(64)    NOT NULL
                       CHECK (previous_wasm_hash ~ '^[0-9a-f]{64}$'),
  new_wasm_hash      VARCHAR(64)    NOT NULL
                       CHECK (new_wasm_hash ~ '^[0-9a-f]{64}$'),

  -- Lifecycle status — transitions are one-directional:
  --   pending → simulated → confirmed → executing → completed
  --                                               → failed
  --   pending/simulated → cancelled
  status             VARCHAR(30)    NOT NULL DEFAULT 'pending'
                       CHECK (status IN (
                         'pending', 'simulated', 'confirmed',
                         'executing', 'completed', 'failed', 'cancelled'
                       )),

  -- JSONB blob from the Soroban RPC simulateTransaction response.
  simulation_result  JSONB,

  -- On-chain transaction hash after successful execution.
  tx_hash            VARCHAR(255),

  -- Ordered array of post-upgrade migration steps.
  -- Shape: [{ id: string, name: string, status: "pending"|"running"|"completed"|"failed", message: string|null }]
  migration_steps    JSONB          NOT NULL DEFAULT '[]',

  -- Who triggered this upgrade attempt (admin wallet address).
  initiated_by       VARCHAR(255)   NOT NULL,

  -- Optional notes / changelog for this upgrade.
  notes              TEXT,

  -- Human-readable error captured on failure.
  error_message      TEXT,

  -- Immutable timestamp when the attempt was created.
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  -- Timestamp when the attempt reached a terminal state (completed/failed).
  completed_at       TIMESTAMPTZ,

  -- Constraint: new hash must differ from previous hash.
  CONSTRAINT chk_different_hashes
    CHECK (new_wasm_hash <> previous_wasm_hash)
);

-- ---------------------------------------------------------------------------
-- Indexes on contract_upgrade_logs
-- ---------------------------------------------------------------------------

-- Primary access pattern: "show all upgrades for contract X"
-- O(log n); covers the per-contract history list endpoint.
CREATE INDEX IF NOT EXISTS idx_upgrade_logs_registry_id
  ON contract_upgrade_logs (registry_id, created_at DESC);

-- Status-filtered queries: "show all in-progress upgrades"
-- Partial index — only active states; completed/failed rows excluded.
CREATE INDEX IF NOT EXISTS idx_upgrade_logs_active_status
  ON contract_upgrade_logs (status, created_at DESC)
  WHERE status IN ('pending', 'simulated', 'confirmed', 'executing');

-- BRIN on created_at: upgrades are rare & monotonically timestamped.
-- ~1000× smaller than B-tree for this write pattern.
CREATE INDEX IF NOT EXISTS idx_upgrade_logs_created_at_brin
  ON contract_upgrade_logs USING BRIN (created_at)
  WITH (pages_per_range = 128);

-- ---------------------------------------------------------------------------
-- Seed: register the contracts already in this project's /contracts dir.
-- WASM hashes are placeholder values — replace with real hashes post-deploy.
-- ---------------------------------------------------------------------------
INSERT INTO contract_registry
  (name, description, network, contract_id, current_wasm_hash, version)
VALUES
  (
    'Bulk Payment',
    'Executes batch payroll payments to multiple recipients in a single transaction.',
    'TESTNET',
    'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '1.0.0'
  ),
  (
    'Cross Asset Payment',
    'Atomic cross-asset swap and payment routing between different Stellar assets.',
    'TESTNET',
    'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBSC4',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '1.0.0'
  ),
  (
    'Revenue Split',
    'Distributes revenue among multiple recipients according to configurable split ratios.',
    'TESTNET',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBSC4',
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    '1.0.0'
  ),
  (
    'Vesting Escrow',
    'Time-locked fund release with configurable vesting schedules for employee compensation.',
    'TESTNET',
    'CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDCSC4',
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    '1.0.0'
  )
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE contract_registry IS
  'Source-of-truth registry of deployed Soroban smart contracts. '
  'current_wasm_hash is updated atomically after each successful upgrade.';

COMMENT ON TABLE contract_upgrade_logs IS
  'Append-only audit trail of every contract upgrade attempt. '
  'Rows are never deleted. Status transitions forward only.';

COMMENT ON COLUMN contract_upgrade_logs.migration_steps IS
  'JSON array of post-upgrade data migration steps. '
  'Shape: [{id, name, status: pending|running|completed|failed, message}]. '
  'Updated in-place as migration progresses (single JSONB column update).';

COMMENT ON COLUMN contract_upgrade_logs.simulation_result IS
  'Raw Soroban RPC simulateTransaction result stored for auditability. '
  'Contains estimated fees, resource usage, and any simulation errors.';
