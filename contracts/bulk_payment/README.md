# Bulk Payment Contract

Soroban contract for payroll-sized batch payments with per-account spending limits, scheduling, partial failure recovery, and maintenance controls.

## Maintenance And Stability

- `set_throttle_config(max_batch_size, min_ledger_gap)` lets the admin reduce the maximum batch size below the protocol ceiling of 100 and require a minimum ledger gap between submissions by the same sender.
- `get_throttle_config()` returns the active throttle settings.
- `estimate_batch_fee(payment_count, base_fee_stroops, fee_bump_required)` returns a deterministic fee budget for off-chain callers using Horizon or transaction simulation fee data. The contract does not fetch Horizon directly.
- Same-ledger replay protection remains active for all batch execution paths.

## Public Functions

| Function | Description |
|---|---|
| `initialize(admin)` | Initializes admin, sequence counters, and default throttle settings. |
| `set_admin(new_admin)` | Transfers admin authority. |
| `bump_ttl()` | Extends TTL for critical persistent keys. |
| `set_paused(paused)` | Pauses or resumes batch execution. |
| `is_paused()` | Returns the pause state. |
| `set_default_limits(daily, weekly, monthly)` | Sets default spending limits. |
| `set_account_limits(account, daily, weekly, monthly)` | Sets account-specific limits. |
| `remove_account_limits(account)` | Removes an account limit override. |
| `get_account_limits(account)` | Reads effective account limits. |
| `get_account_usage(account)` | Reads current rolling usage counters. |
| `set_throttle_config(max_batch_size, min_ledger_gap)` | Updates global batch throttling. |
| `get_throttle_config()` | Reads global batch throttling. |
| `estimate_batch_fee(payment_count, base_fee_stroops, fee_bump_required)` | Estimates batch fee and budget in stroops. |
| `execute_batch(sender, token, payments, expected_sequence)` | Executes all-or-nothing batch payments. |
| `execute_batch_partial(sender, token, payments, expected_sequence)` | Best-effort batch payments. Returns `BatchPartialResult` with a `failures` list of `(index, amount, reason)` for skipped entries. |
| `execute_batch_v2(sender, token, payments, expected_sequence, all_or_nothing)` | Executes tracked batch payments with per-payment status. |
| `refund_failed_payment(batch_id, payment_index)` | Refunds a failed v2 payment entry. |
| `schedule_batch(sender, token, payments, execute_after_ledger)` | Escrows and schedules a future batch. |
| `execute_scheduled_batch(scheduled_id)` | Executes a ready scheduled batch. |
| `cancel_scheduled_batch(sender, scheduled_id)` | Cancels a pending scheduled batch and refunds escrow. |
| `get_scheduled_batch(scheduled_id)` | Reads scheduled batch state. |
| `get_payment_entry(batch_id, payment_index)` | Reads a per-payment status entry. |
| `get_sequence()` | Reads replay sequence counter. |
| `get_batch(batch_id)` | Reads batch summary. |
| `get_batch_count()` | Reads total batch count. |
| `get_last_batch_ledger(sender)` | Reads the sender's last batch ledger. |

## Testing

```bash
cargo test -p bulk_payment
cargo clippy -p bulk_payment --all-targets --all-features -- -D warnings
```
