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
| `DataKey::Payment(u64)` | Temporary | `PathPaymentRecord` | Temporary payment record indexed by `payment_id`. |

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
