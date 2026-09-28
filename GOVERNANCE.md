# PayD Smart Contract Upgrade Governance

## Overview

PayD is a cross-border payroll platform managing real organization funds on Stellar mainnet. This document defines authorization rules, governance processes, and multisig/timelock requirements for upgrading live contracts before and after mainnet launch.

**Audience**: DevOps, governance teams, and contract administrators managing PayD deployments.

---

## Issue #1584: Upgrade Governance Framework

### Phase 1: Pre-Mainnet (Testnet/Staging)
**Authority**: Single admin key  
**Approval Process**: Admin key initiation only  
**Deployment Timeline**: Immediate (no delay)  
**Risk Model**: Centralized; suitable for rapid iteration and bug fixes

### Phase 2: Mainnet Launch (First 90 days)
**Authority**: Multi-sig (2-of-3 admin keys) + 24-hour timelock  
**Approval Process**:
1. Admin proposes upgrade with contract ID and new WASM hash
2. Second admin confirms proposal within 24 hours (timelock starts)
3. 24 hours after confirmation, any authorized keyholder executes upgrade
4. Off-chain monitoring systems track all upgrade proposals and executions

**Rationale**:
- 2-of-3 multi-sig prevents single-key compromise
- 24-hour timelock allows emergency halt if malicious proposal detected
- Documented approval trail enables forensic audit
- Grace period allows for community/security auditor review

### Phase 3: Long-term (After 90 days)
**Authority**: DAO governance vote + 48-hour timelock  
**Approval Process**:
1. Governance community submits upgrade proposal on-chain
2. 7-day voting period (token-weighted votes)
3. If approved: 48-hour timelock before execution
4. Any token holder may execute after timelock expires
5. All votes and outcomes recorded on-chain

**Rationale**:
- Community ownership of contract evolution
- Extended timelock (48h) for critical long-term contracts
- Transparent on-chain voting audit trail
- Allows community/security review of changes

---

## Per-Contract Governance Rules

| Contract | Phase 1 | Phase 2 | Phase 3 | Criticality | Rationale |
|---|---|---|---|---|---|
| **cross_asset_payment** | Admin | 2-of-3 + 24h | DAO + 48h | **CRITICAL** | Holds escrowed funds for payments across borders |
| **milestone_escrow** | Admin | 2-of-3 + 24h | DAO + 48h | **CRITICAL** | Locks contractor funds until milestones approved |
| **bulk_payment** | Admin | 2-of-3 + 24h | DAO + 48h | **CRITICAL** | Main payroll distribution engine; ~100 payments/batch |
| **vesting_escrow** | Admin | 2-of-3 + 24h | DAO + 48h | **CRITICAL** | Long-term vesting schedules; months to years |
| **asset_path_payment** | Admin | 2-of-3 + 24h | DAO + 48h | **CRITICAL** | DEX path swaps for multi-hop conversions |
| **smart_wallet** | Admin | 2-of-3 + 24h | DAO + 48h | **HIGH** | Account recovery and wallet management |
| **revenue_split** | Admin | 2-of-3 + 24h | DAO + 48h | **MEDIUM** | Revenue distribution; less direct fund movement |
| **orgusd** | Admin | 2-of-3 + 24h | DAO + 48h | **CRITICAL** | Stablecoin issuance; affects payment finality |

---

## Issue #1585: Multisig + Timelock Architecture

### Multisig Implementation

**2-of-3 Admin Key Setup**:
```
Admin Keyset:
  - Key 1: Ops Team (primary signer)
  - Key 2: Security Review Team (secondary signer)
  - Key 3: Community Representative (tiebreaker)

Threshold: 2 of 3 required for approval
```

**Key Rotation Process**:
- Each key rotated annually or immediately upon compromise suspicion
- Rotation requires all 3 current keyset members to sign transition
- 7-day notice period before old keys revoked
- New keys published to all PayD systems before activation

### Timelock Implementation

**24-Hour Timelock for Phase 2 Mainnet**:
```rust
struct UpgradeProposal {
    proposed_wasm_hash: [u8; 32],
    proposed_at_ledger: u32,
    approved_at_ledger: u32,  // Set after 2-of-3 approval
    ready_at_ledger: u32,      // proposed_at_ledger + ~20,880 (24 hours)
    executed_at_ledger: u32,
    status: Symbol,             // "pending", "approved", "ready", "executed", "cancelled"
}
```

**Cancellation Rights**:
- Any keyset member may cancel pending proposal anytime before timelock expires
- Cancellation emits `UpgradeCancelledEvent` with reason (optional free-form string)
- Off-chain alerts triggered on cancellation for investigation

### Timelock Storage Keys

All timelock state uses Persistent storage with `PERSISTENT_TTL_EXTEND_TO` (120,000 ledgers):

| Key | Type | Purpose |
|---|---|---|
| `DataKey::UpgradeProposals(u64)` | Persistent | Latest proposal for contract ID |
| `DataKey::UpgradeHistory(u64)` | Persistent | Audit log of past upgrades |
| `DataKey::AdminKeyset` | Persistent | Current 2-of-3 keyset members |
| `DataKey::AdminKeysetProposal` | Persistent | Pending keyset rotation proposal |

---

## Upgrade Execution Flow

### Pre-Mainnet (Phase 1)
```
Admin triggers upgrade()
  ↓
Admin signs with single key
  ↓
Upgrade executes immediately
```

### Mainnet Phase 2 (2-of-3 + 24h)
```
Step 1: Proposal
  Admin A calls propose_upgrade(wasm_hash, contract_id)
  
Step 2: Approval
  Admin B calls approve_upgrade_proposal(contract_id)
  ✓ Multisig check: 2-of-3 valid
  ✓ Timelock starts (24 hours)
  
Step 3: Wait
  Off-chain monitors check proposal details
  Community reviews changes (24 hours)
  Security team may cancel if issues found
  
Step 4: Execution
  After timelock, any authorized member calls execute_upgrade(contract_id)
  ✓ Verifies 24 hours elapsed
  ✓ Executes WASM update
  ✓ Emits UpgradeExecutedEvent
```

### Phase 3 (DAO + 48h)
```
[Same as Phase 2, but with DAO voting instead of admin approval]
```

---

## Security Controls

### Upgrade Authorization Guards

1. **WASM Hash Verification**
   - New WASM hash published to multiple channels before upgrade
   - Hashes must match bit-for-bit; any corruption detected and rejected
   - Off-chain build reproducibility CI/CD verifies hash matches source code

2. **Nonce/Sequence Validation**
   - Global upgrade counter increments per execution
   - Prevents replay attacks across contract versions
   - Each proposal includes expected sequence number

3. **Circuit Breaker Integration**
   - If any contract is paused (circuit breaker active), upgrades are blocked
   - Requires admin to unpause before upgrade execution
   - Prevents accidental upgrades during incident response

4. **State Validation Post-Upgrade**
   - Contract initialization checks that all storage keys still accessible
   - Ledger balance verification ensures no funds lost/trapped
   - Version comparison (semantic versioning) ensures backwards compatibility

### Rollback Strategy

**Rollback is NOT automatic** (prevents uncontrolled downgrades):
- Rollback treated as a new upgrade proposal requiring full approval
- Previous version tagged and archived for audit
- Rollback decision logged with reason/comments

**Emergency Pause (Circuit Breaker)** is faster alternative:
- Pauses contract immediately if issues detected
- Prevents state changes while investigation ongoing
- Admin can unpause when confident

---

## Audit Trail & Monitoring

### Events Emitted

| Event | Trigger | Indexing Requirement |
|---|---|---|
| `UpgradeProposedEvent` | `propose_upgrade()` | Track all proposals, timestamps, WASM hashes |
| `UpgradeApprovedEvent` | `approve_upgrade()` (2-of-3 met) | Track approval time, approver identity |
| `UpgradeCancelledEvent` | `cancel_upgrade_proposal()` | Track cancellations and reasons |
| `UpgradeExecutedEvent` | `execute_upgrade()` after timelock | Track execution time, new version |
| `AdminKeysetRotationProposedEvent` | `propose_keyset_rotation()` | Track key rotation proposals |
| `AdminKeysetRotatedEvent` | `execute_keyset_rotation()` | Track new keyset activation |

### Off-Chain Monitoring

1. **Real-Time Alerting**
   - Alert on upgrade proposal emission
   - Alert on approval (2-of-3 met)
   - Alert on timelock expiration
   - Alert on execution

2. **Proposal Review SLA**
   - All proposals reviewed within 6 hours
   - Security team publishes review status
   - Community comments tracked on-chain or via GitHub

3. **Monthly Audit Reports**
   - Summarize all upgrades executed
   - Compare deployed WASM vs. released source code
   - Verify no unauthorized changes

---

## Implementation Roadmap

### Before Mainnet (Weeks 1-2)
- [ ] Issue #1585: Implement multisig contract module
- [ ] Issue #1585: Add 24-hour timelock logic
- [ ] Issue #1585: Write upgrade authorization tests
- [ ] Issue #1584: Finalize keyset members and publish public keys

### Mainnet Launch (Week 3)
- [ ] Deploy all 8 contracts with single-admin setup (Phase 1)
- [ ] Testnet: Execute 2-3 practice upgrades with timelock
- [ ] Publish this governance document to all stakeholders

### Phase 2 (Days 1-90)
- [ ] Activate 2-of-3 admin keyset on day 1
- [ ] Monitor upgrade proposals and executions daily
- [ ] Publish weekly governance digest

### Phase 3 (After 90 days)
- [ ] Migrate to DAO governance voting smart contracts
- [ ] Enable on-chain governance proposals
- [ ] Activate 48-hour timelock for all upgrades

---

## References

- **Issue #1585**: Require multisig/timelock for contract upgrade authorization
- **Issue #1584**: Define and document contract upgrade governance
- **Stellar Wave Program**: Mainnet readiness initiative
- **Soroban Auth Model**: [docs.soroban.org/learn/storing-data](https://docs.soroban.org/learn/storing-data)

