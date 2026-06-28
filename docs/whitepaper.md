# PayD Protocol — Technical Whitepaper

**Version:** 1.0.0
**Date:** 2026
**License:** MIT

---

## Abstract

PayD is a decentralized cross-border payroll protocol built on the Stellar network and Soroban smart contract platform. It replaces legacy correspondent-banking rails with on-chain settlement, reducing international payment latency from 2–5 business days to sub-5 seconds while cutting transfer fees from 5–15% to a fraction of a cent. This document describes the protocol architecture, smart contract design, token model, and security properties.

---

## 1. Problem Statement

Traditional international payroll suffers from four structural deficiencies:

| Problem | Impact |
|---|---|
| Correspondent-bank chains | 2–5 day settlement windows |
| SWIFT + intermediary fees | 5–15% per transfer |
| Opaque FX conversion | Unpredictable effective rates |
| No cryptographic proof | Disputes require manual reconciliation |

These costs are disproportionately borne by workers in emerging markets who rely on cross-border employment. PayD eliminates each category through on-chain settlement and programmable disbursement logic.

---

## 2. Network Layer — Stellar

PayD is deployed on Stellar because it provides:

- **~3–5 second finality** — deterministic, single-round consensus (SCP)
- **~$0.00001 per operation** — negligible transaction cost at scale
- **Native multi-asset support** — custom asset issuance without ERC-20 overhead
- **Anchor ecosystem** — SEP-006/SEP-024 compliant on/off ramps for 100+ fiat corridors
- **Soroban** — a WASM smart contract VM for programmable payment logic

### 2.1 Stellar Consensus Protocol (SCP)

SCP is a federated Byzantine agreement protocol. Each node defines a *quorum slice* — a subset of peers it trusts. Safety is guaranteed when quorum slices overlap sufficiently; liveness depends on quorum intersection properties across the network. PayD relies on Stellar's public network with Tier-1 validators (SDF, Lobstr, Blockdaemon, etc.) for finality guarantees.

---

## 3. Asset Model

Each organization deploying PayD issues an **organization-scoped stable asset** (e.g. `ORGXUSD`) backed 1:1 with a reference currency held in a regulated custodian account.

```
Employer (funder)
    │
    │  fund(amount)
    ▼
Distribution Account  ──── trustline ──── Employee Wallet
    │
    │  bulk_payment / vesting_escrow
    ▼
Stellar Network  ──── anchor ──── Local Bank / Mobile Money
```

### 3.1 Trustlines

Employees must establish a Stellar *trustline* to the organization asset before receiving payments. PayD's onboarding flow automates this step via a wallet deep-link.

### 3.2 Anchors (SEP-006 / SEP-024)

Anchors are regulated entities that convert Stellar assets to local fiat. PayD integrates anchor APIs at the employee portal layer; the smart contracts are anchor-agnostic — they only deal with on-chain asset transfers.

---

## 4. Smart Contract Architecture

All PayD contracts are written in Rust targeting the Soroban WASM VM. They share common patterns:

- **Persistent storage** for long-lived state (configurations, balances)
- **Temporary storage** for short-lived batch records
- **`require_auth()`** guards on every state-mutating entry point
- **TTL extension** to prevent ledger archival of active contract state
- **Ledger-sequence replay protection** to prevent duplicate execution

### 4.1 BulkPayment Contract

Handles payroll disbursement to up to 100 employees per transaction envelope.

**Entry points:**

| Function | Description |
|---|---|
| `initialize(admin)` | Sets contract admin; callable once |
| `execute_batch(sender, token, payments, seq)` | All-or-nothing batch; reverts on any invalid amount |
| `execute_batch_partial(sender, token, payments, seq)` | Best-effort batch; skips invalid entries |
| `execute_batch_v2(…, all_or_nothing)` | Unified entry with per-payment `PaymentEntry` records |
| `refund_failed_payment(batch_id, idx)` | Returns held funds for a `Failed` entry to the sender |
| `set_account_limits(account, daily, weekly, monthly)` | Admin-configurable spend limits per account |
| `set_paused(paused)` | Circuit breaker — suspends all batch operations |

**Event log (issue #161):**

| Event topic | Payload | Emitted when |
|---|---|---|
| `batch_executed` | `batch_id, total_sent` | All-or-nothing batch succeeds |
| `batch_partial` | `batch_id, success_count, fail_count` | Partial batch completes |
| `payment` | `recipient, amount` | Individual payment is sent |
| `skipped` | `recipient, amount` | Individual payment is skipped |
| `bonus` | `category, recipient, amount` | Bonus-category payment is sent |
| `refund` | `batch_id, idx, sender, amount` | Failed payment is refunded |
| `paused` | `paused, admin` | Contract is paused or unpaused |
| `limits` | `account, daily, weekly, monthly` | Account limits are updated |

**Sequence number management:**
Every batch call takes an `expected_sequence` parameter. The contract stores a monotonically incrementing counter and rejects calls where `expected_sequence ≠ current`. This prevents concurrent submissions from racing on the same nonce.

**Rate limiting:**
Per-account daily/weekly/monthly caps are enforced using ledger-count windows (1 day ≈ 17,280 ledgers at 5s close time). A cap of `0` means unlimited.

### 4.2 VestingEscrow Contract

Holds salary in on-chain escrow and releases it according to a programmable vesting schedule. Designed for contractor grants, executive salary, and team token distributions.

**Vesting model:**

```
Amount
  │                                   ┌──────────── total_amount
  │                               ╱
  │                           ╱
  │                       ╱
  │                   ╱
  │               ╱
  │  0 vested  ╱  linear vesting after cliff
  │           │
  ├───────────┼───────────────────────────────── time
         cliff_seconds               start + duration_seconds
```

- **Cliff:** No tokens vest before `start_time + cliff_seconds`. At the cliff, `cliff_seconds / duration_seconds * total_amount` immediately becomes claimable.
- **Linear vesting:** After the cliff, tokens vest proportionally to time elapsed.
- **Clawback:** The `clawback_admin` can terminate the grant at any time. Vested tokens remain claimable by the beneficiary; unvested tokens are returned to the admin.

**Entry points:**

| Function | Description |
|---|---|
| `initialize(funder, beneficiary, token, start_time, cliff_seconds, duration_seconds, amount, clawback_admin)` | Fund and configure the escrow; callable once |
| `claim()` | Beneficiary withdraws all currently claimable tokens |
| `clawback()` | Admin terminates grant; returns unvested portion |
| `get_vested_amount()` | Query total vested (including already-claimed) |
| `get_claimable_amount()` | Query unclaimed vested balance |
| `get_config()` | Read full `VestingConfig` |

**Events emitted:**

| Event | Key fields | Emitted on |
|---|---|---|
| `vesting_initialized` | `beneficiary, token, total_amount, cliff_seconds, duration_seconds, start_time` | Successful `initialize` |
| `tokens_claimed` | `beneficiary, amount, total_claimed` | Successful `claim` with `claimable > 0` |
| `clawback_executed` | `clawback_admin, unvested_returned, vested_remaining` | Successful `clawback` |

**Replay protection:**
`claim` and `clawback` record the last processed ledger sequence. A second call in the same ledger sequence panics, preventing transaction-resubmission exploits.

### 4.3 CrossAssetPayment Contract

Performs path-payment swaps (Stellar's built-in DEX routing) before disbursement. Useful when the employer holds USDC but employees need local stable assets.

### 4.4 RevenueSplit Contract

Distributes incoming payments to a fixed list of recipients at predefined percentage shares. Used for contractor pools and DAO treasury splits.

---

## 5. Security Model

### 5.1 Authorization

Every externally-callable entry point that mutates state calls `address.require_auth()`. Soroban enforces that the authorization is provided in the transaction's auth envelope — there is no implicit `msg.sender` as in EVM.

### 5.2 Overflow Protection

All arithmetic uses checked operations (`checked_add`, `checked_mul`, `checked_div`) and returns an error on overflow rather than wrapping.

### 5.3 Replay / Double-Execution Protection

- **Batch contracts:** Global sequence counter + per-sender last-ledger tracking
- **Vesting contract:** Per-operation last-ledger tracking (`LastClaimLedger`, `LastClawbackLedger`)

### 5.4 Circuit Breaker

`BulkPayment` includes an admin-controlled pause flag. When paused, all `execute_batch*` calls return `ContractPaused`. Administrative functions remain accessible so the admin can investigate and resume.

### 5.5 TTL / Archival Risk

Soroban ledger entries expire. PayD contracts extend TTL on every write and expose a `bump_ttl()` admin function for proactive renewal of idle contracts.

---

## 6. Off-Chain Components

### 6.1 Backend API

A Node.js/TypeScript REST service that:
- Manages employee records and wallet mappings
- Schedules recurring payroll runs
- Submits signed transactions to Horizon
- Indexes emitted contract events into a PostgreSQL ledger

### 6.2 Frontend Dashboard

A React/TypeScript SPA that provides:
- Employer payroll management (add/remove employees, CSV upload)
- Real-time batch status tracking via WebSocket
- Employee payment history and anchor withdrawal flows
- Gamification layer (XP, levels) to incentivize on-time repayment in lending scenarios

### 6.3 Event Indexer

Polls Horizon `/transactions` and `/effects` endpoints, decodes Soroban `contractEvents`, and writes structured records to the database. Drives analytics dashboards and webhook notifications.

---

## 7. Protocol Flow

### 7.1 Standard Monthly Payroll

```
1. Employer approves ORGXUSD allowance to BulkPayment contract
2. Backend builds Vec<PaymentOp> from employee database
3. Backend signs and submits execute_batch_v2(all_or_nothing=true)
4. Soroban: validates all amounts, transfers sender → each recipient
5. Contract emits PaymentSentEvent per recipient + BatchExecutedEvent
6. Indexer picks up events; dashboard updates in real time
7. Employees receive ORGXUSD; optionally withdraw via anchor to local bank
```

### 7.2 Contractor Vesting Grant

```
1. HR initializes VestingEscrow with 12-month duration, 3-month cliff
2. Contractor's address set as beneficiary; HR org as clawback_admin
3. On cliff date: contractor calls claim(); receives 3/12 of grant
4. Monthly thereafter: contractor calls claim(); receives proportional slice
5. If contractor leaves early: HR calls clawback(); unvested returned to org
```

---

## 8. Compliance Considerations

- All on-chain transfers are publicly auditable on Stellar's ledger
- Organizations are responsible for KYC/AML on the employer side
- Anchor partners handle KYC/AML for the employee fiat off-ramp
- PayD contracts do not custody fiat; they only move on-chain assets
- The MIT license permits commercial use without restriction

---

## 9. Roadmap

| Milestone | Description |
|---|---|
| v1.0 | BulkPayment + VestingEscrow + REST API + React dashboard |
| v1.1 | Multi-currency path payments via CrossAssetPayment |
| v1.2 | Revenue split contract + DAO treasury integration |
| v2.0 | Multi-tenant organizations, RBAC, audit log export |

---

## 10. References

- [Stellar Developer Docs](https://developers.stellar.org)
- [Soroban Smart Contracts](https://soroban.stellar.org)
- [SEP-006: Deposit and Withdrawal API](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0006.md)
- [SEP-024: Hosted Deposit and Withdrawal](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md)
- [SEP-034: Contract Metadata](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0034.md)
- [Stellar Consensus Protocol (SCP)](https://www.stellar.org/papers/stellar-consensus-protocol)
