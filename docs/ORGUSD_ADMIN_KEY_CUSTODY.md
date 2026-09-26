# ORGUSD Admin Key Custody Model Review

**Issue**: #1599  
**Title**: Review orgusd admin key custody model for mainnet  
**Status**: Complete  

---

## Executive Summary

This document reviews the admin key custody model for ORGUSD on mainnet and recommends a **multisig smart_wallet** as the administrator instead of a single key.

**Recommendation**: Use the `smart_wallet` contract as the ORGUSD admin to enforce M-of-N multisig governance for all critical operations (minting, authorization, freezing, clawback).

---

## Current State

### Single Admin Key Model

The current ORGUSD implementation stores a single `Admin` address in contract storage:

```rust
pub enum DataKey {
    Admin,  // Single Address
    // ...
}
```

**Risks of Single Admin Key**:
1. **Key Loss**: If the admin key is lost, ORGUSD cannot be minted or managed
2. **Single Point of Failure**: One compromised key compromises all critical operations
3. **No Approval Process**: Admin can freeze accounts or clawback funds unilaterally without oversight

### Current Mitigations

ORGUSD does implement some safety mechanisms:
- **Two-step admin transfer** (`propose_admin_transfer` / `accept_admin_transfer`) with time-lock
- **Time-locked operations** for mint and clawback (24-hour default delay)
- **Authorization & freeze controls** requiring proper authorization for state changes

However, these mitigations are all controlled by a single admin key.

---

## Threat Model

### Scenario 1: Admin Key Compromise

**Single Admin**:
- Attacker gains control of minting, authorization, freeze, and clawback
- Can drain all ORGUSD from any account via clawback
- No way to stop the attacker without governance intervention

**Multisig Admin (smart_wallet)**:
- Attacker needs M-of-N keys (e.g., 3-of-5)
- Other signers can refuse to sign malicious operations
- Signer recovery mechanism allows removing compromised keys

### Scenario 2: Admin Key Loss

**Single Admin**:
- ORGUSD becomes un-administerable
- No way to mint new tokens or authorize accounts
- Requires governance vote to deploy a new contract

**Multisig Admin (smart_wallet)**:
- Other signers can still operate the wallet
- New signers can be added if enough signers remain
- Threshold can be adjusted after key loss

### Scenario 3: Regulatory Hold / Account Freeze

**Single Admin**:
- Admin can unilaterally freeze any account
- No transparency or governance oversight
- Potential regulatory liability

**Multisig Admin (smart_wallet)**:
- Multiple signers must agree on freeze operations
- Transparent audit trail of who authorized each action
- Signers can require evidence before signing freeze requests

---

## Recommended Solution: Multisig Smart Wallet

### Architecture

1. **Deploy smart_wallet** with M-of-N signers:
   - N = number of trusted governance parties (e.g., 5)
   - M = minimum threshold (e.g., 3)
   - Signers include: dev team, ops team, security team, legal team, community representative

2. **Set smart_wallet as ORGUSD admin**:
   ```rust
   let smart_wallet_address = Address::from_contract_id(&env, &SMART_WALLET_CONTRACT_ID);
   
   orgusd_contract.initialize(env, smart_wallet_address)?;
   ```

3. **All ORGUSD admin operations require smart_wallet multisig**:
   - Minting: requires 3-of-5 smart_wallet signatures
   - Authorization: requires 3-of-5 smart_wallet signatures
   - Freeze/Unfreeze: requires 3-of-5 smart_wallet signatures
   - Clawback: requires 3-of-5 smart_wallet signatures

### Benefits

| Aspect | Single Admin | Multisig Admin |
|--------|------------|----------------|
| **Key Loss Resilience** | No | Yes (M-of-N threshold) |
| **Compromise Resilience** | No | Yes (requires M keys) |
| **Governance Transparency** | No | Yes (multi-party approval) |
| **Signer Recovery** | N/A | Yes (add_signer / remove_signer) |
| **Audit Trail** | Limited | Full (all signatures logged) |
| **Time to Recovery** | Governance vote | ~M-of-N signatures |

---

## Implementation Guidance

### Step 1: Initialize smart_wallet with Signers

Before deploying ORGUSD to mainnet:

```bash
# Deploy smart_wallet
SMART_WALLET_ID=$(soroban contract deploy \
  --network public \
  --source-account <DEPLOYER_KEY> \
  --wasm ./target/wasm32-unknown-unknown/release/smart_wallet.wasm)

# Initialize with 3-of-5 multisig
soroban contract invoke \
  --network public \
  --source-account <SIGNER_1> \
  --id $SMART_WALLET_ID \
  -- \
  init \
  --signers '[
    {"ed25519":"<ED25519_SIGNER_1>"},
    {"ed25519":"<ED25519_SIGNER_2>"},
    {"ed25519":"<ED25519_SIGNER_3>"},
    {"secp256k1":"<SECP256K1_SIGNER_4>"},
    {"secp256k1":"<SECP256K1_SIGNER_5>"}
  ]' \
  --threshold 3
```

### Step 2: Deploy ORGUSD with smart_wallet as Admin

```bash
# Deploy ORGUSD
ORGUSD_ID=$(soroban contract deploy \
  --network public \
  --source-account <DEPLOYER_KEY> \
  --wasm ./target/wasm32-unknown-unknown/release/orgusd.wasm)

# Initialize with smart_wallet as admin
soroban contract invoke \
  --network public \
  --source-account <SIGNER_1> \
  --id $ORGUSD_ID \
  -- \
  initialize \
  --admin <SMART_WALLET_CONTRACT_ID>
```

### Step 3: Multi-Signature Minting

To mint ORGUSD with multisig approval:

```bash
# Signer 1 initiates
soroban contract invoke \
  --network public \
  --source-account <SIGNER_1_KEY> \
  --id $SMART_WALLET_ID \
  -- \
  propose_mint \
  --to <RECIPIENT> \
  --amount 100000

# Signers 2 and 3 approve (showing 3-of-5 threshold met)
# Then execute the time-locked mint after delay expires
```

---

## Migration Path (If Already Deployed with Single Admin)

If ORGUSD is already live with a single admin key:

1. **Propose Admin Transfer**:
   ```bash
   soroban contract invoke \
     --network public \
     --source-account <CURRENT_ADMIN_KEY> \
     --id $ORGUSD_ID \
     -- \
     propose_admin_transfer \
     --new_admin <SMART_WALLET_CONTRACT_ID>
   ```

2. **Wait for time-lock to expire** (24 hours by default)

3. **Accept Transfer** (requires smart_wallet multisig):
   ```bash
   soroban contract invoke \
     --network public \
     --source-account <SIGNER_1_KEY> \
     --id $ORGUSD_ID \
     -- \
     accept_admin_transfer
   ```

---

## Signer Rotation & Recovery

### Regular Signer Rotation (Recommended Annually)

1. **Identify signer to rotate** (e.g., departing team member)
2. **Add new signer**:
   ```bash
   # Requires M-of-N multisig from smart_wallet
   soroban contract invoke \
     --network public \
     --source-account <SIGNER_1_KEY> \
     --id $SMART_WALLET_ID \
     -- \
     add_signer \
     --new_signer <NEW_SIGNER_KEY>
   ```
3. **Remove old signer**:
   ```bash
   soroban contract invoke \
     --network public \
     --source-account <SIGNER_1_KEY> \
     --id $SMART_WALLET_ID \
     -- \
     remove_signer \
     --signer <OLD_SIGNER_KEY>
   ```

### Emergency Key Recovery (If Key Compromised)

1. **Assess compromise severity** (check if M-of-N keys are compromised)
2. **Add replacement signer** (if threshold still meets M-of-N):
   ```bash
   soroban contract invoke \
     --network public \
     --source-account <TRUSTED_SIGNER_KEY> \
     --id $SMART_WALLET_ID \
     -- \
     add_signer \
     --new_signer <REPLACEMENT_KEY>
   ```
3. **Remove compromised signer**:
   ```bash
   soroban contract invoke \
     --network public \
     --source-account <TRUSTED_SIGNER_KEY> \
     --id $SMART_WALLET_ID \
     -- \
     remove_signer \
     --signer <COMPROMISED_KEY>
   ```

---

## Security Considerations

### Threshold Selection

| Threshold | Pros | Cons |
|-----------|------|------|
| **2-of-3** | Low operational friction | Higher compromise risk |
| **3-of-5** | Good balance of security & UX | Requires coordination |
| **4-of-7** | High security | More complex operations |

**Recommendation**: 3-of-5 for mainnet PayD deployment.

### Signer Distribution

- **Geographic diversity**: Signers in different regions (resistance to natural disasters)
- **Organizational diversity**: Mix of dev, ops, security, legal roles
- **Key type diversity**: Mix of Ed25519 and secp256k1 keys (resist algorithm breaks)
- **Custody diversity**: Hardware wallets, cold storage, multisig vaults

### Operational Procedures

1. **Signing requests** require explicit approval from each signer
2. **Approval process** must include review of operation details (amount, recipient, etc.)
3. **Time-locked operations** provide a buffer for dispute or correction
4. **Audit logging** records all signatures and operations for compliance

---

## Testing & Validation

### Unit Tests Required

- [ ] Test multisig requirement for mint operations
- [ ] Test that single signer cannot mint unilaterally
- [ ] Test signer recovery (add_signer, remove_signer)
- [ ] Test threshold changes
- [ ] Test signer duplicate prevention

### Integration Tests Required

- [ ] Test smart_wallet + ORGUSD integration end-to-end
- [ ] Test multi-signature minting flow (propose → sign → execute)
- [ ] Test signer rotation under load
- [ ] Test failure modes (signer timeout, invalid signature)

### Mainnet Validation

- [ ] Deploy to testnet with 3-of-5 multisig
- [ ] Run full test suite on testnet
- [ ] Dry-run admin operations with actual signers
- [ ] Verify all integrations work with smart_wallet as admin

---

## Compliance & Governance

### Regulatory Considerations

- **Immutability**: Once ORGUSD is minted, only admin can clawback (ensure regulatory clarity)
- **Freezing**: Document freeze procedures for regulatory holds
- **Custody**: Smart_wallet custody model must comply with local regulations
- **Audit trail**: Maintain logs of all multisig approvals for compliance reporting

### Governance Process

1. **Proposal**: Any signer can propose a multisig operation
2. **Review**: All operations are reviewed before signing
3. **Approval**: Requires M-of-N signatures within a review window
4. **Execution**: Operations execute after time-lock window expires
5. **Logging**: All approvals and executions are logged for audit

---

## Conclusion

**Recommendation**: Use the `smart_wallet` contract as ORGUSD admin with a 3-of-5 multisig threshold.

**Benefits**:
- Distributed governance prevents single admin compromise
- Signer recovery mechanism improves operational resilience
- Time-lock operations provide governance oversight window
- Audit trail supports regulatory compliance

**Next Steps**:
1. Deploy smart_wallet to mainnet with 3-of-5 signer configuration
2. Initialize ORGUSD with smart_wallet as admin
3. Test full multisig flow on testnet before mainnet go-live
4. Document signer identity and custody procedures
5. Establish governance process for approving mints and clawbacks

---

## References

- [smart_wallet README](../contracts/smart_wallet/README.md)
- [ORGUSD README](../contracts/orgusd/README.md)
- [MAINNET_DEPLOYMENT_RUNBOOK.md](./MAINNET_DEPLOYMENT_RUNBOOK.md)
