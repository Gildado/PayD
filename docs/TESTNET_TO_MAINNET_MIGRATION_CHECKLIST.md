# Testnet → Mainnet Migration Checklist

Every fee, limit, and admin-key parameter across PayD's 8 Soroban contracts
(`contracts/`) that must be reviewed — and in most cases explicitly
re-supplied — before a mainnet deployment. Testnet defaults exist to make
local iteration fast; several of them are wrong or dangerous for mainnet if
carried over unreviewed.

## 1. Admin keys (`initialize`/`__constructor` parameters)

Every contract below takes its admin/governance address as a constructor or
`initialize` argument — there is no on-chain default. **A testnet deployment
script that hardcodes a dev keypair as `admin` must never be reused verbatim
for mainnet.**

| Contract | Admin-shaped parameter(s) | Source |
| --- | --- | --- |
| `bulk_payment` | `admin: Address` | `initialize(env, admin)` |
| `milestone_escrow` | `admin: Address` | `initialize(env, admin)` |
| `orgusd` | `admin: Address` | `initialize(env, admin)` |
| `vesting_escrow` | `funder`, `beneficiary` | `initialize(e, funder, beneficiary, token, ...)` — no single "admin", review both real-fund-controlling addresses |
| `asset_path_payment`, `cross_asset_payment`, `revenue_split`, `smart_wallet` | admin set via a distinct init path — confirm the actual admin argument at deploy time per that contract's `initialize`/constructor before mainnet | grep `fn initialize` / `fn __constructor` in the relevant `src/lib.rs` |

**Action:** for each contract, confirm the mainnet deploy script passes a
real, access-controlled key (ideally a multisig — see
`docs/MULTI_SIG_SECURITY_MODEL.md`) and not a testnet throwaway keypair.

## 2. Storage TTL thresholds

These control how proactively each contract extends its own ledger entries
and are consistent across most contracts (see
`docs/CONTRACT_ARCHIVAL_STRATEGY.md` for the full rationale):

| Constant | Value | Contracts |
| --- | --- | --- |
| `PERSISTENT_TTL_THRESHOLD` | `20_000` ledgers | bulk_payment, asset_path_payment, cross_asset_payment, milestone_escrow, orgusd (as `INSTANCE_TTL_THRESHOLD`/`PERSISTENT_TTL_THRESHOLD`), revenue_split, vesting_escrow |
| `PERSISTENT_TTL_EXTEND_TO` | `120_000` ledgers | same set as above |
| `TEMPORARY_TTL_THRESHOLD` | `2_000` ledgers | bulk_payment, asset_path_payment |
| `TEMPORARY_TTL_EXTEND_TO` | `20_000` ledgers | bulk_payment, asset_path_payment |
| `ARCHIVE_TTL_THRESHOLD` / `ARCHIVE_TTL_EXTEND_TO` | `5_000` / `50_000` ledgers | bulk_payment only |
| `PAYMENT_TTL_THRESHOLD` / `PAYMENT_TTL_EXTEND_TO` | `100_000` / `1_500_000` ledgers | cross_asset_payment |

**Action:** these thresholds were sized for testnet's lower rent pressure
assumptions. Re-validate against actual mainnet storage rent pricing (see
`docs/STORAGE_RENT_MONITORING.md`, #1618) before launch — a threshold that's
comfortable on testnet can still mean unexpected mainnet rent cost if usage
volume is higher than modeled.

## 3. Fee, limit, and timing parameters

| Contract | Constant | Value | Why it needs mainnet review |
| --- | --- | --- | --- |
| `bulk_payment` | `MAX_BATCH_SIZE` | `100` | Caps entries per batch — resource-limit tradeoff, review against real mainnet resource-fee costs |
| `bulk_payment` | `FEE_BUMP_MULTIPLIER` | `2` | Multiplier applied when bumping a stuck transaction's fee — mainnet fee markets can spike higher than testnet |
| `bulk_payment` | `MAX_THROTTLE_LEDGER_GAP` | `LEDGERS_PER_DAY` (`17_280`) | Rate-limits batch frequency per sender |
| `cross_asset_payment` | `PAYMENT_TIMEOUT_LEDGERS` | `17_280` (~1 day) | How long a cross-asset payment can remain pending before timeout |
| `revenue_split` | `TOTAL_BASIS_POINTS` | `10_000` | Fixed denominator — not itself a tunable, but every recipient split config must sum to this on mainnet or the contract will reject it |
| `revenue_split` | `DEFAULT_MAX_DISTRIBUTION_AMOUNT` | `i128::MAX` | Effectively unlimited — **review whether mainnet needs an actual cap** before go-live |
| `revenue_split` | `DEFAULT_FAILURE_THRESHOLD` / `DEFAULT_RECOVERY_COOLDOWN_SECONDS` | `3` / `3_600` | Circuit-breaker sensitivity — tune against real expected mainnet call volume, not testnet's lighter load |
| `orgusd` | `DEFAULT_TIMELOCK_DELAY_SECS` | `86_400` (24h) | Governance timelock — confirm this is the intended mainnet delay, not a testnet-shortened value |
| `vesting_escrow` | `BASIS_POINTS_DENOMINATOR` | `10_000` | Same category as `revenue_split`'s — fixed denominator, verify all vesting configs are computed against it correctly for real (larger) mainnet amounts |

## 4. Network configuration

- `scripts/verify_config.toml`: fill in the `[network.mainnet]` `contract_id`
  and `admin` fields for all 8 contracts — currently only the RPC URL and
  passphrase are pre-filled; every `contract_id`/`admin`/`wasm_hash` entry
  must be added post-deploy.
- `backend/src/config/index.ts`: `STELLAR_HORIZON_URL` and
  `STELLAR_SOROBAN_RPC_URL` env vars must point at mainnet endpoints, and
  `STELLAR_NETWORK_PASSPHRASE` must be
  `"Public Global Stellar Network ; September 2015"`, not the testnet
  passphrase.

## 5. Dependency pins

- `stellar-access`/`stellar-macros`/`stellar-tokens` (OpenZeppelin
  `stellar-contracts`) pinned tag — see #1620 /
  `docs/DEPENDENCY_AUDIT.md` for the current pin vs. latest-available
  audit.

## 6. Sign-off

Per `docs/MULTI_SIG_SECURITY_MODEL.md`, no contract holding real funds
should go to mainnet with a single-signer admin key. Confirm the multisig
threshold/signer set is finalized for every contract in section 1 before
using it as the `admin` argument above.
