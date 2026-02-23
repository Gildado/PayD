# SDK & Tooling Issues — PayD 🛠️

This document tracks tasks related to the TypeScript SDK, CLI tools, and DevOps for **PayD**.

### 🛑 STRICT RULE FOR CONTRIBUTORS
**When you complete an issue:**
1. Mark the checkbox `[x]`
2. Append your GitHub username and the Date/Time.
3. **Example:** `- [x] Setup SDK project (@yourname - 2026-02-18 15:00 UTC)`

---

## 📦 Phase 1: TypeScript SDK (TL-1 to TL-5)

### Issue #TL-1: SDK Project Scaffold
**Priority:** Critical
**Labels:** `sdk`, `typescript`, `good-first-issue`
**Description:** Initialize the TypeScript SDK package.
- **Tasks:**
  - [ ] Create `sdk/` directory at project root.
  - [ ] Initialize with `package.json`, `tsconfig.json`.
  - [ ] Setup build tooling (tsup or tsc).
  - [ ] Export main `PayDClient` class.
  - [ ] Add `@stellar/stellar-sdk` as dependency.

### Issue #TL-2: Treasury SDK Client
**Priority:** High
**Labels:** `sdk`, `typescript`, `treasury`
**Description:** TypeScript wrapper for treasury contract interactions.
- **Tasks:**
  - [ ] `Treasury.deposit(token, amount)` — build + submit deposit transaction.
  - [ ] `Treasury.createWithdrawal(token, recipient, amount, memo)` — create proposal.
  - [ ] `Treasury.approveWithdrawal(proposalId)` — approve proposal.
  - [ ] `Treasury.executeWithdrawal(proposalId)` — execute approved proposal.
  - [ ] `Treasury.getConfig()` — query treasury configuration.
  - [ ] `Treasury.getWithdrawal(id)` — query specific withdrawal.

### Issue #TL-3: Payroll Stream SDK Client
**Priority:** High
**Labels:** `sdk`, `typescript`, `payroll`
**Description:** TypeScript wrapper for payroll stream contract interactions.
- **Tasks:**
  - [ ] `PayrollStream.create(recipient, token, amount, start, end)` — create stream.
  - [ ] `PayrollStream.claim(streamId)` — claim accrued tokens.
  - [ ] `PayrollStream.cancel(streamId)` — cancel stream.
  - [ ] `PayrollStream.getClaimable(streamId)` — query claimable amount.
  - [ ] `PayrollStream.getStream(streamId)` — query stream details.
  - [ ] `PayrollStream.listByRecipient(address)` — list received streams.

### Issue #TL-4: Vesting SDK Client
**Priority:** High
**Labels:** `sdk`, `typescript`, `vesting`
**Description:** TypeScript wrapper for vesting contract interactions.
- **Tasks:**
  - [ ] `Vesting.createSchedule(...)` — create vesting schedule.
  - [ ] `Vesting.claim(scheduleId)` — claim vested tokens.
  - [ ] `Vesting.revoke(scheduleId)` — revoke schedule.
  - [ ] `Vesting.getProgress(scheduleId)` — query vesting progress.
  - [ ] `Vesting.listByBeneficiary(address)` — list schedules.

### Issue #TL-5: SDK Type Definitions & Documentation
**Priority:** Medium
**Labels:** `sdk`, `typescript`, `docs`
**Description:** Comprehensive TypeScript types and JSDoc documentation.
- **Tasks:**
  - [ ] Define all contract types in TypeScript:
    - `WithdrawalRequest`, `WithdrawalStatus`
    - `PayrollStream`, `StreamStatus`
    - `VestingSchedule`, `VestingStatus`, `VestingProgress`
    - `Proposal`, `ProposalStatus`, `VoteChoice`
  - [ ] Add JSDoc comments to all SDK methods.
  - [ ] Generate API docs with TypeDoc.
  - [ ] Add usage examples in `sdk/README.md`.

---

## 🔧 Phase 2: CLI & DevOps (TL-6 to TL-10)

### Issue #TL-6: CLI Tool — Contract Deployment
**Priority:** High
**Labels:** `tooling`, `cli`
**Description:** Build a CLI tool for deploying PayD contracts to Stellar.
- **Tasks:**
  - [ ] Create `scripts/deploy.sh` for Soroban CLI deployment.
  - [ ] Build each contract: `soroban contract build`.
  - [ ] Deploy to testnet: `soroban contract deploy`.
  - [ ] Initialize each contract after deployment.
  - [ ] Save deployed contract IDs to `.env` or `deployed.json`.

### Issue #TL-7: Contract Integration Tests
**Priority:** High
**Labels:** `testing`, `integration`
**Description:** Cross-contract integration tests.
- **Tasks:**
  - [ ] Test governance → treasury fund disbursement flow.
  - [ ] Test full lifecycle: deposit → stream → claim.
  - [ ] Test full lifecycle: deposit → vest → claim.
  - [ ] Simulate multi-user scenarios in test environment.

### Issue #TL-8: CI/CD Pipeline
**Priority:** Medium
**Labels:** `devops`, `ci`
**Description:** Setup GitHub Actions for automated testing and building.
- **Tasks:**
  - [ ] Workflow: `cargo test --all` on PR to `main`.
  - [ ] Workflow: `cargo build --release --all` to verify compilation.
  - [ ] Workflow: `npm run lint` for frontend on PR.
  - [ ] Workflow: `npm run build` for frontend on PR.
  - [ ] Add badges to README.

### Issue #TL-9: Documentation Generator
**Priority:** Low
**Labels:** `tooling`, `docs`
**Description:** Auto-generate contract documentation from source.
- **Tasks:**
  - [ ] Use `cargo doc` with custom configuration.
  - [ ] Deploy docs to GitHub Pages.
  - [ ] Include architecture diagrams (Mermaid).
  - [ ] Cross-link contract docs with issue tracker.

### Issue #TL-10: Testnet Faucet Integration
**Priority:** Medium
**Labels:** `tooling`, `testing`
**Description:** Automate testnet funding for development.
- **Tasks:**
  - [ ] Create `scripts/fund-testnet.sh` script.
  - [ ] Use Stellar Friendbot API for XLM funding.
  - [ ] Fund multiple test accounts in batch.
  - [ ] Wrap test token deployment for payroll/vesting testing.
  - [ ] Add setup instructions to `CONTRIBUTING.md`.

---

## ✅ Completed Issues
*(Move completed items here)*
