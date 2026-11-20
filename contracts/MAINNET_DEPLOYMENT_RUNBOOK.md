# Mainnet Deployment Runbook for PayD Contracts

**Issue**: #1604  
**Status**: Ready for Stellar Wave mainnet launch  

This runbook documents the safe, sequential deployment procedure for all PayD Soroban contracts to mainnet, along with post-deployment verification steps and rollback procedures.

---

## Table of Contents

1. [Deployment Order](#deployment-order)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Deployment Steps](#deployment-steps)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Rollback Procedures](#rollback-procedures)
6. [Recovery Scenarios](#recovery-scenarios)

---

## Deployment Order

The following order ensures all dependencies are resolved and initialized correctly:

1. **orgusd** – Custom stable asset contract (foundation for all token transfers)
2. **smart_wallet** – Multisig governance contract (used by downstream escrow contracts)
3. **milestone_escrow** – Verifier-gated escrow (depends on token contract)
4. **vesting_escrow** – Time-based vesting (depends on token contract)
5. **bulk_payment** – Batch payment processor (depends on token & wallet contracts)
6. **asset_path_payment** – Cross-asset payment routing (depends on token contract)
7. **revenue_split** – Revenue distribution (depends on token contract)
8. **cross_asset_payment** – Multi-asset settlement (depends on token contract)

### Rationale

- **orgusd** is deployed first as it is the settlement token for all other contracts.
- **smart_wallet** is deployed second because escrow contracts often use it for governance.
- **Escrow contracts** (milestone, vesting) are deployed before payment processors to ensure proper authorization setup.
- **Payment processors** (bulk_payment, asset_path_payment, revenue_split, cross_asset_payment) are deployed last, once the infrastructure layer is stable.

---

## Pre-Deployment Checklist

### Code Review & Security Audit

- [ ] All contract source code has been peer-reviewed
- [ ] Security audit completed and findings addressed
- [ ] Clippy and rustfmt pass without warnings
- [ ] Full test suite passes (unit + integration + edge cases)
- [ ] No regressions to existing authorization or circuit-breaker behavior

### Environment Verification

- [ ] All secret keys and admin addresses are staged in secure key management system
- [ ] Testnet deployment is complete and verified (same contracts, same versions)
- [ ] Mainnet network is accessible and stable
- [ ] Gas fees are monitored and within budget
- [ ] Deployment tooling (Soroban CLI, scripts) is up-to-date

### Documentation

- [ ] Each contract has updated README.md with mainnet-specific considerations
- [ ] All new functions have inline documentation
- [ ] Integration points between contracts are clearly documented
- [ ] Recovery and emergency procedures are tested on testnet

### Authorization Setup

- [ ] Admin addresses are confirmed (e.g., smart_wallet multisig for orgusd)
- [ ] Key custody model is established (single admin vs multisig)
- [ ] Time-lock delays are configured appropriately for mainnet
- [ ] Emergency pause/unpause capabilities are in place

---

## Deployment Steps

### 1. orgusd Deployment

```bash
# 1.1 Build the contract
cd contracts/orgusd
cargo build --release --target wasm32-unknown-unknown

# 1.2 Deploy to mainnet
ORGUSD_CONTRACT_ID=$(soroban contract deploy \
  --network public \
  --source-account <ADMIN_KEY> \
  --wasm ./target/wasm32-unknown-unknown/release/orgusd.wasm)

echo "ORGUSD deployed: $ORGUSD_CONTRACT_ID"

# 1.3 Initialize with admin (multi-sig smart_wallet address or single key)
soroban contract invoke \
  --network public \
  --source-account <ADMIN_KEY> \
  --id $ORGUSD_CONTRACT_ID \
  -- \
  initialize \
  --admin <ADMIN_ADDRESS>

# 1.4 Log the contract ID for downstream contracts
echo "export ORGUSD_CONTRACT_ID=$ORGUSD_CONTRACT_ID" >> .env.mainnet
```

### 2. smart_wallet Deployment

```bash
# 2.1 Build the contract
cd contracts/smart_wallet
cargo build --release --target wasm32-unknown-unknown

# 2.2 Deploy to mainnet
SMART_WALLET_CONTRACT_ID=$(soroban contract deploy \
  --network public \
  --source-account <ADMIN_KEY> \
  --wasm ./target/wasm32-unknown-unknown/release/smart_wallet.wasm)

echo "smart_wallet deployed: $SMART_WALLET_CONTRACT_ID"

# 2.3 Initialize with signers and threshold
soroban contract invoke \
  --network public \
  --source-account <SIGNER_KEY_1> \
  --id $SMART_WALLET_CONTRACT_ID \
  -- \
  init \
  --signers '[<SIGNERS_JSON>]' \
  --threshold <THRESHOLD_M_OF_N>

echo "export SMART_WALLET_CONTRACT_ID=$SMART_WALLET_CONTRACT_ID" >> .env.mainnet
```

### 3. Escrow Contracts Deployment

```bash
# 3.1 Deploy milestone_escrow
cd contracts/milestone_escrow
cargo build --release --target wasm32-unknown-unknown

MILESTONE_ESCROW_ID=$(soroban contract deploy \
  --network public \
  --source-account <ADMIN_KEY> \
  --wasm ./target/wasm32-unknown-unknown/release/milestone_escrow.wasm)

soroban contract invoke \
  --network public \
  --source-account <ADMIN_KEY> \
  --id $MILESTONE_ESCROW_ID \
  -- \
  initialize \
  --admin <ADMIN_ADDRESS>

echo "export MILESTONE_ESCROW_ID=$MILESTONE_ESCROW_ID" >> .env.mainnet

# 3.2 Deploy vesting_escrow
cd contracts/vesting_escrow
cargo build --release --target wasm32-unknown-unknown

VESTING_ESCROW_ID=$(soroban contract deploy \
  --network public \
  --source-account <ADMIN_KEY> \
  --wasm ./target/wasm32-unknown-unknown/release/vesting_escrow.wasm)

soroban contract invoke \
  --network public \
  --source-account <ADMIN_KEY> \
  --id $VESTING_ESCROW_ID \
  -- \
  initialize \
  --admin <ADMIN_ADDRESS> \
  --token $ORGUSD_CONTRACT_ID

echo "export VESTING_ESCROW_ID=$VESTING_ESCROW_ID" >> .env.mainnet
```

### 4. Payment Processor Deployment

```bash
# 4.1 Deploy bulk_payment
cd contracts/bulk_payment
cargo build --release --target wasm32-unknown-unknown

BULK_PAYMENT_ID=$(soroban contract deploy \
  --network public \
  --source-account <ADMIN_KEY> \
  --wasm ./target/wasm32-unknown-unknown/release/bulk_payment.wasm)

echo "export BULK_PAYMENT_ID=$BULK_PAYMENT_ID" >> .env.mainnet

# 4.2 Deploy asset_path_payment
cd contracts/asset_path_payment
cargo build --release --target wasm32-unknown-unknown

ASSET_PATH_PAYMENT_ID=$(soroban contract deploy \
  --network public \
  --source-account <ADMIN_KEY> \
  --wasm ./target/wasm32-unknown-unknown/release/asset_path_payment.wasm)

echo "export ASSET_PATH_PAYMENT_ID=$ASSET_PATH_PAYMENT_ID" >> .env.mainnet

# 4.3 Deploy revenue_split
cd contracts/revenue_split
cargo build --release --target wasm32-unknown-unknown

REVENUE_SPLIT_ID=$(soroban contract deploy \
  --network public \
  --source-account <ADMIN_KEY> \
  --wasm ./target/wasm32-unknown-unknown/release/revenue_split.wasm)

echo "export REVENUE_SPLIT_ID=$REVENUE_SPLIT_ID" >> .env.mainnet

# 4.4 Deploy cross_asset_payment
cd contracts/cross_asset_payment
cargo build --release --target wasm32-unknown-unknown

CROSS_ASSET_PAYMENT_ID=$(soroban contract deploy \
  --network public \
  --source-account <ADMIN_KEY> \
  --wasm ./target/wasm32-unknown-unknown/release/cross_asset_payment.wasm)

echo "export CROSS_ASSET_PAYMENT_ID=$CROSS_ASSET_PAYMENT_ID" >> .env.mainnet
```

---

## Post-Deployment Verification

### Verification Checklist

After all contracts are deployed, run these verification tests:

```bash
# 1. Verify all contracts are live and responding
for CONTRACT_ID in $ORGUSD_CONTRACT_ID $SMART_WALLET_CONTRACT_ID \
                    $MILESTONE_ESCROW_ID $VESTING_ESCROW_ID \
                    $BULK_PAYMENT_ID $ASSET_PATH_PAYMENT_ID \
                    $REVENUE_SPLIT_ID $CROSS_ASSET_PAYMENT_ID; do
  echo "Testing $CONTRACT_ID..."
  soroban contract invoke \
    --network public \
    --id $CONTRACT_ID \
    -- \
    name
done

# 2. Verify contract versions
soroban contract invoke --network public --id $ORGUSD_CONTRACT_ID -- version
soroban contract invoke --network public --id $SMART_WALLET_CONTRACT_ID -- version

# 3. Verify authorization setup
soroban contract invoke \
  --network public \
  --id $ORGUSD_CONTRACT_ID \
  -- \
  get_admin

# 4. Test basic functionality (non-state-changing reads)
soroban contract invoke \
  --network public \
  --id $ORGUSD_CONTRACT_ID \
  -- \
  total_supply

# 5. Verify all storage keys are initialized
# (Run against each contract to ensure no missing initializations)
```

### Integration Verification

```bash
# 1. Verify orgusd + smart_wallet integration
# Test authorizing a smart_wallet address on orgusd

# 2. Verify milestone_escrow can handle ORGUSD tokens
# Create a test escrow with ORGUSD as payment token

# 3. Verify vesting_escrow points to correct ORGUSD instance

# 4. Test bulk_payment can send ORGUSD via smart_wallet
```

---

## Rollback Procedures

### Scenario 1: Pre-Deployment Failure

If deployment fails before reaching any critical state:

1. **Analyze the error** – Check Soroban logs and contract output
2. **Fix the issue** – Update contract code or deployment parameters
3. **Re-deploy** – Start from the failed step in the deployment sequence

### Scenario 2: Post-Deployment Verification Failure

If verification fails after deployment but before mainnet traffic:

1. **Stop all external traffic** – Pause ingress to newly deployed contracts
2. **Isolate the failing contract** – Identify which contract needs rollback
3. **Option A: Pause the contract** – If the contract supports emergency pause:
   ```bash
   soroban contract invoke \
     --network public \
     --source-account <ADMIN_KEY> \
     --id <FAILING_CONTRACT_ID> \
     -- \
     set_paused \
     --paused true
   ```
4. **Option B: Redeploy** – Deploy a corrected version and re-initialize from a known state

### Scenario 3: Critical Security Issue Post-Deployment

If a critical security issue is discovered after mainnet deployment:

1. **Engage the circuit breaker** – Pause all affected contracts:
   ```bash
   for CONTRACT_ID in $ORGUSD_CONTRACT_ID $MILESTONE_ESCROW_ID \
                       $VESTING_ESCROW_ID $BULK_PAYMENT_ID; do
     soroban contract invoke \
       --network public \
       --source-account <ADMIN_KEY> \
       --id $CONTRACT_ID \
       -- \
       set_paused \
       --paused true
   done
   ```
2. **Announce the pause** – Notify all users and integrators of the pause status
3. **Coordinate remediation** – Work with the security team and governance
4. **Deploy patched version** – Once fixes are validated on testnet
5. **Data migration** (if needed) – Transfer user balances and state to new contracts

---

## Recovery Scenarios

### Recovering from Contract Admin Key Loss

**For orgusd** (single-admin):
1. Propose a new admin via `propose_admin_transfer` (2-step transfer with time-lock)
2. Have the proposed admin call `accept_admin_transfer` after time-lock expires
3. If the current admin cannot be reached, governance must vote to authorize the transfer

**For smart_wallet** (multisig):
1. If M-of-N signers are lost, use the signer recovery mechanism:
   - Gather the remaining signers
   - Call `add_signer` for new key (requires current threshold signatures)
   - Call `remove_signer` for lost key (requires current threshold signatures)
   - Adjust threshold if needed
2. If more than N-M signers are compromised, the wallet is permanently locked

### Recovering from Frozen or Blacklisted Account

1. **For orgusd accounts**:
   ```bash
   # Admin unfreezes the account
   soroban contract invoke \
     --network public \
     --source-account <ADMIN_KEY> \
     --id $ORGUSD_CONTRACT_ID \
     -- \
     unfreeze \
     --account <FROZEN_ACCOUNT>
   ```

2. **For revoked authorizations**:
   ```bash
   # Admin re-authorizes the account
   soroban contract invoke \
     --network public \
     --source-account <ADMIN_KEY> \
     --id $ORGUSD_CONTRACT_ID \
     -- \
     authorize \
     --account <REVOKED_ACCOUNT>
   ```

### Recovering from Failed Milestone Release

1. **Check milestone status**:
   ```bash
   soroban contract invoke \
     --network public \
     --id $MILESTONE_ESCROW_ID \
     -- \
     get_escrow \
     --escrow_id <ESCROW_ID>
   ```

2. **If verifier approval is stuck**:
   - Contact the verifier to inspect and approve the milestone
   - If verifier is unavailable, consider governance intervention or contract pause

3. **If release transaction failed**:
   - Re-submit the `release_milestone` call with fresh fees
   - Check for replay protection ledger conflicts

---

## Maintenance Tasks

### Weekly Checks

- [ ] Verify all contracts are responding to health checks
- [ ] Monitor gas fees and contract balance reserves
- [ ] Review authorization and access control logs
- [ ] Check for any failed transactions that require manual intervention

### Monthly Checks

- [ ] Run full integration test suite against mainnet contracts
- [ ] Verify admin keys and multisig setup are still secure
- [ ] Update contract documentation with any operational changes
- [ ] Audit escrow contract balances against on-ledger state

### Quarterly Reviews

- [ ] Security audit of contract state and authorization model
- [ ] Review all pending operations (time-locked mints, clawbacks) for consistency
- [ ] Performance benchmarks and optimization assessment
- [ ] Update this runbook based on operational learnings

---

## Emergency Contacts & Escalation

- **Security Issue**: security@payd.dev
- **Critical Bug**: dev-team@payd.dev
- **Governance Vote**: governance-team@payd.dev

---

## References

- [SOROBAN_CONTRACT_ARCHITECTURE.md](../docs/SOROBAN_CONTRACT_ARCHITECTURE.md)
- [orgusd README](./orgusd/README.md)
- [smart_wallet README](./smart_wallet/README.md)
- [milestone_escrow README](./milestone_escrow/README.md)
- [Stellar Soroban Docs](https://developers.stellar.org/docs/smart-contracts)
