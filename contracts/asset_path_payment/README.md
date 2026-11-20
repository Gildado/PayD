# Asset Path Payment Contract (`asset_path_payment`)

The **Asset Path Payment Contract** enables multi-hop, cross-asset path payments on Stellar / Soroban with strict slippage protection, escrowed execution, and circuit breaker maintenance controls.

---

## Purpose

Executing cross-asset payments directly on-chain via liquidity pools or orderbooks requires slippage protection to guarantee that destination accounts receive at least their minimum acceptable token amount:
- **Slippage Protection**: Enforces `dest_min_amount` and `maximum_source_amount` limits.
- **Escrow Settlement**: Escrows source tokens during off-chain path routing and releases or refunds upon completion/failure.
- **Error Tracking**: Records explicit error codes and messages for partial or complete failures.
- **Circuit Breaker**: Halts path payment initiation and settlement during maintenance.

---

## Interface

### Public Functions

| Function | Parameters | Return Type | Access Control | Description |
|---|---|---|---|---|
| `name` | `env: Env` | `String` | Public | Returns contract name (`asset_path_payment`). |
| `version` | `env: Env` | `String` | Public | Returns contract version string (SEP-0034). |
| `author` | `env: Env` | `String` | Public | Returns package author metadata. |
| `init` | `env: Env, admin: Address` | `()` | Public (Once) | Initializes contract administrator and payment counter. |
| `bump_ttl` | `env: Env` | `()` | Admin Auth | Extends TTL for persistent administrative state. |
| `set_paused` | `env: Env, paused: bool` | `Result<(), PathPaymentError>` | Admin Auth | Engages or disengages emergency circuit breaker. |
| `is_paused` | `env: Env` | `bool` | Public | Returns `true` if contract is currently paused. |
| `initiate_path_payment` | `env: Env, from: Address, to: Address, source_asset: Address, dest_asset: Address, source_amount: i128, dest_min_amount: i128, maximum_source_amount: i128, path: Vec<Address>` | `Result<u64, PathPaymentError>` | Sender Auth | Transfers source tokens to contract escrow and creates pending path payment record. |
| `complete_path_payment` | `env: Env, payment_id: u64, actual_source_amount: i128, actual_dest_amount: i128` | `Result<(), PathPaymentError>` | Admin Auth | Completes path payment, verifies slippage, and updates payment record. |
| `fail_path_payment` | `env: Env, payment_id: u64, error_code: u32, error_message: String, partial_failure: bool` | `Result<(), PathPaymentError>` | Admin Auth | Marks path payment as failed with diagnostic error details. |
| `get_payment` | `env: Env, payment_id: u64` | `Option<PathPaymentRecord>` | Public | Reads path payment record by ID. |
| `get_payment_count` | `env: Env` | `u64` | Public | Reads total count of initiated path payments. |
| `withdraw` | `env: Env, asset: Address, amount: i128, to: Address` | `Result<(), PathPaymentError>` | Admin Auth | Admin function to withdraw escrowed tokens for refund settlement. |

---

## Storage Layout

State is maintained in `Persistent` and `Temporary` storage domains.

| Key | Storage Domain | Value Type | Description / Key Pattern |
|---|---|---|---|
| `DataKey::Admin` | Persistent | `Address` | Contract administrator address. |
| `DataKey::PaymentCount` | Persistent | `u64` | Global counter for path payment IDs. |
| `DataKey::Paused` | Persistent | `bool` | Emergency circuit breaker pause flag. |
| `DataKey::Payment(u64)` | Persistent | `PathPaymentRecord` | Payment record indexed by `payment_id` (Issue #1589: moved from Temporary to Persistent for long-term audit trail). |

### TTL Maintenance Strategy (Issue #1589)
- Administrative keys (`Admin`, `PaymentCount`, `Paused`) use `PERSISTENT_TTL_EXTEND_TO` (120,000 ledgers).
- Individual `Payment(u64)` records are extended to `PAYMENT_TTL_EXTEND_TO` (1,500,000 ledgers ~21 days at 12s/ledger).
  - **Rationale**: Path execution may require coordination time; off-chain indexers require persistent records for complete audit trail.
  - **Changed from Temporary (20K ledger TTL)**: Previous temporary storage risked expiring payment records before completion and breaking indexer continuity.

---

## Replay-Attack Protection (Issue #1600)

The contract prevents same-ledger replay attacks on path payment initiation:

### Protection Mechanism
- A `LastPaymentLedger(Address)` key tracks the ledger sequence of each sender's most recent `initiate_path_payment()` call.
- Before creating a new payment, the contract checks: `if last_ledger == current_ledger { return LedgerReplayDetected }`.
- The protection is **per-sender**: different senders can initiate payments in the same ledger without conflict.

### Attack Scenario Prevented
An attacker cannot submit two `initiate_path_payment` calls from the same address in the same Stellar ledger, which would:
1. Escrow funds twice in quick succession.
2. Potentially confuse off-chain backend logic that processes payments sequentially.

### Cross-Ledger Safety
- Multiple payments from the same sender in different ledgers are allowed.
- Multiple payments from different senders in the same ledger are allowed.
- Only same-sender, same-ledger attempts are rejected.

### Test Coverage
The contract includes comprehensive replay-attack tests:
- **Same-Ledger Sender Replay**: Verifies that duplicate initiations from the same sender in one ledger are rejected.
- **Cross-Ledger Operations**: Confirms that the same sender can initiate multiple payments across different ledgers.
- **Multi-Sender Same-Ledger**: Ensures different senders can safely initiate payments concurrently in the same ledger.

---

## Price-Manipulation Resistance (Issue #1593)

The contract is hardened against price-manipulation attacks through the following mechanisms:

### Stored Minimum Enforcement
- The `dest_min_amount` is immutable once set at initiation; it cannot be changed between initiation and completion.
- During `complete_path_payment`, the contract enforces the **original stored minimum**, not any dynamically provided value.
- This ensures that even if market conditions move unfavorably off-chain, the caller's slippage protection remains intact.

### Zero-Minimum Prevention
- `initiate_path_payment` rejects `dest_min_amount <= 0`, preventing silent disabling of slippage protection.
- `complete_path_payment` re-checks `dest_min_amount > 0` defensively before settlement, ensuring no record can complete without an active minimum.

### Test Coverage
The following edge-case tests verify price-manipulation resistance:
- **Immutable Minimum**: Confirms that stored minimums cannot be tampered with after initiation.
- **Zero-Minimum Rejection**: Ensures zero or negative minimums are rejected at initiation.
- **Stored vs. Provided**: Verifies that completion enforces the stored minimum, not any new value.
- **Exact Minimum Acceptance**: Confirms that actual amounts exactly at the minimum are accepted.
- **Tight Slippage Margins**: Tests extreme slippage scenarios (1% deviation) to ensure precision under stress.

---

## Security Considerations

1. **Slippage Bounds**:
   - `maximum_source_amount` must be `>= source_amount` (`SlippageExceeded`).
   - `complete_path_payment` asserts `actual_dest_amount >= dest_min_amount`. If violated, payment is marked `failed` and returns `SlippageExceeded`.
2. **Self-Payment Prevention**:
   - `initiate_path_payment` rejects `from == to` with `SelfPayment`.
3. **Escrow Atomicity**:
   - Token transfer failure during `withdraw` or `initiate_path_payment` panics and reverts the transaction cleanly.
4. **Circuit Breaker (`Paused` state)**:
   - When paused, `initiate_path_payment`, `complete_path_payment`, `fail_path_payment`, and `withdraw` are rejected with `ContractPaused`.

---

## Usage Examples

### Initiating an Asset Path Payment (`Soroban CLI`)

```bash
soroban contract invoke \
  --id <PATH_PAYMENT_CONTRACT_ID> \
  --source SENDER_SECRET_KEY \
  -- \
  initiate_path_payment \
  --from <SENDER_ADDRESS> \
  --to <RECIPIENT_ADDRESS> \
  --source_asset <XLM_SAC_ADDRESS> \
  --dest_asset <ORGUSD_TOKEN_ADDRESS> \
  --source_amount 100000000 \
  --dest_min_amount 9800000 \
  --maximum_source_amount 105000000 \
  --path '["<USDC_TOKEN_ADDRESS>"]'
```

---

## Cross-References

- **`cross_asset_payment`**: Uses off-chain anchor bridges, while `asset_path_payment` uses on-chain path routes.
- **`orgusd`**: Target settlement asset for path conversions.
