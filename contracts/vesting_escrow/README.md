# Vesting Escrow Contract (`vesting_escrow`)

The **Vesting Escrow Contract** manages time-based token grants, linear vesting schedules with cliffs, full and partial clawbacks, schedule extensions, beneficiary transfers, version upgrades, and emergency pause controls for employee compensation on Stellar / Soroban.

---

## Purpose

Token vesting ensures employee and founder incentives remain aligned with long-term organization goals:
- **Linear Vesting with Cliff**: Tokens remain locked until `start_time + cliff_seconds`, after which they vest continuously until `start_time + duration_seconds`.
- **Clawback Controls**: Enables clawback admins to terminate grants early or execute partial clawbacks without canceling remaining vesting.
- **Beneficiary Transfer**: Allows migrating grant entitlement if an employee updates their wallet address.
- **Circuit Breaker**: Enables governance admins to pause claims and clawbacks during contract upgrades or security incidents.

---

## Roles & Permissions

| Role | Responsibilities | Auth Required |
|---|---|---|
| **Funder** | Initializing contract and transferring total grant amount into escrow | `funder.require_auth()` |
| **Beneficiary** | Claiming vested tokens over time | `beneficiary.require_auth()` |
| **Clawback Admin** | Executing full/partial clawbacks, extending schedules, transferring beneficiary rights | `clawback_admin.require_auth()` |
| **Governance Admin** | Circuit breaker controls (`set_paused`), admin transfers (`set_admin`), version marking, TTL extensions | `admin.require_auth()` |

---

## Interface

### Public Functions

| Function | Parameters | Return Type | Access Control | Description |
|---|---|---|---|---|
| `name` | `env: Env` | `String` | Public | Returns contract name (`vesting_escrow`). |
| `version` | `env: Env` | `String` | Public | Returns contract version string (SEP-0034). |
| `author` | `env: Env` | `String` | Public | Returns package author metadata. |
| `initialize` | `e: Env, funder: Address, beneficiary: Address, token: Address, start_time: u64, cliff_seconds: u64, duration_seconds: u64, amount: i128, clawback_admin: Address, admin: Address` | `Result<(), ContractError>` | Funder Auth (Once) | Escrows `amount` from funder and configures schedule. |
| `set_admin` | `env: Env, new_admin: Address` | `Result<(), ContractError>` | Admin Auth | Updates governance administrator. |
| `get_admin` | `env: Env` | `Result<Address, ContractError>` | Public | Reads active governance admin address. |
| `set_paused` | `env: Env, paused: bool` | `Result<(), ContractError>` | Admin Auth | Engages or disengages emergency circuit breaker. |
| `is_paused` | `env: Env` | `bool` | Public | Returns `true` if contract is paused. |
| `get_version` | `env: Env` | `u32` | Public | Reads contract version for upgrade tracking. |
| `mark_upgrade` | `env: Env, new_version: u32` | `Result<(), ContractError>` | Admin Auth | Emits upgrade event and increments contract version. |
| `claim` | `e: Env` | `Result<(), ContractError>` | Beneficiary Auth | Transfers all currently vested and unclaimed tokens to beneficiary. |
| `clawback` | `e: Env` | `Result<(), ContractError>` | Clawback Admin Auth | Terminates grant; returns unvested tokens to clawback admin while leaving vested tokens for beneficiary. |
| `partial_clawback` | `env: Env, amount: i128` | `Result<(), ContractError>` | Clawback Admin Auth | Reclaims specified unvested amount without terminating schedule. |
| `extend_vesting` | `env: Env, additional_seconds: u64` | `Result<(), ContractError>` | Clawback Admin Auth | Prolongs vesting schedule duration. |
| `get_vested_amount` | `e: Env` | `i128` | Public | Returns total amount vested at current timestamp. |
| `get_claimable_amount` | `e: Env` | `i128` | Public | Returns vested amount minus already claimed amount. |
| `get_config` | `e: Env` | `VestingConfig` | Public | Reads complete vesting configuration struct. |
| `get_locked_amount` | `e: Env` | `i128` | Public | Returns remaining escrowed tokens held by contract. |
| `preview_vested_amount` | `e: Env, timestamp: u64` | `i128` | Public | Calculates vested amount at an arbitrary timestamp. |
| `get_vesting_progress_bps` | `e: Env` | `u32` | Public | Returns vesting progress in basis points (10,000 = 100%). |
| `get_vesting_snapshot` | `e: Env` | `VestingSnapshot` | Public | Reads compact state snapshot (timestamps, vested, claimable, locked). |
| `transfer_beneficiary` | `e: Env, new_beneficiary: Address` | `Result<(), ContractError>` | Clawback Admin Auth | Replaces beneficiary address for active grant. |
| `bump_ttl` | `e: Env` | `Result<(), ContractError>` | Admin Auth | Extends TTL for persistent storage keys. |
| `get_last_claim_ledger` | `e: Env` | `u32` | Public | Reads ledger sequence of last claim. |
| `get_last_clawback_ledger` | `e: Env` | `u32` | Public | Reads ledger sequence of last clawback. |

---

## Storage Layout

State is maintained in `Persistent` and `Instance` storage domains.

| Key | Storage Domain | Value Type | Description / Key Pattern |
|---|---|---|---|
| `DataKey::Config` | Persistent | `VestingConfig` | Schedule parameters, claimed total, beneficiary, clawback admin. |
| `DataKey::Admin` | Persistent | `Address` | Governance administrator address. |
| `DataKey::LastClaimLedger` | Persistent | `u32` | Last ledger sequence in which a claim was processed. |
| `DataKey::LastClawbackLedger` | Persistent | `u32` | Last ledger sequence in which a clawback was processed. |
| `DataKey::Paused` | Instance | `bool` | Emergency circuit breaker state flag. |
| `DataKey::Version` | Persistent | `u32` | Contract version number. |

---

## Replay-Attack Protection (Issue #1600)

The contract prevents same-ledger replay attacks through a ledger sequence check:

### Protection Mechanism
- A `LastClaimLedger` and `LastClawbackLedger` key stores the sequence number of the most recent `claim()` or `clawback()` call.
- Each `claim()`, `clawback()`, or `partial_clawback()` call checks: `if last_ledger == current_ledger { return LedgerReplayDetected }`.
- If the check passes, the storage key is updated to the current ledger sequence.

### Attack Scenario Prevented
An attacker cannot submit a claim twice in the same Stellar ledger to receive tokens twice. The second attempt fails with `LedgerReplayDetected`.

### Cross-Ledger Safety
Operations in different ledgers (e.g., ledger 100 and 101) proceed normally. Only same-ledger duplicates are rejected.

### Test Coverage
The contract includes comprehensive replay-attack tests:
- **Same-Ledger Claim Replay**: Verifies that duplicate claims in a single ledger are rejected.
- **Cross-Ledger Operations**: Confirms that claims in successive ledgers are allowed.
- **Same-Ledger Clawback Replay**: Ensures clawback operations cannot be replayed within a ledger.
- **Partial Clawback Replay**: Tests that partial clawback operations are also replay-protected.
- **Realistic Ledger Sequences**: Tests with Stellar mainnet-realistic sequence numbers (50M+).

---

## Race-Condition Test Coverage (Issue #1616)

Added tests specifically targeting concurrent (same-ledger) withdrawal
attempts against a vesting grant, to rule out double-payout risk ahead of
mainnet:

- **Concurrent Claim Race**: Two claim attempts racing for the same ledger
  transfer tokens exactly once; the losing attempt moves zero tokens.
- **Claim vs. Clawback Race**: A beneficiary claim and an admin clawback
  racing in the same ledger use independent replay guards, so both may
  execute -- verified that the total paid out still equals the original
  grant (no funds duplicated or lost).
- **Repeated Per-Ledger Races**: Simulates a claim race at every ledger
  across a multi-step vesting schedule, confirming cumulative claims track
  the vested amount exactly and never exceed the total grant.

See `contracts/vesting_escrow/src/test_race_conditions.rs`.

---
## Test Coverage for Edge Cases (Issue #1595)

The contract includes comprehensive edge-case tests to verify correct behavior under boundary conditions:

- **Zero-Cliff Immediate Vesting**: Verifies that with `cliff_seconds = 0`, tokens begin vesting immediately after `start_time` (0 at start, > 0 at start+1).
- **One-Second Cliff**: Tests the minimum non-zero cliff duration to ensure correct linear vesting fraction.
- **Same-Second Cliff and Duration** (`cliff_seconds == duration_seconds`): Confirms that the entire grant vests at a single instant when cliff equals total duration.
- **Minimal Duration**: Tests grants with `duration_seconds = 1` to ensure proper vesting calculation under extreme compression.
- **Boundary Timestamp**: Validates vesting calculations with very large `start_time` values (e.g., `u64::MAX / 2`) to ensure no overflow or precision loss.

These tests ensure robustness before mainnet deployment where financial correctness is critical.

---

## Security Considerations

1. **Vesting Floor Invariants**:
   - `clawback` sets `total_amount = max(vested, claimed_amount)` to ensure that tokens already vested prior to clawback remain available for the beneficiary to claim.
2. **Partial Clawback Constraints**:
   - `partial_clawback` enforces `new_total >= claimed_amount` (`ClawbackBelowClaimed`), preventing total grant reduction below already disbursed funds.
3. **Replay Protection**:
   - `require_unique_ledger` checks `LastClaimLedger` and `LastClawbackLedger` to prevent duplicate claims/clawbacks in the same ledger sequence.
4. **Circuit Breaker (`Paused` state)**:
   - When paused, `claim`, `clawback`, and `partial_clawback` calls return `ContractPaused`.

---

## Usage Examples

### Initializing a Vesting Escrow (`Soroban CLI`)

```bash
soroban contract invoke \
  --id <VESTING_CONTRACT_ID> \
  --source FUNDER_SECRET_KEY \
  -- \
  initialize \
  --funder <FUNDER_ADDRESS> \
  --beneficiary <EMPLOYEE_ADDRESS> \
  --token <ORGUSD_TOKEN_ADDRESS> \
  --start_time 1700000000 \
  --cliff_seconds 31536000 \
  --duration_seconds 126144000 \
  --amount 1000000000 \
  --clawback_admin <HR_ADMIN_ADDRESS> \
  --admin <GOV_ADMIN_ADDRESS>
```

### Claiming Vested Tokens

```bash
soroban contract invoke \
  --id <VESTING_CONTRACT_ID> \
  --source EMPLOYEE_SECRET_KEY \
  -- \
  claim
```

---

## Cross-References

- **`orgusd`**: Primary token asset for employee vesting grants.
- **`milestone_escrow`**: Provides milestone-based escrow as an alternative to time-based vesting.
- **`bulk_payment`**: Can execute initial grant funding in batches.
