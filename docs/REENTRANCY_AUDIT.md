# Cross-Contract Call Safety / Reentrancy Audit (#1581)

Scope: every external token call (`token::Client::transfer`) in `contracts/`.

## Background

Soroban's host rejects a contract re-entering a contract that is already on the call stack, so classic EVM-style reentrancy is not directly exploitable. State ordering still matters: a token contract we call is untrusted code, and defence in depth says to follow **checks-effects-interactions** (CEI): validate, write state, then make the external call.

## Findings

| Contract | Function | Order | Result |
| --- | --- | --- | --- |
| `vesting_escrow` | claim | `claimed_amount` stored, then transfer | Safe |
| `milestone_escrow` | release milestone | released amount and `is_active` stored, then transfer | Safe |
| `bulk_payment` | `execute_scheduled_batch` | status check `Pending`, transfers, then status set `Executed` | Hardening candidate: status is written after the transfer loop. Not exploitable under Soroban's reentrancy rule, but should move before the loop |
| `bulk_payment` | batch execution paths | pull funds, loop transfers, refund remainder, record usage | No per-recipient state depends on a callee, accounting is local; reviewed, no change |
| `cross_asset_payment` | release payment | transfer, then status set `complete` | **Fixed in this PR**: status now written before the transfer |
| `cross_asset_payment` | refund payment | transfer, then status set `failed` | **Fixed in this PR**: status now written before the transfer |
| `asset_path_payment` | deposit / payout | single transfer, no dependent state written afterwards | Safe |

## Changes made

`cross_asset_payment` release and refund now persist the terminal payment status before calling the token contract. A failed transfer still reverts the whole invocation, so behaviour is unchanged for callers.

## Follow-ups

- Move the `Executed` status write in `bulk_payment::execute_scheduled_batch` ahead of the transfer loop.
- Keep allow-listing token contracts where the asset set is known.
