# Smart Contract Issues — PayD 🧠

This document tracks all smart contract development tasks for the **PayD** protocol.
Each issue is self-contained and can be picked up independently.

### 🛑 STRICT RULE FOR CONTRIBUTORS
**When you complete an issue:**
1. Mark the checkbox `[x]`
2. Append your GitHub username and the Date/Time.
3. **Example:** `- [x] Define Error enum (@yourname - 2026-02-18 15:00 UTC)`

---

## 🏦 Module 1: Treasury Contract — Core Setup (SC-1 to SC-3)

### Issue #SC-1: Treasury Error Constants & Validation Helpers
**Priority:** Critical
**Labels:** `smart-contract`, `good-first-issue`, `treasury`
**Description:** Review and extend the error constants defined in `contracts/treasury/src/errors.rs`.
- **Tasks:**
  - [ ] Add `InsufficientBalance` error variant (u12).
  - [ ] Add `ProposalExpired` error variant (u13).
  - [ ] Add helper function `require_initialized(env) -> Result<()>` to reduce boilerplate.
  - [ ] Write doc comments for each error explaining when it's triggered.

### Issue #SC-2: Treasury Storage TTL & Expiration
**Priority:** High
**Labels:** `smart-contract`, `storage`, `treasury`
**Description:** Add TTL (Time-to-Live) management for persistent storage entries.
- **Tasks:**
  - [ ] Implement `extend_instance_ttl(env)` with appropriate ledger bump.
  - [ ] Implement `extend_withdrawal_ttl(env, id)` for persistent withdrawal records.
  - [ ] Call TTL extension in `initialize()` and `create_withdrawal()`.

### Issue #SC-3: Treasury Config Query
**Priority:** Medium
**Labels:** `smart-contract`, `query`, `treasury`
**Description:** Implement a `get_config()` function that returns a `TreasuryConfig` snapshot.
- **Tasks:**
  - [ ] Implement `get_config(env) -> TreasuryConfig` using the struct in `types.rs`.
  - [ ] Return admin, signers, threshold, and proposal_count in one call.
  - [ ] Add unit test for `get_config`.

---

## 🏦 Module 2: Treasury Contract — Token Integration (SC-4 to SC-6)

### Issue #SC-4: Deposit — Token Transfer Integration
**Priority:** Critical
**Labels:** `smart-contract`, `integration`, `treasury`
**Description:** Complete the `deposit()` function by integrating the Soroban token client.
- **Tasks:**
  - [ ] Import `soroban_sdk::token` module.
  - [ ] Create `token::Client` and invoke `.transfer()` from depositor to contract.
  - [ ] Add a `get_balance(env, token)` query that reads the contract's token balance.
  - [ ] Add unit test: deposit and verify balance changes.

### Issue #SC-5: Execute Withdrawal — Token Transfer
**Priority:** Critical
**Labels:** `smart-contract`, `integration`, `treasury`
**Description:** Complete the `execute_withdrawal()` function with actual token transfers.
- **Tasks:**
  - [ ] Use `token::Client` to transfer from contract to `request.recipient`.
  - [ ] Verify contract has sufficient balance before transfer.
  - [ ] Emit `WithdrawalExecuted` event with amount and recipient.
  - [ ] Add unit test: full flow from deposit → create → approve → execute → verify balances.

### Issue #SC-6: Cancel Withdrawal
**Priority:** Medium
**Labels:** `smart-contract`, `logic`, `treasury`
**Description:** Implement a `cancel_withdrawal()` function.
- **Tasks:**
  - [ ] Only the original proposer or admin can cancel.
  - [ ] Can only cancel `Pending` proposals.
  - [ ] Set status to `Cancelled`.
  - [ ] Emit `WithdrawalCancelled` event.
  - [ ] Add unit test for cancellation.

---

## 🏦 Module 3: Treasury Contract — Events & Testing (SC-7 to SC-8)

### Issue #SC-7: Treasury Event Standardization
**Priority:** Medium
**Labels:** `smart-contract`, `events`, `treasury`
**Description:** Standardize all treasury events for off-chain indexing.
- **Tasks:**
  - [ ] Define consistent event topic naming: `TreasuryDeposit`, `WithdrawalCreated`, etc.
  - [ ] Include structured data in events (amount, token, addresses).
  - [ ] Create a reference document in `docs/` listing all event schemas.

### Issue #SC-8: Treasury Comprehensive Test Suite
**Priority:** High
**Labels:** `testing`, `rust`, `treasury`
**Description:** Expand the treasury test suite with edge cases.
- **Tasks:**
  - [ ] Test unauthorized withdrawal attempt (non-signer).
  - [ ] Test threshold update with boundary values.
  - [ ] Test removing signer when at threshold minimum.
  - [ ] Test double-approval by same signer rejected.
  - [ ] Test execute before approval threshold met.
  - [ ] Test invalid threshold (0 or > signers) rejected at init.

---

## 💸 Module 4: Payroll Stream — Core Logic (SC-9 to SC-11)

### Issue #SC-9: Payroll Stream — Pause & Resume
**Priority:** High
**Labels:** `smart-contract`, `logic`, `payroll`
**Description:** Implement pause and resume functionality for active streams.
- **Tasks:**
  - [ ] Add `pause_stream(env, sender, stream_id)` function.
  - [ ] Add `resume_stream(env, sender, stream_id)` function.
  - [ ] Only the sender (org) can pause/resume.
  - [ ] Update `calculate_claimable` to account for paused periods.
  - [ ] Add `paused_at: Option<u64>` field to PayrollStream struct.
  - [ ] Add `total_paused_duration: u64` field.

### Issue #SC-10: Payroll Stream — Token Transfer Integration
**Priority:** Critical
**Labels:** `smart-contract`, `integration`, `payroll`
**Description:** Wire up actual token transfers in `create_stream` and `claim`.
- **Tasks:**
  - [ ] In `create_stream`: transfer `total_amount` from sender to contract.
  - [ ] In `claim`: transfer claimable tokens from contract to recipient.
  - [ ] In `cancel_stream`: transfer remaining to sender, owed to recipient.
  - [ ] Handle edge case: stream with zero claimable on cancel.

### Issue #SC-11: Payroll Stream — Batch Stream Creation
**Priority:** Medium
**Labels:** `smart-contract`, `feature`, `payroll`
**Description:** Add a `create_batch_streams()` function for bulk payroll setup.
- **Tasks:**
  - [ ] Accept a `Vec` of stream parameters.
  - [ ] Create multiple streams in a single contract call.
  - [ ] Emit a single batch event with all stream IDs.
  - [ ] Add unit test for batch creation.

---

## 💸 Module 5: Payroll Stream — Events & Testing (SC-12 to SC-14)

### Issue #SC-12: Payroll Stream — Cancellation Refund Logic
**Priority:** High
**Labels:** `smart-contract`, `logic`, `payroll`
**Description:** Implement proper refund splitting on stream cancellation.
- **Tasks:**
  - [ ] Calculate exact pro-rata split at cancellation time.
  - [ ] Transfer owed amount to recipient.
  - [ ] Transfer remaining (unstreamed) to sender.
  - [ ] Handle edge case: cancellation before stream starts.
  - [ ] Handle edge case: cancellation after stream ends.

### Issue #SC-13: Payroll Stream — Event Schema
**Priority:** Medium
**Labels:** `smart-contract`, `events`, `payroll`
**Description:** Define comprehensive events for stream lifecycle.
- **Tasks:**
  - [ ] `StreamCreated(sender, recipient, amount, start, end)`
  - [ ] `StreamClaimed(recipient, stream_id, amount_claimed)`
  - [ ] `StreamCancelled(sender, stream_id, refund_amount)`
  - [ ] `StreamPaused(sender, stream_id, paused_at)`
  - [ ] `StreamResumed(sender, stream_id, resumed_at)`

### Issue #SC-14: Payroll Stream — Comprehensive Tests
**Priority:** High
**Labels:** `testing`, `rust`, `payroll`
**Description:** Full test coverage for the payroll stream contract.
- **Tasks:**
  - [ ] Test claim at various time points (25%, 50%, 75%, 100%).
  - [ ] Test claim after stream fully completes.
  - [ ] Test cancel with partial claims already made.
  - [ ] Test unauthorized cancel by non-sender.
  - [ ] Test creating stream with invalid amounts/durations.
  - [ ] Test multiple streams from same sender to different recipients.

---

## ⏳ Module 6: Vesting — Core Logic (SC-15 to SC-18)

### Issue #SC-15: Vesting — Cliff Unlock Amount
**Priority:** High
**Labels:** `smart-contract`, `logic`, `vesting`
**Description:** Add explicit cliff unlock amount that vests instantly at cliff.
- **Tasks:**
  - [ ] Add `cliff_amount: i128` field to `VestingSchedule` — the amount that unlocks at cliff.
  - [ ] Update `calculate_vested()` to unlock `cliff_amount` at cliff time.
  - [ ] Remaining `total_amount - cliff_amount` vests linearly after cliff.
  - [ ] Update `create_schedule()` to accept `cliff_amount` parameter.
  - [ ] Add guard: `cliff_amount <= total_amount`.

### Issue #SC-16: Vesting — Token Transfer Integration
**Priority:** Critical
**Labels:** `smart-contract`, `integration`, `vesting`
**Description:** Wire up token transfers in vesting functions.
- **Tasks:**
  - [ ] In `create_schedule`: transfer `total_amount` from grantor to contract.
  - [ ] In `claim`: transfer claimable amount from contract to beneficiary.
  - [ ] In `revoke`: transfer unvested remainder back to grantor.
  - [ ] Add balance verification before transfers.

### Issue #SC-17: Vesting — Claim History
**Priority:** Medium
**Labels:** `smart-contract`, `feature`, `vesting`
**Description:** Track claim history for each vesting schedule.
- **Tasks:**
  - [ ] Define `ClaimRecord` struct: `{ amount, timestamp }`.
  - [ ] Store claim records in persistent storage keyed by schedule ID.
  - [ ] Add `get_claim_history(env, schedule_id) -> Vec<ClaimRecord>` query.
  - [ ] Update `claim()` to append to history.

### Issue #SC-18: Vesting — Revocation Handling
**Priority:** High
**Labels:** `smart-contract`, `logic`, `vesting`
**Description:** Complete the revocation logic with token refunds.
- **Tasks:**
  - [ ] Transfer unvested tokens back to grantor on revoke.
  - [ ] Ensure already-claimed + vested-but-unclaimed tokens stay with beneficiary.
  - [ ] Prevent revocation of non-revocable schedules.
  - [ ] Add `revoked_at: Option<u64>` timestamp to schedule.
  - [ ] Emit `VestingRevoked(grantor, schedule_id, unvested_returned)` event.

---

## ⏳ Module 7: Vesting — Events & Testing (SC-19 to SC-20)

### Issue #SC-19: Vesting — Event Schema
**Priority:** Medium
**Labels:** `smart-contract`, `events`, `vesting`
**Description:** Define comprehensive events for vesting lifecycle.
- **Tasks:**
  - [ ] `VestingCreated(grantor, beneficiary, total_amount, cliff, duration)`
  - [ ] `VestingClaimed(beneficiary, schedule_id, amount_claimed)`
  - [ ] `VestingRevoked(grantor, schedule_id, unvested_returned)`
  - [ ] `VestingFullyClaimed(schedule_id)` when all tokens claimed.

### Issue #SC-20: Vesting — Comprehensive Tests
**Priority:** High
**Labels:** `testing`, `rust`, `vesting`
**Description:** Full test coverage for vesting contract.
- **Tasks:**
  - [ ] Test nothing vests before cliff.
  - [ ] Test exact cliff amount vests at cliff time.
  - [ ] Test linear vesting at 25%, 50%, 75%.
  - [ ] Test full vesting after total duration.
  - [ ] Test claim, then claim again later for remaining.
  - [ ] Test non-revocable schedule cannot be revoked.
  - [ ] Test unauthorized revoke by non-grantor.
  - [ ] Test multiple schedules for same beneficiary.

---

## 🗳️ Module 8: Governance — Core Logic (SC-21 to SC-23)

### Issue #SC-21: Governance — Proposal Cancellation
**Priority:** Medium
**Labels:** `smart-contract`, `logic`, `governance`
**Description:** Allow proposers to cancel their own active proposals.
- **Tasks:**
  - [ ] Add `cancel_proposal(env, proposer, proposal_id)` function.
  - [ ] Only the original proposer can cancel.
  - [ ] Can only cancel `Active` proposals.
  - [ ] Set status to `Cancelled`.
  - [ ] Emit `ProposalCancelled` event.

### Issue #SC-22: Governance — Proposal Expiration
**Priority:** Medium
**Labels:** `smart-contract`, `feature`, `governance`
**Description:** Auto-expire proposals that aren't finalized within a grace period.
- **Tasks:**
  - [ ] Add `grace_period: u64` to governance config.
  - [ ] In `finalize()`, check if `now > end_time + grace_period`.
  - [ ] If expired beyond grace period, auto-reject.
  - [ ] Add `get_proposal_status(env, proposal_id)` that computes live status.

### Issue #SC-23: Governance — Weighted Voting
**Priority:** Low
**Labels:** `smart-contract`, `feature`, `governance`
**Description:** Implement optional weighted voting for governance.
- **Tasks:**
  - [ ] Add `voting_weight: Map<Address, u32>` to governance config.
  - [ ] Modify `vote()` to use voter's weight instead of flat 1.
  - [ ] Add `set_voting_weight(env, admin, member, weight)` admin function.
  - [ ] Default weight = 1 for members without explicit weight.
  - [ ] Update quorum calculation to use total weight, not member count.

---

## 🗳️ Module 9: Governance — Events & Testing (SC-24 to SC-25)

### Issue #SC-24: Governance — Treasury Integration
**Priority:** High
**Labels:** `smart-contract`, `integration`, `governance`
**Description:** Connect governance to the treasury for fund disbursement.
- **Tasks:**
  - [ ] In `execute()`, invoke treasury contract's withdrawal function.
  - [ ] Store treasury contract address in governance config.
  - [ ] Add `set_treasury(env, admin, treasury_address)` admin function.
  - [ ] Verify cross-contract invocation works in tests.

### Issue #SC-25: Governance — Comprehensive Tests
**Priority:** High
**Labels:** `testing`, `rust`, `governance`
**Description:** Full test coverage for governance contract.
- **Tasks:**
  - [ ] Test duplicate vote rejected.
  - [ ] Test vote after voting period expires rejected.
  - [ ] Test proposal execution flow.
  - [ ] Test non-member cannot vote.
  - [ ] Test non-member cannot create proposal.
  - [ ] Test quorum calculation with different member counts.
  - [ ] Test add and remove members.
  - [ ] Test proposal cancellation.

---

## ✅ Completed Issues
*(Move completed items here)*
