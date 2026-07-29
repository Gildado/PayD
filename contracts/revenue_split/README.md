# Revenue Split Contract (`revenue_split`)

The **Revenue Split Contract** distributes incoming revenue or payments among configured stakeholders based on basis-point percentages. It features asset allowlisting, remainder absorption for precision, cumulative tracking, and emergency pause controls.

---

## Purpose

Automating revenue sharing (e.g. platform fee splits, partner royalty distributions, dividend payments) requires deterministic basis-point calculations:
- Shares are configured using basis points (where 10,000 basis points = 100%).
- The final recipient in the configuration automatically absorbs any rounding remainders, ensuring zero dust is left behind.
- Optional supported-asset allowlisting restricts distributions to verified tokens.
- Circuit breaker pause state halts distributions during emergency maintenance.

---

## Interface

### Public Functions

| Function | Parameters | Return Type | Access Control | Description |
|---|---|---|---|---|
| `name` | `env: Env` | `String` | Public | Returns contract name (`revenue_split`). |
| `version` | `env: Env` | `String` | Public | Returns contract version string (SEP-0034). |
| `author` | `env: Env` | `String` | Public | Returns package author metadata. |
| `init` | `env: Env, admin: Address, shares: Vec<RecipientShare>` | `Result<(), RevenueSplitError>` | Public (Once) | Initializes contract admin and recipient shares configuration. |
| `get_admin` | `env: Env` | `Result<Address, RevenueSplitError>` | Public | Returns current admin address. |
| `get_recipients` | `env: Env` | `Vec<RecipientShare>` | Public | Reads current recipient shares configuration. |
| `preview_distribution` | `env: Env, amount: i128` | `Result<Vec<DistributionPreview>, RevenueSplitError>` | Public | Previews calculated disbursement amounts without state changes. |
| `set_admin` | `env: Env, new_admin: Address` | `Result<(), RevenueSplitError>` | Admin Auth | Updates contract administrator. |
| `update_recipients` | `env: Env, new_shares: Vec<RecipientShare>` | `Result<(), RevenueSplitError>` | Admin Auth | Replaces recipient basis-point allocation. |
| `set_paused` | `env: Env, paused: bool` | `Result<(), RevenueSplitError>` | Admin Auth | Engages or disengages emergency circuit breaker. |
| `is_paused` | `env: Env` | `bool` | Public | Returns `true` if contract is currently paused. |
| `get_distribution_count` | `env: Env` | `u64` | Public | Returns total count of completed distributions. |
| `add_supported_asset` | `env: Env, token: Address` | `Result<(), RevenueSplitError>` | Admin Auth | Adds a token address to the distribution allowlist. |
| `remove_supported_asset` | `env: Env, token: Address` | `Result<(), RevenueSplitError>` | Admin Auth | Removes a token address from the allowlist. |
| `get_supported_assets` | `env: Env` | `Vec<Address>` | Public | Reads list of allowed token assets. |
| `is_asset_supported` | `env: Env, token: Address` | `bool` | Public | Checks if a token asset is eligible for distribution. |
| `distribute` | `env: Env, token: Address, from: Address, amount: i128` | `Result<(), RevenueSplitError>` | Sender Auth | Distributes `amount` of `token` from `from` across recipients. |
| `get_last_distribute_ledger` | `env: Env` | `u32` | Public | Reads ledger sequence of last distribution execution. |
| `get_total_distributed` | `env: Env, token: Address` | `i128` | Public | Reads cumulative total distributed for a specific token. |
| `bump_ttl` | `env: Env` | `Result<(), RevenueSplitError>` | Admin Auth | Bumps TTL for persistent contract state. |

---

## Storage Layout

State is maintained in Soroban `Instance` and `Persistent` storage.

| Key | Storage Domain | Value Type | Description / Key Pattern |
|---|---|---|---|
| `DataKey::Admin` | Persistent | `Address` | Contract administrator address. |
| `DataKey::Recipients` | Persistent | `Vec<RecipientShare>` | Configured recipient addresses and basis points. |
| `DataKey::LastDistributeLedger` | Persistent | `u32` | Last ledger sequence in which a distribution was processed. |
| `DataKey::TotalDistributed(Address)` | Persistent | `i128` | Cumulative amount distributed per token contract address. |
| `DataKey::Paused` | Instance | `bool` | Emergency circuit breaker pause flag. |
| `DataKey::DistributionCount` | Persistent | `u64` | Total completed distribution counter. |
| `DataKey::SupportedAssets` | Persistent | `Vec<Address>` | Allowlist of supported token contract addresses. |

---

## Security Considerations

1. **Share Validation (`TOTAL_BASIS_POINTS = 10,000`)**:
   - `validate_shares` asserts that total basis points equal exactly 10,000.
   - Rejects duplicate recipients (`DuplicateRecipient`) and zero-point allocations (`ZeroBasisPoints`).
   - Uses `checked_add` to prevent overflow manipulation of `u32` totals (`ShareOverflow`).
2. **Precision & Remainder Handling**:
   - `build_distribution_preview` calculates each share as `(amount * basis_points) / 10000`.
   - The last recipient absorbs any division remainder to prevent dust accumulating in the contract.
3. **Replay Protection**:
   - `require_unique_ledger` enforces that only one distribution can be executed per ledger sequence (`LedgerReplayDetected`).
4. **Allowlist Policy**:
   - An empty `SupportedAssets` list allows any token asset (open policy). Once assets are added, unlisted assets are rejected with `UnsupportedAsset`.

---

## Usage Examples

### Initializing Revenue Split (`Soroban CLI`)

```bash
soroban contract invoke \
  --id <REVENUE_SPLIT_CONTRACT_ID> \
  --source ADMIN_SECRET_KEY \
  -- \
  init \
  --admin <ADMIN_ADDRESS> \
  --shares '[{"destination":"<FOUNDER_1>","basis_points":6000},{"destination":"<FOUNDER_2>","basis_points":4000}]'
```

### Executing a Distribution

```bash
soroban contract invoke \
  --id <REVENUE_SPLIT_CONTRACT_ID> \
  --source SENDER_SECRET_KEY \
  -- \
  distribute \
  --token <ORGUSD_TOKEN_ADDRESS> \
  --from <SENDER_ADDRESS> \
  --amount 100000000
```

---

## Cross-References

- **`orgusd`**: Common token distributed via revenue splits.
- **`bulk_payment`**: Can feed payment batches into revenue split contracts.
