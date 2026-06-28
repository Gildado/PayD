# Vesting Escrow Contract

A Soroban smart contract that holds salary in escrow and releases it on a linear vesting schedule with cliff, clawback, and administrative controls.

## Features

- **Linear Vesting with Cliff**: Tokens vest linearly from `start_time + cliff_seconds` to `start_time + duration_seconds`.
- **Clawback (Full)**: The clawback admin can terminate the grant early, returning unvested tokens and capping future vesting.
- **Partial Clawback**: Reduce the grant by a specific amount without deactivating the schedule.
- **Schedule Extension**: The clawback admin can extend the vesting duration.
- **Beneficiary Transfer**: The clawback admin can transfer the grant to a new beneficiary address.
- **Admin Governance**: A separate admin role can pause/unpause the contract and transfer admin rights.
- **Emergency Pause (Circuit Breaker)**: Admin can pause claims and clawbacks while leaving read-only and admin functions available.
- **Ledger Replay Protection**: Each claim and clawback is validated against the current ledger sequence.
- **Structured Errors**: All failures return `ContractError` enum variants instead of bare panics.
- **On-chain Events**: Full event coverage for initialization, claims, clawbacks, partial clawbacks, beneficiary transfers, schedule extensions, and pause state changes.
- **SEP-0034 Compliant**: Exposes `name`, `version`, and `author` for off-chain tooling.
- **TTL Management**: Admin-authorized TTL extension for persistent storage entries.

## Roles

| Role | Abilities |
|---|---|
| **Funder** | Initialize the escrow (one-time, requires auth) |
| **Beneficiary** | Claim vested tokens (requires auth) |
| **Clawback Admin** | Full clawback, partial clawback, extend vesting, transfer beneficiary |
| **Admin** | Pause/unpause, set admin, bump TTL |

## Public Functions

### Metadata (SEP-0034)

| Function | Returns |
|---|---|
| `name(env)` | Contract name (String) |
| `version(env)` | Semantic version (String) |
| `author(env)` | Author/organization (String) |

### Initialization

| Function | Description |
|---|---|
| `initialize(funder, beneficiary, token, start_time, cliff_seconds, duration_seconds, amount, clawback_admin, admin)` | One-time setup. Transfers `amount` from funder to contract. |

### Beneficiary Operations

| Function | Description |
|---|---|
| `claim()` | Claims all currently vested tokens. Authorized by beneficiary. |
| `get_vested_amount()` | Returns vested amount at current timestamp. |
| `get_claimable_amount()` | Returns vested minus claimed. |
| `get_vesting_progress_bps()` | Returns progress as basis points (10_000 = 100%). |
| `get_vesting_snapshot()` | Returns compact read-only state snapshot. |
| `preview_vested_amount(timestamp)` | Returns vested amount at arbitrary timestamp. |

### Clawback Admin Operations

| Function | Description |
|---|---|
| `clawback()` | Terminates grant, returns unvested tokens to clawback admin. |
| `partial_clawback(amount)` | Reduces grant by `amount` without deactivating. |
| `extend_vesting(additional_seconds)` | Extends vesting duration. |
| `transfer_beneficiary(new_beneficiary)` | Transfers grant to new beneficiary (active grants only). |

### Admin Operations

| Function | Description |
|---|---|
| `set_admin(new_admin)` | Transfers admin role. |
| `set_paused(paused)` | Engages or disengages circuit breaker. |
| `is_paused()` | Returns `true` if contract is paused. |
| `bump_ttl()` | Extends TTL for persistent storage entries. |
| `get_admin()` | Returns current admin address. |

### Read-only Queries

| Function | Description |
|---|---|
| `get_config()` | Returns full `VestingConfig`. |
| `get_locked_amount()` | Returns balance still held by contract. |
| `get_last_claim_ledger()` | Returns ledger sequence of last claim. |
| `get_last_clawback_ledger()` | Returns ledger sequence of last clawback. |

## Storage Architecture

| Storage Tier | Usage |
|---|---|
| **Persistent** | `Config`, `Admin`, `LastClaimLedger`, `LastClawbackLedger` |
| **Instance** | `Paused` (frequently accessed, low cost) |

TTL constants: threshold = 20,000 ledgers, extend_to = 120,000 ledgers.

## Events

| Event | Trigger |
|---|---|
| `VestingInitializedEvent` | Successful `initialize` |
| `TokensClaimedEvent` | Successful `claim` |
| `ClawbackExecutedEvent` | Successful `clawback` |
| `PartialClawbackExecutedEvent` | Successful `partial_clawback` |
| `BeneficiaryTransferredEvent` | Successful `transfer_beneficiary` |
| `VestingScheduleExtendedEvent` | Successful `extend_vesting` |
| `ContractStatusChangedEvent` | `set_paused(true)` or `set_paused(false)` |

## Error Codes

| Code | Variant | Description |
|---|---|---|
| 1 | `AlreadyInitialized` | `initialize` called more than once |
| 2 | `NotInitialized` | Config or admin not found |
| 3 | `Unauthorized` | Reserved for future auth errors |
| 4 | `InvalidDuration` | `cliff_seconds > duration_seconds` |
| 5 | `InvalidAmount` | `amount <= 0` |
| 6 | `AlreadyRevoked` | Grant is inactive (clawback already executed) |
| 7 | `ContractPaused` | Operation blocked by circuit breaker |
| 8 | `LedgerReplayDetected` | Same operation in same ledger |
| 9 | `GrantInactive` | `transfer_beneficiary` on inactive grant |
| 10 | `SameAdmin` | `set_admin` with current admin |
| 11 | `InvalidClawbackAmount` | `partial_clawback` with `amount <= 0` |
| 12 | `InvalidExtension` | `extend_vesting` with `additional_seconds == 0` |
| 13 | `ClawbackBelowClaimed` | Partial clawback would reduce below claimed |

## Building and Testing

```bash
# Build for wasm32 target
cargo build -p vesting_escrow --target wasm32-unknown-unknown --release

# Run tests
cargo test -p vesting_escrow

# Run clippy
cargo clippy -p vesting_escrow -- -D warnings
```
