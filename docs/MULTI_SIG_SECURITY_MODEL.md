# Multi-Sig Security Model — Formal Verification (Issue #260)

> **Status**: Reviewed and verified  
> **Date**: 2026-03-25  
> **Contracts Audited**: `bulk_payment`, `revenue_split`, `vesting_escrow`, `cross_asset_payment`

## 1. Overview

This document provides a formal review of the multi-signature authorization logic across all PayD Soroban smart contracts. It maps every entry point, documents required authorization levels, and proves that no unauthorized change can be made to critical contract state.

## 2. Authorization Model

All contracts use Soroban's `require_auth()` pattern, which delegates signature verification to the Stellar host environment. When the `admin` address is a multi-sig account on Stellar, `require_auth()` inherently enforces the configured threshold and signer set — no custom multi-sig logic inside the contract is needed.

### 2.1 Key Principle

```
Address.require_auth()  →  Host checks transaction signers against
                           the Address's on-chain auth configuration
                           (single key OR multi-sig threshold/signers)
```

This means:

- **Single-key accounts**: One valid signature is required.
- **Multi-sig accounts**: The on-chain threshold (e.g., 2-of-3) must be met by the transaction's signer set.
- **Contracts**: The invoking contract's authorization tree must satisfy the requirement.

## 3. Entry Point Authorization Map

### 3.1 `bulk_payment` Contract

| Function                      | Auth Required           | Who           | Notes                                                       |
| ----------------------------- | ----------------------- | ------------- | ----------------------------------------------------------- |
| `initialize`                  | None (first-call only)  | Anyone        | Guarded by `AlreadyInitialized` — can only run once         |
| `set_admin`                   | `admin.require_auth()`  | Current admin | Transfers admin privilege                                   |
| `bump_ttl`                    | `admin.require_auth()`  | Current admin | Extends storage TTLs                                        |
| `set_paused`                  | `admin.require_auth()`  | Current admin | Circuit breaker toggle                                      |
| `is_paused`                   | None                    | Anyone        | Read-only                                                   |
| `set_default_limits`          | `admin.require_auth()`  | Current admin | Sets global spending limits                                 |
| `set_account_limits`          | `admin.require_auth()`  | Current admin | Per-account limit override                                  |
| `remove_account_limits`       | `admin.require_auth()`  | Current admin | Reverts to default limits                                   |
| `execute_batch`               | `sender.require_auth()` | Batch sender  | Also checks `require_not_paused`                            |
| `execute_batch_partial`       | `sender.require_auth()` | Batch sender  | Also checks `require_not_paused`                            |
| `execute_batch_v2`            | `sender.require_auth()` | Batch sender  | Also checks `require_not_paused`                            |
| `refund_failed_payment`       | None                    | Anyone        | Refund always goes to `BatchRecord.sender`; cannot redirect |
| `get_sequence`                | None                    | Anyone        | Read-only                                                   |
| `get_batch`                   | None                    | Anyone        | Read-only                                                   |
| `get_batch_count`             | None                    | Anyone        | Read-only                                                   |
| `get_account_limits`          | None                    | Anyone        | Read-only                                                   |
| `get_account_usage`           | None                    | Anyone        | Read-only                                                   |
| `get_payment_entry`           | None                    | Anyone        | Read-only                                                   |
| `name` / `version` / `author` | None                    | Anyone        | SEP-0034 metadata, read-only                                |

### 3.2 `revenue_split` Contract

| Function                      | Auth Required          | Who           | Notes                                          |
| ----------------------------- | ---------------------- | ------------- | ---------------------------------------------- |
| `init`                        | None (first-call only) | Anyone        | Guarded by persistent storage check            |
| `set_admin`                   | `admin.require_auth()` | Current admin |                                                |
| `update_recipients`           | `admin.require_auth()` | Current admin |                                                |
| `bump_ttl`                    | `admin.require_auth()` | Current admin |                                                |
| `distribute`                  | `from.require_auth()`  | Token sender  | The sender authorizes their own funds transfer |
| `name` / `version` / `author` | None                   | Anyone        | SEP-0034 metadata                              |

### 3.3 `vesting_escrow` Contract

| Function                      | Auth Required                   | Who            | Notes                                     |
| ----------------------------- | ------------------------------- | -------------- | ----------------------------------------- |
| `initialize`                  | `funder.require_auth()`         | Funder         | Also transfers tokens to contract         |
| `claim`                       | `beneficiary.require_auth()`    | Beneficiary    | Only the designated beneficiary can claim |
| `clawback`                    | `clawback_admin.require_auth()` | Clawback admin | Returns unvested tokens                   |
| `bump_ttl`                    | `clawback_admin.require_auth()` | Clawback admin |                                           |
| `get_*` functions             | None                            | Anyone         | Read-only                                 |
| `name` / `version` / `author` | None                            | Anyone         | SEP-0034 metadata                         |

### 3.4 `cross_asset_payment` Contract

| Function                      | Auth Required          | Who            | Notes                               |
| ----------------------------- | ---------------------- | -------------- | ----------------------------------- |
| `init`                        | None (first-call only) | Anyone         | Guarded by persistent storage check |
| `bump_ttl`                    | `admin.require_auth()` | Admin          |                                     |
| `initiate_payment`            | `from.require_auth()`  | Payment sender | Escrows tokens into contract        |
| `update_status`               | `admin.require_auth()` | Admin          |                                     |
| `get_payment`                 | None                   | Anyone         | Read-only                           |
| `get_payment_count`           | None                   | Anyone         | Read-only                           |
| `name` / `version` / `author` | None                   | Anyone         | SEP-0034 metadata                   |

## 4. Security Proofs

### 4.1 No Unauthorized Admin Changes

**Claim**: Only the current admin can modify `DataKey::Admin`.

**Proof**: The `set_admin` function in all contracts follows this pattern:

```rust
fn set_admin(env: Env, new_admin: Address) {
    let admin = env.storage().persistent().get(&DataKey::Admin).unwrap();
    admin.require_auth();  // ← enforced before any state change
    env.storage().persistent().set(&DataKey::Admin, &new_admin);
}
```

- `require_auth()` panics if the invoker cannot prove control of the admin address.
- There is no alternative code path that writes to `DataKey::Admin`.
- `initialize` is the only other writer, but it is guarded by `AlreadyInitialized`.

### 4.2 No Unauthorized Limit Changes

**Claim**: Only the admin can change `DefaultLimits`, `AcctLimits`, or `Paused` state.

**Proof**: All three mutation functions (`set_default_limits`, `set_account_limits`, `set_paused`) call `require_admin()` → `admin.require_auth()` as their first operation. The `remove_account_limits` function also calls `require_admin()`.

### 4.3 No Bypass for Paused State

**Claim**: When `Paused = true`, no payment function can execute.

**Proof**: All three payment entry points (`execute_batch`, `execute_batch_partial`, `execute_batch_v2`) call `require_not_paused()` before any other logic, including `require_auth()`. This means even an authorized sender cannot execute payments while paused.

### 4.4 Refund Safety

**Claim**: `refund_failed_payment` cannot redirect funds to an attacker.

**Proof**: The refund destination is always `BatchRecord.sender`, which is immutable (stored in temporary storage at batch creation time). The function does not accept a recipient parameter, so there is no way to redirect funds.

### 4.5 Initialization Guard

**Claim**: No contract can be re-initialized to hijack admin control.

**Proof**: All `initialize`/`init` functions check `env.storage().persistent().has(&DataKey::Admin)` and panic or return `AlreadyInitialized` if the key already exists. Since persistent storage survives across invocations, a second initialization attempt will always fail.

## 5. Edge Cases — Revoked Signatures / Expired Auth

### 5.1 Revoked Multi-Sig Signers

If an admin is a multi-sig account and a signer is removed on-chain:

- The `require_auth()` call checks the **current** on-chain signer configuration at transaction execution time.
- A removed signer cannot contribute to meeting the threshold.
- **Result**: The contract correctly rejects the operation if the threshold is no longer met.

### 5.2 Expired Authorizations

Soroban's auth framework uses `SorobanAuthorizedInvocation` entries in the transaction. These are validated at simulation time and again at submission time:

- Authorization entries reference the specific contract call and its arguments.
- Replay is prevented by Stellar's sequence number mechanism.
- **Result**: No expired or replayed authorization can succeed.

### 5.3 Admin Key Rotation During Active Batches

If the admin key is changed via `set_admin` while batches are in progress:

- Existing batch records (`BatchRecord`, `PaymentEntry`) are unaffected — they reference the sender, not the admin.
- The old admin immediately loses all administrative privileges.
- The new admin immediately gains all administrative privileges.
- **Result**: Clean handoff with no window of dual-admin control.

## 6. Recommendations

1. **Deploy admin as multi-sig account**: Use a 2-of-3 or 3-of-5 Stellar multi-sig account for the admin address to prevent single-key compromise.
2. **Monitor `paused` events**: Set up off-chain monitoring for the `ContractStatusChanged` event to detect unauthorized pause/unpause attempts.
3. **Periodic `bump_ttl` calls**: Ensure persistent storage does not expire, which could potentially allow re-initialization.
4. **Initialize immediately after deployment**: Call `initialize` in the same transaction as deployment to prevent front-running.

## 7. Test Coverage

The following test categories verify the authorization model (see `contracts/bulk_payment/src/test.rs`):

- `test_set_admin_requires_admin_auth` — confirms non-admin cannot change admin
- `test_set_default_limits_requires_admin_auth` — confirms non-admin cannot set limits
- `test_set_paused_requires_admin_auth` — confirms non-admin cannot toggle circuit breaker
- `test_execute_batch_requires_sender_auth` — confirms sender must authorize payments
- `test_set_account_limits_requires_admin_auth` — confirms non-admin cannot override limits
- `test_remove_account_limits_requires_admin_auth` — confirms non-admin cannot remove limits
- `test_bump_ttl_requires_admin_auth` — confirms non-admin cannot extend TTLs
- `test_read_only_functions_need_no_auth` — confirms read functions work without auth
- `test_initialize_twice_panics` — confirms re-initialization is blocked
