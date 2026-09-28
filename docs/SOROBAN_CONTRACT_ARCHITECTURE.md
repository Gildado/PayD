# Soroban Smart Contract Architecture

## Overview

PayD leverages Stellar's Soroban smart contracts to provide advanced payment orchestration capabilities. This document details the architecture, implementation patterns, and best practices for our contract suite.

## Contract Suite

### 1. Bulk Payment Contract

**Purpose**: Efficiently distribute payments to multiple recipients in a single transaction.

**Key Features**:
- Batch processing (up to 100 recipients per transaction)
- All-or-nothing and partial execution modes
- Automatic refund mechanisms for failed payments
- Spending limits (daily/weekly/monthly)
- Emergency pause functionality (circuit breaker)
- Scheduled batch execution
- SEP-0034 metadata support

**Architecture Patterns**:

#### Execution Modes

1. **Strict Mode (`all_or_nothing = true`)**
   - Atomic execution: entire batch succeeds or reverts
   - Pre-validation of all payment amounts
   - Direct sender-to-recipient transfers
   - Optimal for critical payroll runs

2. **Resilient Mode (`all_or_nothing = false`)**
   - Best-effort execution: valid payments proceed
   - Escrow mechanism for fund safety
   - Individual payment status tracking
   - Manual refund for failed payments
   - Optimal for bonus distributions

#### State Management

```rust
pub enum PaymentStatus {
    Pending  = 0,  // Initial state
    Sent     = 1,  // Successfully executed
    Failed   = 2,  // Validation failed, funds held
    Refunded = 3,  // Failed payment refunded
}
```

**State Transitions**:
- `Pending → Sent`: Successful payment execution
- `Pending → Failed`: Validation failure (invalid amount, insufficient funds)
- `Failed → Refunded`: Manual refund triggered

#### Security Features

1. **Spending Limits**
   - Configurable per-account limits (daily/weekly/monthly)
   - Rolling window tracking (based on ledger sequences)
   - Automatic reset after time window expires
   - Admin-configurable default and per-account overrides

2. **Replay Protection**
   - Sequence number validation
   - Per-sender ledger tracking
   - Prevents duplicate batch execution in same ledger

3. **Emergency Controls**
   - Circuit breaker pattern (pause/unpause)
   - Admin-only access to critical functions
   - Graceful degradation during incidents

#### Gas Optimization Techniques

1. **Single-Pass Validation**
   ```rust
   // Calculate total and validate in one loop (O(n))
   for op in payments.iter() {
       if op.amount <= 0 { return Err(ContractError::InvalidAmount); }
       total = total.checked_add(op.amount)?;
   }
   ```

2. **Batch Transfer Strategy**
   - Single bulk transfer to contract escrow
   - Individual distributions from escrow
   - Minimizes transaction overhead

3. **Storage Optimization**
   - Persistent storage for historical records
   - Temporary storage for transient data
   - TTL management to prevent archival

### 2. Cross-Asset Payment Contract

**Purpose**: Enable seamless payments across different asset types using Stellar's path payment operations.

**Key Features**:
- Automatic asset conversion via Stellar DEX
- Path finding for optimal exchange rates
- Slippage protection
- Multi-hop routing support

**Implementation Details**:

#### Path Finding Algorithm

1. **Source Asset → Destination Asset**
   - Query Stellar Horizon for available paths
   - Calculate conversion rates including fees
   - Select optimal path based on:
     - Minimum slippage
     - Lowest fee structure
     - Highest liquidity

2. **Slippage Protection**
   ```rust
   let min_dest_amount = dest_amount * (1.0 - slippage_tolerance);
   ```
   - Default tolerance: 2%
   - Configurable per transaction
   - Transaction reverts if slippage exceeds limit

#### Integration with Payroll

Cross-asset payments enable:
- Pay employees in their preferred currency
- Automatic conversion from organization's treasury asset
- Real-time exchange rate application
- Transparent fee disclosure

### 3. Vesting Escrow Contract

**Purpose**: Lock and gradually release tokens over time for employee compensation.

**Key Features**:
- Linear vesting schedules
- Cliff periods
- Early termination with partial vesting
- Beneficiary transfer

**Vesting Schedule Types**:

1. **Linear Vesting**
   ```
   Vested Amount = Total Amount × (Time Elapsed / Total Duration)
   ```

2. **Cliff Vesting**
   ```
   if Time < Cliff Period:
       Vested Amount = 0
   else:
       Vested Amount = Total Amount × ((Time - Cliff) / (Duration - Cliff))
   ```

### 4. Revenue Split Contract

**Purpose**: Automatically distribute incoming payments among multiple stakeholders.

**Key Features**:
- Percentage-based splits
- Fixed amount allocations
- Waterfall distribution logic
- Real-time settlement

**Use Cases**:
- Contractor payment splits
- Partnership revenue sharing
- Commission distributions
- Referral payments

## SEP-0001 Implementation (Issue #159)

### Asset Metadata Standard

PayD implements SEP-0001 to provide standardized asset information:

```rust
pub fn name(env: Env) -> String {
    String::from_str(&env, env!("CARGO_PKG_NAME"))
}

pub fn version(env: Env) -> String {
    String::from_str(&env, env!("CARGO_PKG_VERSION"))
}

pub fn author(env: Env) -> String {
    String::from_str(&env, env!("CARGO_PKG_AUTHORS"))
}
```

**Benefits**:
- Standardized contract identification
- Version tracking for upgrades
- Attribution and provenance
- Improved discoverability

### TOML Configuration

Asset metadata is also published via `.well-known/stellar.toml`:

```toml
[[CURRENCIES]]
code = "ORGUSD"
issuer = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
display_decimals = 7
name = "Organization USD"
desc = "Stable asset pegged to USD for payroll"
conditions = "Redeemable 1:1 for USD via anchor services"
image = "https://payd.example.com/assets/orgusd.png"
```

## SEP-24 Integration (Issue #190)

### Interactive Deposit/Withdrawal Flow

PayD integrates with anchor services for fiat on/off-ramps:

#### SEP-10 WebAuth Challenge-Response

1. **Challenge Request**
   ```typescript
   const challenge = await anchor.getChallenge(walletAddress);
   ```

2. **Sign Challenge**
   ```typescript
   const signedTx = await wallet.signTransaction(challenge);
   ```

3. **Token Exchange**
   ```typescript
   const authToken = await anchor.submitChallenge(signedTx);
   ```

#### SEP-24 Interactive Flow

1. **Initiate Withdrawal**
   ```typescript
   const withdrawUrl = await anchor.initiateWithdraw({
       asset_code: 'ORGUSD',
       amount: '1000.00',
       account: employeeWallet
   });
   ```

2. **User Completes KYC**
   - Redirect to anchor's interactive UI
   - User provides bank details
   - Anchor verifies identity

3. **Settlement**
   - Anchor burns ORGUSD tokens
   - Fiat transferred to employee's bank
   - Transaction recorded on-chain

**Security Considerations**:
- JWT token expiration (15 minutes)
- HTTPS-only communication
- Rate limiting on auth endpoints
- Webhook verification for status updates

## Testing Strategy

### Unit Tests

Each contract includes comprehensive unit tests:

```rust
#[test]
fn test_batch_execution_all_or_nothing() {
    let env = Env::default();
    // Setup test environment
    // Execute batch with invalid payment
    // Assert entire batch reverts
}

#[test]
fn test_batch_execution_partial() {
    let env = Env::default();
    // Setup test environment
    // Execute batch with mixed valid/invalid payments
    // Assert valid payments succeed, invalid fail
    // Verify refund mechanism
}
```

### Integration Tests

Test contract interactions:

```rust
#[test]
fn test_cross_asset_payment_with_bulk_distribution() {
    // Convert USD to XLM
    // Distribute XLM to multiple recipients
    // Verify amounts and exchange rates
}
```

### Gas Benchmarks

Monitor and optimize gas consumption:

```rust
#[test]
fn benchmark_batch_sizes() {
    for size in [10, 50, 100] {
        let gas_used = execute_batch_of_size(size);
        assert!(gas_used < MAX_GAS_PER_SIZE[size]);
    }
}
```

## Deployment Guide

### Testnet Deployment

1. **Build Contracts**
   ```bash
   cd contracts
   cargo build --target wasm32-unknown-unknown --release
   ```

2. **Optimize WASM**
   ```bash
   stellar contract optimize \
       --wasm target/wasm32-unknown-unknown/release/bulk_payment.wasm \
       --wasm-out bulk_payment_optimized.wasm
   ```

3. **Deploy to Testnet**
   ```bash
   stellar contract deploy \
       --wasm bulk_payment_optimized.wasm \
       --source ADMIN_SECRET_KEY \
       --network testnet
   ```

4. **Initialize Contract**
   ```bash
   stellar contract invoke \
       --id CONTRACT_ID \
       --source ADMIN_SECRET_KEY \
       --network testnet \
       -- initialize \
       --admin ADMIN_PUBLIC_KEY
   ```

### Mainnet Deployment

**Pre-Deployment Checklist**:
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Security audit completed
- [ ] Gas optimization verified
- [ ] Testnet deployment successful
- [ ] Admin multi-sig configured
- [ ] Emergency pause tested
- [ ] Monitoring alerts configured

**Deployment Steps**:
1. Deploy to mainnet using production keys
2. Initialize with multi-sig admin
3. Configure spending limits
4. Set up monitoring and alerting
5. Document contract addresses
6. Update frontend configuration

## Monitoring and Maintenance

### Key Metrics

1. **Transaction Success Rate**
   - Target: >99.9%
   - Alert if <99%

2. **Gas Consumption**
   - Track per operation type
   - Alert on unexpected spikes

3. **Failed Payment Rate**
   - Monitor refund queue depth
   - Alert if >5% failure rate

4. **TTL Health**
   - Monitor storage archival risk
   - Auto-extend critical entries

### Incident Response

1. **Circuit Breaker Activation**
   ```bash
   stellar contract invoke \
       --id CONTRACT_ID \
       --source ADMIN_SECRET_KEY \
       -- set_paused \
       --paused true
   ```

2. **Emergency Refund**
   ```bash
   # Refund all failed payments in batch
   for payment_index in $(seq 0 99); do
       stellar contract invoke \
           --id CONTRACT_ID \
           -- refund_failed_payment \
           --batch_id BATCH_ID \
           --payment_index $payment_index
   done
   ```

3. **Admin Key Rotation**
   ```bash
   stellar contract invoke \
       --id CONTRACT_ID \
       --source CURRENT_ADMIN_KEY \
       -- set_admin \
       --new_admin NEW_ADMIN_PUBLIC_KEY
   ```

## Best Practices

### For Contract Developers

1. **Always validate inputs**
   - Check for zero/negative amounts
   - Verify address formats
   - Validate array lengths

2. **Use checked arithmetic**
   ```rust
   total.checked_add(amount).ok_or(ContractError::AmountOverflow)?
   ```

3. **Implement comprehensive error handling**
   - Specific error codes for each failure mode
   - Descriptive error messages
   - Event emission for debugging

4. **Optimize storage access**
   - Batch reads/writes when possible
   - Use appropriate storage types (persistent vs temporary)
   - Manage TTL proactively

### For Integration Developers

1. **Handle all error cases**
   - Network failures
   - Insufficient funds
   - Contract paused
   - Sequence mismatches

2. **Implement retry logic**
   - Exponential backoff
   - Maximum retry attempts
   - Idempotency checks

3. **Monitor transaction status**
   - Poll for confirmation
   - Handle timeout scenarios
   - Verify on-chain state

4. **Test edge cases**
   - Maximum batch sizes
   - Minimum amounts
   - Concurrent transactions
   - Network congestion

## Future Enhancements

### Planned Features

1. **Multi-Token Batch Payments**
   - Pay different recipients in different assets
   - Single transaction, multiple asset types

2. **Conditional Payments**
   - Time-locked releases
   - Milestone-based triggers
   - Oracle integration

3. **Gas Sponsorship**
   - Organization pays gas for employee transactions
   - Improved UX for recipients

4. **Advanced Scheduling**
   - Recurring payments
   - Calendar-based triggers
   - Holiday handling

## References

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/)
- [SEP-0001: stellar.toml](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md)
- [SEP-0024: Hosted Deposit and Withdrawal](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md)
- [PayD Technical Whitepaper](../TECHNICAL_WHITEPAPER.md)

## Support

For questions or issues:
- Discord: https://discord.gg/payd-community
- Slack: https://join.slack.com/t/payd-community/shared_invite
- GitHub Issues: https://github.com/Gildado/PayD/issues
