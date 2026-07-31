# Milestone Escrow Contract (`milestone_escrow`)

The **Milestone Escrow Contract** provides multi-stage, verifier-gated escrow arrangements for contractor payments, project deliverables, and performance-based compensation on Stellar / Soroban.

---

## Purpose

Projects and freelance contracts often require releasing payments incrementally as specific milestones are completed and verified by an independent third party or manager. The `milestone_escrow` contract:
- Locks total project funds upfront into escrow upon creation.
- Enables designated verifiers to inspect and approve individual milestones.
- Enables beneficiaries (contractors) to claim approved milestone funds atomically.
- Allows senders to cancel active escrows and reclaim remaining unreleased/unapproved funds.
- Features emergency circuit breaker controls and same-ledger replay protection.

---

## Interface

### Public Functions

| Function | Parameters | Return Type | Access Control | Description |
|---|---|---|---|---|
| `name` | `env: Env` | `String` | Public | Returns contract name (`milestone_escrow`). |
| `version` | `env: Env` | `String` | Public | Returns contract version string (SEP-0034). |
| `author` | `env: Env` | `String` | Public | Returns package author metadata. |
| `initialize` | `env: Env, admin: Address` | `Result<(), ContractError>` | Public (Once) | Sets contract admin and initializes escrow counter. |
| `set_admin` | `env: Env, new_admin: Address` | `Result<(), ContractError>` | Admin Auth | Updates contract administrator address. |
| `get_admin` | `env: Env` | `Result<Address, ContractError>` | Public | Returns current admin address. |
| `set_paused` | `env: Env, paused: bool` | `Result<(), ContractError>` | Admin Auth | Engages or disengages emergency circuit breaker. |
| `is_paused` | `env: Env` | `bool` | Public | Returns `true` if contract is currently paused. |
| `bump_ttl` | `env: Env` | `Result<(), ContractError>` | Admin Auth | Extends TTL for persistent administrative storage. |
| `create_escrow` | `e: Env, sender: Address, beneficiary: Address, verifier: Address, token: Address, milestones: Vec<Milestone>` | `Result<u64, ContractError>` | Sender Auth | Escrows total milestone amounts and creates new escrow record. |
| `approve_milestone` | `e: Env, escrow_id: u64, milestone_index: u32` | `Result<(), ContractError>` | Verifier Auth | Marks a specific milestone status as `Approved`. |
| `release_milestone` | `e: Env, escrow_id: u64, milestone_index: u32` | `Result<(), ContractError>` | Beneficiary Auth | Transfers funds for an approved milestone to beneficiary. |
| `cancel_escrow` | `e: Env, escrow_id: u64` | `Result<(), ContractError>` | Sender Auth | Deactivates escrow and refunds unreleased funds to sender. |
| `get_escrow` | `e: Env, escrow_id: u64` | `Result<EscrowRecord, ContractError>` | Public | Reads escrow record by ID. |
| `get_escrow_count` | `env: Env` | `u64` | Public | Reads total count of created escrows. |
| `get_releasable_amount` | `e: Env, escrow_id: u64` | `Result<i128, ContractError>` | Public | Calculates sum of all approved but unreleased milestone amounts. |

---

## Storage Layout

State is persisted using Soroban `Persistent` storage keys.

| Key | Storage Domain | Value Type | Description / Key Pattern |
|---|---|---|---|
| `DataKey::Admin` | Persistent | `Address` | Contract administrator address. |
| `DataKey::Escrow(u64)` | Persistent | `EscrowRecord` | Contains sender, beneficiary, verifier, token, milestones, and amounts. |
| `DataKey::EscrowCount` | Persistent | `u64` | Global counter for escrow IDs. |
| `DataKey::LastReleaseLedger(u64)` | Persistent | `u32` | Replay protection ledger tracker for releases. |
| `DataKey::LastCancelLedger(u64)` | Persistent | `u32` | Replay protection ledger tracker for cancellations. |
| `DataKey::LastApproveLedger(u64)` | Persistent | `u32` | Replay protection ledger tracker for approvals. |
| `DataKey::Paused` | Instance | `bool` | Circuit breaker pause flag. |

### TTL Maintenance Strategy
- Administrative and core keys (`Admin`, `EscrowCount`) use `PERSISTENT_TTL_EXTEND_TO` (120,000 ledgers).
- Individual `EscrowRecord` keys are bumped upon every approval, release, or cancellation call.

---

## Security Considerations

1. **Role Separation**:
   - `verifier`: Authorizes milestone approvals (`approve_milestone`). Cannot release funds to themselves or alter beneficiaries.
   - `beneficiary`: Authorizes fund releases (`release_milestone`). Can only release milestones that have been explicitly approved by the verifier.
   - `sender`: Authorizes escrow creation and cancellation (`cancel_escrow`).
2. **Defensive Balance Verification**:
   - `release_milestone` re-derives remaining escrow balance directly from milestone state and contract token balance before transferring funds, eliminating double-spend vectors.
3. **Replay Protection**:
   - Replay protection keys (`LastApproveLedger`, `LastReleaseLedger`, `LastCancelLedger`) prevent executing duplicate operations within the same ledger.
4. **Circuit Breaker (`Paused` state)**:
   - When paused, calls to `create_escrow`, `approve_milestone`, `release_milestone`, and `cancel_escrow` are rejected with `ContractPaused`.

---

## Usage Examples

### Creating a Milestone Escrow (`Soroban CLI`)

```bash
soroban contract invoke \
  --id <MILESTONE_CONTRACT_ID> \
  --source SENDER_SECRET_KEY \
  -- \
  create_escrow \
  --sender <SENDER_ADDRESS> \
  --beneficiary <BENEFICIARY_ADDRESS> \
  --verifier <VERIFIER_ADDRESS> \
  --token <SAC_TOKEN_ADDRESS> \
  --milestones '[{"description":"Phase 1","amount":50000000,"status":{"pending":[]}},{"description":"Phase 2","amount":50000000,"status":{"pending":[]}}]'
```

### Approving & Releasing a Milestone

```bash
# Step 1: Verifier approves Milestone 0
soroban contract invoke \
  --id <MILESTONE_CONTRACT_ID> \
  --source VERIFIER_SECRET_KEY \
  -- \
  approve_milestone \
  --escrow_id 1 \
  --milestone_index 0

# Step 2: Beneficiary claims funds for Milestone 0
soroban contract invoke \
  --id <MILESTONE_CONTRACT_ID> \
  --source BENEFICIARY_SECRET_KEY \
  -- \
  release_milestone \
  --escrow_id 1 \
  --milestone_index 0
```

---

## Cross-References

- **`vesting_escrow`**: Provides time-based vesting, whereas `milestone_escrow` provides performance-based verification.
- **`bulk_payment`**: Can trigger batch escrow creation for project teams.
- **`orgusd`**: Supported as escrow token asset.
