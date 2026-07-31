# Bulk Payment Contract (`bulk_payment`)

The **Bulk Payment Contract** enables high-throughput payroll processing, employee distributions, and batch token transfers on the Stellar / Soroban network. It features flexible execution modes (strict all-or-nothing vs. resilient partial processing), per-account spending limit enforcement, automated distribution account re-funding, future batch scheduling, compressed status archiving, and administrative circuit breakers.

---

## Purpose

Payroll and recurring bulk distributions require executing hundreds of disbursements efficiently while safeguarding against double-spending, budget overruns, and network throttling. The Bulk Payment contract serves as the main disbursement engine in PayD by:
- Grouping up to 100 payments into a single atomic or partial transaction.
- Enforcing daily, weekly, and monthly spending caps per sender account.
- Supporting deferred execution for scheduled payroll batches.
- Minimizing storage footprint via bit-packed batch status maps.
- Providing emergency pause controls (circuit breaker) for administrators.

---

## Interface

### Public Functions

| Function | Parameters | Return Type | Access Control | Description |
|---|---|---|---|---|
| `name` | `env: Env` | `String` | Public | Returns the contract name (`bulk_payment`). |
| `version` | `env: Env` | `String` | Public | Returns contract version string (SEP-0034). |
| `author` | `env: Env` | `String` | Public | Returns package author metadata. |
| `initialize` | `env: Env, admin: Address` | `Result<(), ContractError>` | Public (Once) | Sets contract admin, resets batch counters and throttle defaults. |
| `set_admin` | `env: Env, new_admin: Address` | `Result<(), ContractError>` | Admin | Transfers admin role to `new_admin`. |
| `bump_ttl` | `env: Env` | `Result<(), ContractError>` | Admin | Extends TTL for persistent administrative state keys. |
| `set_paused` | `env: Env, paused: bool` | `Result<(), ContractError>` | Admin | Engages or disengages emergency circuit breaker. |
| `is_paused` | `env: Env` | `bool` | Public | Returns `true` if the contract is paused. |
| `set_default_limits` | `env: Env, daily: i128, weekly: i128, monthly: i128` | `Result<(), ContractError>` | Admin | Configures default spending caps applied to all accounts without overrides. |
| `set_account_limits` | `env: Env, account: Address, daily: i128, weekly: i128, monthly: i128` | `Result<(), ContractError>` | Admin | Sets custom spending limits for a specific account. |
| `remove_account_limits` | `env: Env, account: Address` | `Result<(), ContractError>` | Admin | Removes custom limits, reverting account to defaults. |
| `get_account_limits` | `env: Env, account: Address` | `AccountLimits` | Public | Returns effective limit configuration for `account`. |
| `get_account_usage` | `env: Env, account: Address` | `AccountUsage` | Public | Returns current rolling spent amounts and ledger resets for `account`. |
| `set_throttle_config` | `env: Env, max_batch_size: u32, min_ledger_gap: u32` | `Result<(), ContractError>` | Admin | Configures global batch size limits and minimum ledger gaps between transactions. |
| `get_throttle_config` | `env: Env` | `ThrottleConfig` | Public | Reads current throttling rules. |
| `set_refund_config` | `env: Env, distribution_account: Address, funding_source: Address, token: Address, threshold: i128, refund_amount: i128` | `Result<(), ContractError>` | Admin | Configures automatic re-funding trigger parameters for distribution accounts. |
| `get_refund_config` | `env: Env` | `Result<RefundConfig, ContractError>` | Public | Reads auto-refund parameters. |
| `remove_refund_config` | `env: Env` | `Result<(), ContractError>` | Admin | Clears auto-refund configuration. |
| `check_and_refund` | `env: Env` | `Result<i128, ContractError>` | Public | Checks distribution balance and transfers refund from funding source if below threshold. |
| `execute_batch` | `env: Env, sender: Address, token: Address, payments: Vec<PaymentOp>, expected_sequence: u64` | `Result<u64, ContractError>` | Sender Auth | Executes an all-or-nothing batch; fails entirely if any payment is invalid. |
| `execute_batch_partial` | `env: Env, sender: Address, token: Address, payments: Vec<PaymentOp>, expected_sequence: u64` | `Result<BatchPartialResult, ContractError>` | Sender Auth | Best-effort batch payment; skips invalid operations and returns failure entries. |
| `execute_batch_v2` | `env: Env, sender: Address, token: Address, payments: Vec<PaymentOp>, expected_sequence: u64, all_or_nothing: bool` | `Result<u64, ContractError>` | Sender Auth | Primary batch entry point; records individual `PaymentEntry` records for per-payment tracking. |
| `refund_failed_payment` | `env: Env, batch_id: u64, payment_index: u32` | `Result<(), ContractError>` | Public | Returns held funds from a `Failed` payment entry back to the original batch sender. |
| `schedule_batch` | `env: Env, sender: Address, token: Address, payments: Vec<PaymentOp>, execute_after_ledger: u32` | `Result<u64, ContractError>` | Sender Auth | Pulls funds into escrow and queues batch for execution after target ledger sequence. |
| `execute_scheduled_batch` | `env: Env, scheduled_id: u64` | `Result<u64, ContractError>` | Public | Executes a queued batch once current ledger >= `execute_after_ledger`. |
| `cancel_scheduled_batch` | `env: Env, sender: Address, scheduled_id: u64` | `Result<(), ContractError>` | Sender Auth | Cancels a queued batch and returns escrowed funds to sender. |
| `get_scheduled_batch` | `env: Env, scheduled_id: u64` | `Result<ScheduledBatch, ContractError>` | Public | Reads queued batch details. |
| `archive_batch_statuses` | `env: Env, batch_id: u64` | `Result<BatchStatusMap, ContractError>` | Admin | Compresses `PaymentEntry` records into a 2-bit packed status map to optimize storage. |
| `get_archived_status` | `env: Env, batch_id: u64, payment_index: u32` | `Result<PaymentStatus, ContractError>` | Public | Queries status of a specific payment from the compressed status map. |
| `get_batch_status_map` | `env: Env, batch_id: u64` | `Result<BatchStatusMap, ContractError>` | Public | Reads full compressed status map for a batch. |
| `reduce_batch_ttl` | `env: Env, batch_id: u64` | `Result<(), ContractError>` | Admin | Adjusts persistent storage TTL on historical batch records. |
| `estimate_batch_fee` | `_env: Env, payment_count: u32, base_fee_stroops: i128, fee_bump_required: bool` | `Result<FeeEstimate, ContractError>` | Public | Calculates deterministic stroop fee estimate for batch transactions. |
| `get_payment_entry` | `env: Env, batch_id: u64, payment_index: u32` | `Result<PaymentEntry, ContractError>` | Public | Reads individual payment lifecycle state (`Pending`, `Sent`, `Failed`, `Refunded`). |
| `get_sequence` | `env: Env` | `u64` | Public | Reads global sequence counter. |
| `get_batch` | `env: Env, batch_id: u64` | `Result<BatchRecord, ContractError>` | Public | Reads high-level batch summary record. |
| `get_batch_count` | `env: Env` | `u64` | Public | Reads total count of processed batches. |
| `get_last_batch_ledger` | `env: Env, sender: Address` | `u32` | Public | Reads ledger sequence of sender's last executed batch. |

---

## Storage Layout

The contract manages state across `Instance`, `Persistent`, and `Temporary` storage domains.

| Key | Storage Domain | Value Type | Description / Key Pattern |
|---|---|---|---|
| `DataKey::Admin` | Persistent | `Address` | Contract administrator address. |
| `DataKey::BatchCount` | Persistent | `u64` | Counter for total generated batch IDs. |
| `DataKey::Sequence` | Persistent | `u64` | Strict sequence number for replay protection. |
| `DataKey::Batch(u64)` | Persistent | `BatchRecord` | Summary of batch sender, token, totals, and completion status. |
| `DataKey::AcctLimits(Address)` | Persistent | `AccountLimits` | Custom spending limits override per account address. |
| `DataKey::AcctUsage(Address)` | Persistent | `AccountUsage` | Rolling spending totals (daily, weekly, monthly) and ledger reset markers. |
| `DataKey::DefaultLimits` | Instance | `AccountLimits` | Fallback spending limits for all unconfigured accounts. |
| `DataKey::ThrottleConfig` | Instance | `ThrottleConfig` | Global batch size caps (`max_batch_size`) and min gap (`min_ledger_gap`). |
| `DataKey::Paused` | Instance | `bool` | Emergency circuit breaker state flag. |
| `DataKey::RefundConfig` | Instance | `RefundConfig` | Auto-refund trigger threshold and funding account details. |
| `DataKey::TotalBonusesPaid` | Instance | `i128` | Cumulative bonus payments tracked across all batches. |
| `DataKey::PaymentEntry(u64, u32)` | Temporary | `PaymentEntry` | Individual payment state indexed by `(batch_id, payment_index)`. |
| `DataKey::ScheduledBatch(u64)` | Persistent | `ScheduledBatch` | Queued batch record waiting for future ledger execution. |
| `DataKey::ScheduledBatchCount` | Persistent | `u64` | Counter for total scheduled batch IDs. |
| `DataKey::LastBatchLedger(Address)` | Persistent | `u32` | Last ledger sequence in which sender executed a batch. |
| `DataKey::BatchStatusMap(u64)` | Persistent | `BatchStatusMap` | Bit-packed compressed status vector (2 bits per status, 16 per u32 word). |

### TTL Maintenance Strategy
- Persistent administrative state (`Admin`, `BatchCount`, `Sequence`) is bumped on every core write using `PERSISTENT_TTL_EXTEND_TO` (~120,000 ledgers).
- Individual `PaymentEntry` records use Temporary storage (`TEMPORARY_TTL_EXTEND_TO` = 20,000 ledgers) and are pruned after archiving into `BatchStatusMap` (`ARCHIVE_TTL_EXTEND_TO` = 50,000 ledgers).

---

## Security Considerations

1. **Authentication & Authorization**:
   - `sender.require_auth()` is strictly checked for all batch submission functions.
   - Admin operations (`set_admin`, `set_paused`, limit setters) verify admin signature.
2. **Circuit Breaker (`Paused` state)**:
   - When `is_paused()` is true, all batch execution (`execute_batch*`, `schedule_batch`, `check_and_refund`) is halted. Read-only and governance functions remain operational.
3. **Replay & Throttling Protection**:
   - `require_unique_ledger` prevents multiple batch submissions within the same ledger sequence from the same sender.
   - `min_ledger_gap` enforces minimum ledger spacing between submissions.
   - `expected_sequence` asserts strict sequential processing.
4. **Limits & Cap Enforcement**:
   - Spending caps (`daily_limit`, `weekly_limit`, `monthly_limit`) are calculated on rolling ledger windows (`LEDGERS_PER_DAY` = 17,280, `LEDGERS_PER_WEEK` = 120,960, `LEDGERS_PER_MONTH` = 518,400).
5. **Fixed Refund Destination**:
   - `refund_failed_payment` *always* returns funds to `BatchRecord.sender`. This allows unauthenticated keepers to trigger refunds without risk of misdirecting assets.

---

## Usage Examples

### Executing a Batch Payment (`Soroban CLI`)

```bash
soroban contract invoke \
  --id <BULK_PAYMENT_CONTRACT_ID> \
  --source SENDER_SECRET_KEY \
  -- \
  execute_batch_v2 \
  --sender <SENDER_ADDRESS> \
  --token <SAC_TOKEN_ADDRESS> \
  --payments '[{"recipient":"<RECIP_1>","amount":10000000,"category":"salary"},{"recipient":"<RECIP_2>","amount":15000000,"category":"salary"}]' \
  --expected_sequence 0 \
  --all_or_nothing true
```

### Scheduling a Future Batch

```bash
soroban contract invoke \
  --id <BULK_PAYMENT_CONTRACT_ID> \
  --source SENDER_SECRET_KEY \
  -- \
  schedule_batch \
  --sender <SENDER_ADDRESS> \
  --token <SAC_TOKEN_ADDRESS> \
  --payments '[{"recipient":"<RECIP_1>","amount":50000000,"category":"bonus"}]' \
  --execute_after_ledger 1250000
```

---

## Cross-References

- **`orgusd`**: Used as the primary settlement asset token for USD payroll distributions.
- **`smart_wallet`**: Acts as the `admin` or `sender` multi-sig account for enterprise payroll authorization.
- **`cross_asset_payment`**: Interoperates when payroll payouts require multi-asset conversion.
