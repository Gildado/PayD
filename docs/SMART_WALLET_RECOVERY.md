# Smart Wallet Signer-Recovery Mechanism

**Issue**: #1597  
**Title**: Design a smart_wallet signer-recovery mechanism  
**Status**: Complete  

---

## Executive Summary

This document designs a recovery mechanism for organizations that lose access to signer keys in a multisig smart_wallet. The mechanism allows remaining signers to recover wallet access by adding new signers and removing lost/compromised keys.

**Design**: Use the existing `add_signer()` and `remove_signer()` functions under multisig governance to implement recovery without requiring all original signers.

---

## Problem Statement

### Scenario

A 3-of-5 multisig smart_wallet is used to govern ORGUSD minting:
- 5 signers total
- 3 signatures required for any operation
- 2 signers lose their keys (unavailable)

**Issue**: The wallet is now inoperable because:
- Only 3 signers remain
- 3-of-5 threshold still requires 3 signatures
- 2 lost signers cannot provide their signatures

**Goal**: Allow the remaining 3 signers to add a new signer and remove the 2 lost signers, restoring full governance capability.

---

## Current Implementation

### Existing Multisig Functions

The `smart_wallet` contract already implements:
- `add_signer(new_signer: SignerKey)` – Adds a new signer (requires contract multisig auth)
- `remove_signer(signer: SignerKey)` – Removes an existing signer (requires contract multisig auth)
- `set_threshold(threshold: u32)` – Updates M-of-N threshold (requires contract multisig auth)

### Key Constraint

All three functions require `env.current_contract_address().require_auth()`, which means they require the wallet's own multisig authorization:

```rust
pub fn remove_signer(env: Env, signer: SignerKey) -> Result<(), WalletError> {
    env.current_contract_address().require_auth();  // ← Requires multisig auth
    
    let signers = Self::load_signers(&env)?;
    let threshold = Self::load_threshold(&env)?;
    
    // Validation: new signer count must still meet threshold
    if signers.len() - 1 < threshold {
        return Err(WalletError::InvalidThreshold);
    }
    
    // ... removal logic ...
}
```

**Implication**: Recovery operations must be authorized by the current multisig threshold (M-of-N), which ensures governance is preserved during recovery.

---

## Recovery Mechanism Design

### Principle: Threshold-Based Recovery

The recovery mechanism operates on a simple principle:

> **If M-of-N signers remain, they can authorize any wallet operation, including adding new signers.**

### Requirements

1. **No centralized recovery key** – Recovery must use existing multisig mechanism
2. **No guardian override** – No way to bypass multisig approval
3. **Transparent** – All recovery operations are signed and audited
4. **Fail-safe** – If threshold drops below M, wallet locks until threshold is restored

### Recovery Flowchart

```
[Lost Key Scenario]
       ↓
[Assess Impact: count remaining signers]
       ↓
[If remaining >= M: proceed with recovery]
   [If remaining < M: wallet is locked, requires governance override]
       ↓
[Add Replacement Signer]
   (requires M-of-N multisig auth)
       ↓
[Remove Lost Signers]
   (requires M-of-N multisig auth per removal)
       ↓
[Update Threshold (optional)]
   (if signer count changed significantly)
       ↓
[Recovery Complete]
```

---

## Implementation Steps

### Step 1: Assess Signer Loss

```bash
# Query current signers and threshold
soroban contract invoke \
  --network public \
  --id $SMART_WALLET_CONTRACT_ID \
  -- \
  signer_count

soroban contract invoke \
  --network public \
  --id $SMART_WALLET_CONTRACT_ID \
  -- \
  threshold
```

**Example Output**:
```
signer_count: 5
threshold: 3
```

**Assessment**:
- Total signers: 5
- Required for approval: 3
- Lost signers: 2
- Remaining signers: 3
- **Recovery is possible** (3 remaining = 3 required)

### Step 2: Prepare New Signer Key

Generate a new signer key to replace the lost one:

```bash
# Generate new Ed25519 keypair
stellar keys generate ed25519

# Or import an existing cold-storage key
# ED25519_NEW_SIGNER="<32-byte-hex-public-key>"

ED25519_NEW_SIGNER="abc123def456...abc123def456abc123def456abc123def456"
```

### Step 3: Add New Signer (Multisig Authorization)

All remaining signers must authorize the addition:

```bash
# Signer 1 initiates the add_signer call
# This requires Signer 1, 2, 3 to provide valid signatures

soroban contract invoke \
  --network public \
  --source-account <SIGNER_1_SECRET_KEY> \
  --id $SMART_WALLET_CONTRACT_ID \
  -- \
  add_signer \
  --new_signer "{\"ed25519\":\"$ED25519_NEW_SIGNER\"}"
```

**Internal Process**:
1. `add_signer()` is called with the new signer
2. Soroban runtime checks `env.current_contract_address().require_auth()`
3. This triggers the wallet's `__check_auth()` callback
4. `__check_auth()` verifies that M-of-N (3-of-5) valid signatures are provided
5. If threshold is met, the new signer is added
6. Event `SignerAddedEvent` is emitted

**Key Point**: The Soroban runtime automatically handles multisig verification. The user must provide valid signatures from at least M signers in the transaction envelope.

### Step 4: Remove Lost Signers

Repeat for each lost signer:

```bash
# Remove first lost signer
soroban contract invoke \
  --network public \
  --source-account <SIGNER_1_SECRET_KEY> \
  --id $SMART_WALLET_CONTRACT_ID \
  -- \
  remove_signer \
  --signer "{\"ed25519\":\"$ED25519_LOST_SIGNER_1\"}"

# Remove second lost signer
soroban contract invoke \
  --network public \
  --source-account <SIGNER_1_SECRET_KEY> \
  --id $SMART_WALLET_CONTRACT_ID \
  -- \
  remove_signer \
  --signer "{\"ed25519\":\"$ED25519_LOST_SIGNER_2\"}"
```

**Validation**: The contract enforces:
```rust
if signers.len() - 1 < threshold {
    return Err(WalletError::InvalidThreshold);
}
```

Example:
- Before removal: 5 signers, threshold = 3
- After first removal: 4 signers, threshold = 3 ✓ (4 - 1 = 3 ≥ 3)
- After second removal: 3 signers, threshold = 3 ✓ (3 - 1 = 2 < 3) ❌ **Cannot remove both**

**Solution**: Add new signer FIRST, then remove lost signers:
1. Add new signer → 6 signers, threshold = 3
2. Remove lost signer 1 → 5 signers, threshold = 3 ✓ (5 - 1 = 4 ≥ 3)
3. Remove lost signer 2 → 4 signers, threshold = 3 ✓ (4 - 1 = 3 ≥ 3)

### Step 5: Verify Recovery

```bash
# Verify new signer count
soroban contract invoke \
  --network public \
  --id $SMART_WALLET_CONTRACT_ID \
  -- \
  signer_count

# Expected: 4 (original 5 - 2 lost + 1 new)

# Test new signer can sign operations
# Verify old signers can no longer sign
```

---

## Failure Modes & Recovery

### Failure Mode 1: Too Many Keys Lost

**Scenario**: 3-of-5 wallet loses 3 signers (only 2 remain)

**Status**: **Wallet is locked** – only 2 signers available, but 3 signatures required

**Recovery Options**:
1. **Governance Intervention** (if available):
   - Submit governance proposal to upgrade wallet threshold to 2-of-5
   - Once governance passes, remaining 2 signers can update threshold:
     ```bash
     soroban contract invoke \
       --network public \
       --source-account <SIGNER_1_SECRET_KEY> \
       --id $SMART_WALLET_CONTRACT_ID \
       -- \
       set_threshold \
       --threshold 2
     ```

2. **Redeploy Wallet** (if governance fails):
   - Deploy new smart_wallet with recovered signers
   - Transfer control of ORGUSD to new wallet
   - Requires ORGUSD admin approval

### Failure Mode 2: Signer Compromised (Not Lost)

**Scenario**: A signer key is compromised; attacker could sign malicious operations

**Response**:
1. **Immediately remove compromised signer** (requires M-of-N approval):
   ```bash
   soroban contract invoke \
     --network public \
     --source-account <TRUSTED_SIGNER_KEY> \
     --id $SMART_WALLET_CONTRACT_ID \
     -- \
     remove_signer \
     --signer "{\"ed25519\":\"$COMPROMISED_SIGNER\"}"
   ```

2. **Add replacement signer** (requires M-of-N approval):
   ```bash
   soroban contract invoke \
     --network public \
     --source-account <TRUSTED_SIGNER_KEY> \
     --id $SMART_WALLET_CONTRACT_ID \
     -- \
     add_signer \
     --new_signer "{\"ed25519\":\"$REPLACEMENT_SIGNER\"}"
   ```

3. **Monitor for malicious transactions** during the window between compromise and removal
   - Check pending operations on ORGUSD (time-locked mints, clawbacks)
   - If malicious operations are pending, consider pausing ORGUSD or cancelling operations

---

## Recovery Procedures by Scenario

### Scenario A: Single Signer Lost (3-of-5 Wallet)

**Setup**: 5 signers, 3-of-5 multisig, 1 signer loses key

**Steps**:
1. Add new signer (3-of-remaining-4 approval required)
2. Verify 6 signers now (5 - 1 + 1)
3. Remove lost signer (3-of-6 approval required)
4. Verify 5 signers now

**Time**: ~5 minutes (time-locked operations already completed)

### Scenario B: Multiple Signers Lost (3-of-5 Wallet)

**Setup**: 5 signers, 3-of-5 multisig, 2 signers lose keys

**Steps**:
1. Assess: 3 signers remain, 3 required → **Wallet is still operational** ✓
2. Add new signer (3 signatures required)
3. Add another new signer (3 signatures required)
4. Remove first lost signer (3 signatures required)
5. Remove second lost signer (3 signatures required)
6. Verify 5 signers now (5 - 2 + 2)

**Time**: ~20 minutes (4 sequential operations)

### Scenario C: Majority Signers Compromised (3-of-5 Wallet)

**Setup**: 5 signers, 3-of-5 multisig, 3 signers are compromised

**Steps**:
1. Assess: Remaining 2 signers cannot authorize operations (need 3) → **Wallet is locked**
2. **Escalate to governance** (no technical recovery possible)
3. Governance votes to migrate control to new multisig wallet
4. Once approved, ORGUSD admin is transferred to new wallet
5. Deploy new smart_wallet with verified signers
6. Old wallet is decommissioned

**Time**: Hours to days (governance-dependent)

---

## Signer Recovery Checklist

### Before Recovery

- [ ] Confirm which signers are lost/compromised
- [ ] Verify remaining signers can communicate securely
- [ ] Ensure at least M remaining signers are available
- [ ] Prepare replacement signer keys (generate or activate from cold storage)
- [ ] Document the recovery incident for audit trail

### During Recovery

- [ ] Gather M signatures for add_signer operation
- [ ] Execute add_signer transaction
- [ ] Verify new signer is added (query signer_count)
- [ ] Repeat: gather M signatures, execute remove_signer for each lost signer
- [ ] Verify final signer count matches expectations

### After Recovery

- [ ] Test that new signer can sign operations
- [ ] Verify lost signers can no longer sign
- [ ] Review all recent operations for unauthorized activity
- [ ] Update signer rotation schedule
- [ ] Document incident and recovery steps for future reference

---

## Operational Procedures

### Key Custody Best Practices

1. **Geographic Distribution**: Store signer keys in different physical locations
2. **Organizational Diversity**: Different roles (dev, ops, security, legal, community)
3. **Cryptographic Diversity**: Mix Ed25519 and secp256k1 key types
4. **Secure Storage**: Hardware wallets, air-gapped machines, multisig vaults
5. **Regular Rotation**: Retire and replace signer keys annually

### Recovery Kit

Each organization should maintain:
1. **Master key list** (encrypted, distributed among signers):
   - Signer public keys
   - Signer identities (organization roles)
   - Signer custody locations
2. **Recovery procedures document**:
   - Instructions for adding/removing signers
   - Contact information for each signer
   - Escalation paths if multiple signers are lost
3. **Tested recovery process**:
   - Dry-run recovery on testnet quarterly
   - Verify all signers can coordinate to add/remove signers
4. **Incident response plan**:
   - What to do if key is lost or compromised
   - Who to contact first
   - How to communicate with other signers securely

---

## Testing & Validation

### Unit Tests

```rust
#[test]
fn test_recovery_add_signer_requires_multisig() {
    let env = Env::default();
    let contract = SmartWalletContract;
    
    // Initialize 3-of-5 multisig
    let signers = vec![signer1, signer2, signer3, signer4, signer5];
    contract.init(env.clone(), signers, 3)?;
    
    // Add new signer with 3 signatures
    let new_signer = /* new key */;
    contract.add_signer(env.clone(), new_signer)?;
    
    // Verify signer count increased
    assert_eq!(contract.signer_count(env)?, 6);
}

#[test]
fn test_recovery_remove_signer_maintains_threshold() {
    // Test that remove_signer rejects if threshold would drop
    let env = Env::default();
    let contract = SmartWalletContract;
    
    let signers = vec![signer1, signer2, signer3];
    contract.init(env.clone(), signers, 3)?;
    
    // Attempt to remove signer would leave 2, but threshold is 3
    let result = contract.remove_signer(env.clone(), signer1);
    assert_eq!(result, Err(WalletError::InvalidThreshold));
}

#[test]
fn test_recovery_full_scenario() {
    // 5-signer wallet, 2 signers lost, recovery via add + remove
    let env = Env::default();
    let contract = SmartWalletContract;
    
    let signers = vec![s1, s2, s3, s4, s5];
    contract.init(env.clone(), signers, 3)?;
    
    // Add new signer (3 signatures)
    let new_signer = s6;
    contract.add_signer(env.clone(), new_signer)?;
    
    // Remove first lost signer (3 signatures)
    contract.remove_signer(env.clone(), s4)?;
    
    // Remove second lost signer (3 signatures)
    contract.remove_signer(env.clone(), s5)?;
    
    // Verify: 4 signers (s1, s2, s3, s6)
    assert_eq!(contract.signer_count(env)?, 4);
}
```

### Integration Tests

1. **Testnet Recovery Simulation**:
   - Deploy 3-of-5 smart_wallet to testnet
   - Designate 2 signers as "lost"
   - Execute full recovery procedure with remaining 3 signers
   - Verify wallet is fully operational after recovery

2. **ORGUSD Integration**:
   - Deploy smart_wallet as ORGUSD admin
   - Execute a mint operation (3-of-5 approval)
   - Simulate signer loss and recovery
   - Execute another mint operation with recovered wallet
   - Verify both mints succeed

---

## References

- [smart_wallet README](../contracts/smart_wallet/README.md)
- [MAINNET_DEPLOYMENT_RUNBOOK.md](./MAINNET_DEPLOYMENT_RUNBOOK.md)
- [ORGUSD_ADMIN_KEY_CUSTODY.md](./ORGUSD_ADMIN_KEY_CUSTODY.md)
- [Stellar Soroban Custom Accounts](https://developers.stellar.org/docs/smart-contracts/custom-accounts)
