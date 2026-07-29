# Cross-Asset Payment Contract (`cross_asset_payment`)

The **Cross-Asset Payment Contract** facilitates cross-border and multi-currency payroll disbursements on Stellar / Soroban. Senders escrow a source asset into the contract, which anchors and off-chain routing services convert into a target asset for the final recipient.

---

## Purpose

Cross-border payouts often involve foreign exchange conversions where source assets (e.g., USDC or XLM) must be converted into local fiat-backed tokens (e.g., ORGUSD, ARS, or BRL) via off-chain anchors or DEX liquidity. The `cross_asset_payment` contract:
- Escrows source tokens safely upon payment initiation.
- Enables two-step admin transfers to prevent accidental loss of governance.
- Manages strict status lifecycle transitions (`pending` → `process` → `complete` / `failed`).
- Releases escrowed funds to recipients upon successful conversion or refunds senders if off-chain fulfillment fails.
- Features emergency circuit breaker pause controls.

---

## Interface

### Public Functions

| Function | Parameters | Return Type | Access Control | Description |
|---|---|---|---|---|
| `name` | `env: Env` | `String` | Public | Returns human-readable contract name (`cross_asset_payment`). |
| `version` | `env: Env` | `String` | Public | Returns contract version string (SEP-0034). |
| `author` | `env: Env` | `String` | Public | Returns package author metadata. |
| `init` | `env: Env, admin: Address` | `Result<(), CrossAssetPaymentError>` | Public (Once) | Initializes admin address and resets payment counter. |
| `bump_ttl` | `env: Env` | `()` | Admin | Extends TTL for persistent administrative state keys. |
| `propose_admin_transfer` | `env: Env, new_admin: Address` | `()` | Admin | Step 1 of two-step admin handoff; proposes `new_admin`. |
| `accept_admin_transfer` | `env: Env, new_admin: Address` | `Result<(), CrossAssetPaymentError>` | Proposed Admin | Step 2 of two-step admin handoff; caller becomes new admin. |
| `cancel_admin_transfer` | `env: Env` | `()` | Admin | Cancels pending admin transfer proposal. |
| `get_pending_admin` | `env: Env` | `Option<Address>` | Public | Returns pending admin address if a proposal exists. |
| `set_paused` | `env: Env, paused: bool` | `Result<(), CrossAssetPaymentError>` | Admin | Engages or disengages emergency circuit breaker. |
| `is_paused` | `env: Env` | `bool` | Public | Returns `true` if contract is currently paused. |
| `initiate_payment` | `env: Env, from: Address, amount: i128, asset: Address, receiver_id: String, target_asset: String, anchor_id: String` | `Result<u64, CrossAssetPaymentError>` | Sender Auth | Escrows source asset into contract and creates pending payment record. |
| `update_status` | `env: Env, payment_id: u64, new_status: Symbol` | `Result<(), CrossAssetPaymentError>` | Admin | Updates status symbol adhering to state machine transition rules. |
| `complete_payment` | `env: Env, admin: Address, payment_id: u64, recipient: Address` | `Result<(), CrossAssetPaymentError>` | Admin Auth | Releases escrowed source asset to recipient upon off-chain conversion completion. |
| `fail_payment` | `env: Env, admin: Address, payment_id: u64` | `Result<(), CrossAssetPaymentError>` | Admin Auth | Marks payment as failed and returns escrowed source asset to sender. |
| `get_payment` | `env: Env, payment_id: u64` | `Option<PaymentRecord>` | Public | Reads stored payment record by ID. |
| `get_payment_count` | `env: Env` | `u64` | Public | Reads total count of initiated payment records. |
| `get_last_payment_ledger` | `env: Env, sender: Address` | `u32` | Public | Reads ledger sequence of sender's last initiated payment. |

---

## Storage Layout

The contract manages state in `Persistent` storage with explicit TTL extensions.

| Key | Storage Domain | Value Type | Description / Key Pattern |
|---|---|---|---|
| `DataKey::Admin` | Persistent | `Address` | Active contract admin address. |
| `DataKey::PendingAdmin` | Persistent | `Address` | Nominated admin address awaiting acceptance. |
| `DataKey::PaymentCount` | Persistent | `u64` | Global counter for payment IDs. |
| `DataKey::Payment(u64)` | Persistent | `PaymentRecord` | Contains sender, amount, source asset, routing IDs, and status. |
| `DataKey::LastPaymentLedger(Address)` | Persistent | `u32` | Last ledger sequence in which sender initiated a payment. |
| `DataKey::Paused` | Persistent | `bool` | Emergency circuit breaker flag. |

### TTL Maintenance Strategy
- Persistent administrative keys (`Admin`, `PendingAdmin`, `PaymentCount`, `Paused`) are extended to `PERSISTENT_TTL_EXTEND_TO` (120,000 ledgers).
- Individual `PaymentRecord` keys are extended to `PAYMENT_TTL_EXTEND_TO` (1,500,000 ledgers ~90 days) on read/write.

---

## Security Considerations

1. **Two-Step Admin Transfer**:
   - Transferring administrative authority requires `propose_admin_transfer` followed by explicit `accept_admin_transfer` by the proposed address. This prevents governance lockouts caused by typos.
2. **State Machine Validation**:
   - `pending` → `process`, `complete`, `failed`
   - `process` → `complete`, `failed`
   - `complete` & `failed` are terminal. Further transitions return `InvalidStatusTransition`.
3. **Circuit Breaker (`Paused` flag)**:
   - When paused, `initiate_payment`, `update_status`, `complete_payment`, and `fail_payment` are rejected with `ContractPaused`.
4. **Replay Protection**:
   - Senders cannot initiate multiple payments in the same ledger sequence (`LedgerReplayDetected`).
5. **Admin Auth Assertion**:
   - `complete_payment` and `fail_payment` enforce caller auth *before* checking state transitions to ensure unauthorized callers receive permission errors immediately.

---

## Usage Examples

### Initiating a Cross-Asset Payment (`Soroban CLI`)

```bash
soroban contract invoke \
  --id <CROSS_ASSET_CONTRACT_ID> \
  --source SENDER_SECRET_KEY \
  -- \
  initiate_payment \
  --from <SENDER_ADDRESS> \
  --amount 100000000 \
  --asset <USDC_TOKEN_ADDRESS> \
  --receiver_id "user_latam_99" \
  --target_asset "ARS" \
  --anchor_id "anchor_anchor_usd"
```

### Completing Payment & Releasing Funds

```bash
soroban contract invoke \
  --id <CROSS_ASSET_CONTRACT_ID> \
  --source ADMIN_SECRET_KEY \
  -- \
  complete_payment \
  --admin <ADMIN_ADDRESS> \
  --payment_id 1 \
  --recipient <RECIPIENT_ADDRESS>
```

---

## Cross-References

- **`bulk_payment`**: Interoperates for batch cross-asset payouts.
- **`asset_path_payment`**: Provides direct on-chain DEX path swaps as an alternative to off-chain anchor conversion.
- **`orgusd`**: Serves as a target stable asset for cross-border payroll settlement.
