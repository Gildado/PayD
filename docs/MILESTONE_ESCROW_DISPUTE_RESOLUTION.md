# Milestone Escrow Dispute Resolution Fairness Review

**Issue**: #1596  
**Title**: Review milestone_escrow dispute-resolution fairness  
**Status**: Complete  

---

## Executive Summary

This document reviews the fairness of the dispute-resolution mechanism in the `milestone_escrow` contract and recommends enhancements to provide balanced recourse for disputed milestones.

**Current Status**: The contract implements role-based access control (sender, verifier, beneficiary) but lacks explicit dispute resolution for cases where verifier approval is contested.

**Recommendation**: Add dispute escalation and timelock-based resolution to enable fair outcomes when stakeholders disagree on milestone completion.

---

## Current Architecture

### Roles in milestone_escrow

1. **Sender**: Creates the escrow, funds it, and can cancel
2. **Beneficiary**: Receives approved funds via `release_milestone`
3. **Verifier**: Approves milestones before beneficiary can claim funds

### Current Flow

```
[Sender creates escrow]
       ↓
[Beneficiary completes work]
       ↓
[Verifier approves milestone] OR [Verifier rejects (implicitly)]
       ↓
[Beneficiary releases funds]  OR [Stalled - no resolution]
```

### Current Dispute Scenarios

| Scenario | Current Behavior | Fairness Issue |
|----------|-----------------|-----------------|
| **Beneficiary completes, verifier never approves** | Escrow stalls indefinitely | Beneficiary cannot claim funds |
| **Verifier is unavailable** | Escrow stalls indefinitely | Deadlock – no resolution path |
| **Sender wants to cancel, verifier won't approve** | Sender can cancel anytime | Beneficiary loses all funds |
| **Beneficiary claims work done, verifier disagrees** | No arbitration mechanism | No dispute resolution |

---

## Fairness Issues

### Issue 1: Verifier Gating Deadlock

**Scenario**: Milestone is complete, but verifier is unavailable or refuses to approve

**Current State**:
- Beneficiary cannot claim funds (requires verifier approval)
- Sender cannot access remaining balance without cancelling entire escrow
- Verifier has unilateral power to block milestone indefinitely

**Fairness Impact**: **Unfair to beneficiary** – Work is done but payment is blocked by single party

### Issue 2: Sender Unilateral Cancellation

**Scenario**: Sender cancels escrow while milestone approval is pending

**Current State**:
```rust
pub fn cancel_escrow(...) -> Result<(), ContractError> {
    // Only requires sender auth
    // Can be called at any time, regardless of milestone status
}
```

**Fairness Impact**: **Unfair to beneficiary** – Cancellation can happen after work is done but before approval

### Issue 3: Lack of Dispute Escalation

**Scenario**: Beneficiary disagrees with verifier rejection (implicit or explicit)

**Current State**:
- No mechanism to dispute verifier decision
- No escalation path to sender or governance
- No arbitration or appeal process

**Fairness Impact**: **Unfair to beneficiary** – No recourse for disputed verifications

### Issue 4: No Timelocked Resolution

**Scenario**: Verifier is lost, gone, or deceased

**Current State**:
- Escrow remains locked indefinitely
- No time-based resolution
- No fallback approval mechanism

**Fairness Impact**: **Unfair to beneficiary** – Permanent lock with no recovery

---

## Recommended Solution: Timelocked Dispute Resolution

### Design Principles

1. **Default Approval (Timelocked)**: If verifier does not approve within a time window, milestone auto-approves
2. **Dispute Escalation**: Beneficiary can escalate disputes to sender for arbitration
3. **Cancellation Constraints**: Sender cannot cancel without pending approval from beneficiary
4. **Transparent Timeline**: All milestones display approval deadline

### Proposed Mechanism

#### 1. Add Approval Deadline

```rust
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Milestone {
    pub description: String,
    pub amount: i128,
    pub status: MilestoneStatus,
    // NEW FIELD:
    pub approval_deadline: u64,  // Unix timestamp
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MilestoneStatus {
    Pending,
    Approved,
    Released,
    // NEW STATUSES:
    Disputed,           // Beneficiary escalated disagreement
    AutoApprovedDeadline,  // Auto-approved after deadline
}
```

#### 2. Add Dispute Escalation Function

```rust
pub fn escalate_milestone_dispute(
    e: Env,
    escrow_id: u64,
    milestone_index: u32,
) -> Result<(), ContractError> {
    // Requires beneficiary auth
    
    let mut escrow = env.get_escrow(e, escrow_id)?;
    let milestone = escrow.milestones.get(milestone_index as usize)?;
    
    // Can only escalate if verifier hasn't approved and deadline hasn't passed
    if milestone.status != MilestoneStatus::Pending {
        return Err(ContractError::MilestoneNotFound);
    }
    
    if ledger_time() < milestone.approval_deadline {
        return Err(ContractError::DeadlineNotElapsed);
    }
    
    // Mark as disputed
    milestone.status = MilestoneStatus::Disputed;
    env.set_escrow(e, escrow_id, &escrow)?;
    
    // Emit event for sender to review
    MilestoneDisputedEvent {
        escrow_id,
        milestone_index,
        beneficiary: escrow.beneficiary,
    }.publish(&e);
    
    Ok(())
}
```

#### 3. Add Approval Deadline Auto-Approval

```rust
pub fn auto_approve_milestone_if_deadline_passed(
    e: Env,
    escrow_id: u64,
    milestone_index: u32,
) -> Result<(), ContractError> {
    // Public function anyone can call
    // Auto-approves if approval_deadline has passed
    
    let mut escrow = env.get_escrow(e, escrow_id)?;
    let milestone = escrow.milestones.get(milestone_index as usize)?;
    
    if milestone.status != MilestoneStatus::Pending {
        return Err(ContractError::MilestoneNotFound);
    }
    
    if ledger_time() >= milestone.approval_deadline {
        milestone.status = MilestoneStatus::AutoApprovedDeadline;
        env.set_escrow(e, escrow_id, &escrow)?;
        
        MilestoneAutoApprovedEvent {
            escrow_id,
            milestone_index,
        }.publish(&e);
        
        Ok(())
    } else {
        Err(ContractError::DeadlineNotElapsed)
    }
}
```

#### 4. Constrain Cancellation

```rust
pub fn cancel_escrow(...) -> Result<(), ContractError> {
    // Existing code...
    
    // NEW: Check if any milestones are disputed
    let escrow = env.get_escrow(...)?;
    for milestone in escrow.milestones {
        if milestone.status == MilestoneStatus::Disputed {
            // Require sender + beneficiary to agree to cancellation
            env.current_contract_address().require_auth();
            escrow.beneficiary.require_auth();  // Both must approve
            break;
        }
    }
    
    // Only then allow cancellation
    // ... existing cancellation logic ...
}
```

---

## Proposed Dispute Resolution Workflow

### Timeline for a Disputed Milestone

```
T=0:  [Escrow created with milestone]
      approval_deadline = now + 7 days

T=7d: [Verifier hasn't approved]
      Beneficiary calls escalate_milestone_dispute()
      → Status changes to Disputed
      → Sender is notified

T=7d+: [Sender reviews dispute]
       Option 1: Approve milestone manually
       Option 2: Reject milestone (requires sender + verifier agreement?)
       Option 3: Cancel escrow (requires beneficiary consent)

T=14d: [If no resolution, consider further escalation]
       Option A: Auto-approve after 14 days
       Option B: Escalate to governance
```

---

## Implementation Details

### Approval Deadline Configuration

The approval deadline is set at escrow creation time:

```bash
soroban contract invoke \
  --network public \
  --source-account SENDER_SECRET_KEY \
  --id $MILESTONE_ESCROW_ID \
  -- \
  create_escrow \
  --sender <SENDER_ADDRESS> \
  --beneficiary <BENEFICIARY_ADDRESS> \
  --verifier <VERIFIER_ADDRESS> \
  --token <TOKEN_ADDRESS> \
  --milestones '[
    {
      "description": "Phase 1",
      "amount": 50000000,
      "status": {"pending": []},
      "approval_deadline": 1234567890  # Unix timestamp (7 days from now)
    }
  ]'
```

### Dispute Escalation Workflow

```bash
# Step 1: Beneficiary escalates after deadline approaches
soroban contract invoke \
  --network public \
  --source-account BENEFICIARY_SECRET_KEY \
  --id $MILESTONE_ESCROW_ID \
  -- \
  escalate_milestone_dispute \
  --escrow_id 1 \
  --milestone_index 0

# Step 2: Sender reviews and approves manually
soroban contract invoke \
  --network public \
  --source-account SENDER_SECRET_KEY \
  --id $MILESTONE_ESCROW_ID \
  -- \
  approve_milestone \
  --escrow_id 1 \
  --milestone_index 0

# Step 3: Beneficiary releases funds
soroban contract invoke \
  --network public \
  --source-account BENEFICIARY_SECRET_KEY \
  --id $MILESTONE_ESCROW_ID \
  -- \
  release_milestone \
  --escrow_id 1 \
  --milestone_index 0
```

---

## Events for Dispute Tracking

```rust
#[contractevent]
pub struct MilestoneDisputedEvent {
    #[topic]
    pub escrow_id: u64,
    pub milestone_index: u32,
    pub beneficiary: Address,
}

#[contractevent]
pub struct MilestoneAutoApprovedEvent {
    #[topic]
    pub escrow_id: u64,
    pub milestone_index: u32,
}

#[contractevent]
pub struct MilestoneAutoApprovedEvent {
    #[topic]
    pub escrow_id: u64,
    pub milestone_index: u32,
    pub approval_deadline: u64,
}
```

---

## Fairness Matrix: Before & After

| Scenario | Current | With Timelocked Resolution |
|----------|---------|---------------------------|
| Verifier disappears | ❌ Escrow locked forever | ✅ Auto-approves after deadline |
| Beneficiary disputes verification | ❌ No recourse | ✅ Can escalate to sender |
| Sender wants refund while work pending | ⚠️ Can cancel anytime | ✅ Requires beneficiary consent if disputed |
| Milestone is actually complete | ❌ Verifier blocks indefinitely | ✅ Auto-approves after deadline |
| Genuine disagreement on completion | ❌ No resolution | ✅ Escalation + sender arbitration |

---

## Alternative Approaches Considered

### Alternative 1: Multisig Verification

Instead of single verifier, require M-of-N verifiers to approve:

**Pros**:
- No single point of failure
- Multiple perspectives on completion

**Cons**:
- Operational complexity
- Higher coordination overhead
- May reduce approval speed

**Recommendation**: **Use multisig verification for high-value milestones** (> 1M tokens)

### Alternative 2: Governance-Based Dispute Resolution

Create a DAO or court to arbitrate disputes:

**Pros**:
- Neutral third party
- Transparent decision-making
- Scalable for many escrows

**Cons**:
- Slower resolution (voting required)
- More complex governance setup
- Requires active participation

**Recommendation**: **Use as escalation mechanism if direct resolution fails** (after timelocked auto-approval)

### Alternative 3: Payment Bonds / Insurance

Require verifier to post a bond:

**Pros**:
- Incentivizes fair verification
- Protects beneficiary against malicious rejection

**Cons**:
- Requires verifier to have capital
- Adds complexity to escrow creation

**Recommendation**: **Optional feature for high-stakes contracts**

---

## Configuration & Policy

### Recommended Approval Deadline Policy

| Milestone Value | Approval Deadline | Rationale |
|-----------------|------------------|-----------|
| < 100K ORGUSD | 3 days | Low risk, fast resolution |
| 100K - 1M ORGUSD | 7 days | Medium risk, standard SLA |
| 1M - 10M ORGUSD | 14 days | High risk, more review time |
| > 10M ORGUSD | 30 days | Critical, governance-level review |

### Governance Override

If timelocked resolution creates issues:
- Governance can manually adjust approval_deadline via contract upgrade
- Governance can manually approve disputed milestones
- Governance can refund escrow entirely if dispute is unresolvable

---

## Testing Requirements

### Unit Tests

```rust
#[test]
fn test_escalate_milestone_dispute_requires_beneficiary_auth() {
    // Only beneficiary can escalate
}

#[test]
fn test_auto_approve_after_deadline_passes() {
    // Milestone auto-approves after deadline
}

#[test]
fn test_cancel_escrow_with_disputed_milestone_requires_both_signatures() {
    // Sender + beneficiary must both approve cancellation
}

#[test]
fn test_cannot_escalate_already_approved_milestone() {
    // Cannot escalate if already approved or released
}

#[test]
fn test_dispute_resolution_workflow_full_scenario() {
    // Create → Complete → Escalate → Sender Approves → Release
}
```

### Integration Tests

1. **Full dispute resolution flow**:
   - Create escrow with 7-day deadline
   - Wait 7 days
   - Beneficiary escalates
   - Sender approves
   - Beneficiary releases

2. **Timeout scenario**:
   - Create escrow
   - Wait past deadline
   - Auto-approve triggers
   - Beneficiary can now release

3. **Contested cancellation**:
   - Create escrow
   - Beneficiary escalates dispute
   - Sender tries to cancel → rejected
   - Sender + beneficiary both approve cancellation → accepted

---

## Migration Path

If `milestone_escrow` is already deployed:

1. **Deploy new version** with dispute resolution features
2. **Create migration function** to upgrade existing escrows:
   - Copy existing escrow state to new contract
   - Backfill approval_deadline (e.g., 7 days from deployment)
   - Mark pending milestones as `Pending` (same status)
3. **Gradually transition** users to new contract
4. **Support old contract** in read-only mode during transition

---

## Security Considerations

### Risk: Beneficiary Disputes All Milestones

**Mitigation**: Only allow dispute if verifier hasn't approved AND deadline is approaching

### Risk: Sender Cancels Before Dispute Resolution

**Mitigation**: Require beneficiary consent for cancellation when milestone is disputed

### Risk: Verifier Delays Approval Intentionally

**Mitigation**: Timelocked auto-approval prevents indefinite delays

---

## Conclusion

**Recommended Actions**:

1. ✅ **Add approval deadline** to milestone structure
2. ✅ **Implement timelocked auto-approval** for pending milestones past deadline
3. ✅ **Add dispute escalation** for beneficiary to flag stuck milestones
4. ✅ **Constrain cancellation** when milestones are disputed
5. ✅ **Test full dispute resolution workflow** on testnet
6. ✅ **Document dispute policies** (approval SLAs per milestone value)

**Benefits**:
- Prevents indefinite escrow deadlocks
- Provides fair recourse for beneficiaries
- Reduces reliance on single verifier
- Maintains role separation (sender, verifier, beneficiary)
- Transparent, auditable dispute process

---

## References

- [milestone_escrow README](../contracts/milestone_escrow/README.md)
- [MAINNET_DEPLOYMENT_RUNBOOK.md](./MAINNET_DEPLOYMENT_RUNBOOK.md)
- [Stellar Soroban Docs](https://developers.stellar.org/docs/smart-contracts)
