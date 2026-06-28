# Contract Storage Layout

This document provides a detailed map of the storage footprint (instance, persistent, and temporary) for the Soroban smart contracts in the PayD repository. Understanding storage layout is critical for gas optimization and contract upgrade planning.

## Table of Contents

- [Storage Types Overview](#storage-types-overview)
- [Contract Specifications](#contract-specifications)
- [Storage Footprint Analysis](#storage-footprint-analysis)
- [TTL Management](#ttl-management)
- [Gas Optimization Tips](#gas-optimization-tips)
- [Contract Development Guide](#contract-development-guide)

## Storage Types Overview

Soroban contracts use three types of storage, each with different cost and TTL characteristics:

### Instance Storage
- **Scope**: Contract-wide singleton data
- **TTL**: Extends with contract invocation (default 6 months)
- **Cost**: Highest (1 byte = 1 byte-second cost)
- **Use case**: Configuration, admin addresses, global state
- **Limit**: ~4KB per contract

### Persistent Storage
- **Scope**: Key-value pairs with explicit keys
- **TTL**: Extends with contract invocation (default 6 months)
- **Cost**: Medium (1 byte = 1 byte-second cost)
- **Use case**: User balances, payment records, configuration
- **Limit**: Unlimited (but costs increase with size)

### Temporary Storage
- **Scope**: Key-value pairs with explicit keys
- **TTL**: Short-lived (default 10 minutes)
- **Cost**: Low (1 byte = 0.1 byte-second cost)
- **Use case**: Batch processing, intermediate calculations, temporary state
- **Limit**: Unlimited (but short TTL)

---

## Contract Specifications

### 1. Bulk Payment (`contracts/bulk_payment/src/lib.rs`)

**Purpose**: Execute batch payroll payments to multiple recipients in a single transaction.

**Instance Storage** (Singleton, ~200 bytes)
| Key | Type | Size | Purpose |
|-----|------|------|---------|
| `DataKey::Paused` | `bool` | 1 byte | Contract pause state |
| `DataKey::DefaultLimits` | `AccountLimits` | ~64 bytes | Default rate limits for accounts |
| `DataKey::TotalBonusesPaid` | `i128` | 16 bytes | Accumulator for total bonuses distributed |

**Persistent Storage** (Per-account & global, ~1-2KB per active account)
| Key | Type | Size | Purpose | TTL |
|-----|------|------|---------|-----|
| `DataKey::Admin` | `Address` | 32 bytes | Admin address (TTL extended) | 6 months |
| `DataKey::BatchCount` | `u64` | 8 bytes | Total batches created counter | 6 months |
| `DataKey::Sequence` | `u64` | 8 bytes | Nonce for replay protection | 6 months |
| `DataKey::AcctLimits(Address)` | `AccountLimits` | ~64 bytes | Per-account rate limits | 6 months |
| `DataKey::AcctUsage(Address)` | `AccountUsage` | ~32 bytes | Per-account usage tracking | 6 months |

**Temporary Storage** (Batch-scoped, ~100-500 bytes per batch)
| Key | Type | Size | Purpose | TTL |
|-----|------|------|---------|-----|
| `DataKey::Batch(u64)` | `BatchRecord` | ~200-400 bytes | Batch metadata (recipient list, amounts) | 10 minutes |
| `DataKey::PaymentEntry(u64, u64)` | `PaymentDetail` | ~50 bytes | Individual payment within batch | 10 minutes |

**Storage Footprint**: ~2-3KB per active account + ~300 bytes per batch

**Gas Optimization Notes**:
- Batch operations are temporary; use temporary storage to reduce costs
- Reuse batch IDs when possible to avoid creating new persistent entries
- Consider pagination for large recipient lists (>100 recipients)

---

### 2. Vesting Escrow (`contracts/vesting_escrow/src/lib.rs`)

**Purpose**: Time-locked fund release with configurable vesting schedules for employee compensation.

**Instance Storage** (Singleton, ~100 bytes)
| Key | Type | Size | Purpose |
|-----|------|------|---------|
| `DataKey::Admin` | `Address` | 32 bytes | Admin address |
| `DataKey::Paused` | `bool` | 1 byte | Pause state |

**Persistent Storage** (Per-vesting schedule, ~500 bytes per schedule)
| Key | Type | Size | Purpose | TTL |
|-----|------|------|---------|-----|
| `DataKey::Config` | `VestingConfig` | ~200 bytes | Main vesting configuration (cliff, duration, amount) | 6 months |
| `DataKey::Beneficiary(Address)` | `BeneficiaryInfo` | ~100 bytes | Beneficiary details and claimed amount | 6 months |
| `DataKey::Schedule(u64)` | `ScheduleInfo` | ~150 bytes | Individual vesting schedule metadata | 6 months |

**Storage Footprint**: ~500 bytes per active vesting schedule

**Gas Optimization Notes**:
- Vesting schedules are long-lived; use persistent storage
- Batch multiple beneficiaries in a single transaction to amortize gas costs
- Consider archiving completed vesting schedules to reduce storage

---

### 3. Asset Path Payment (`contracts/asset_path_payment/src/lib.rs`)

**Purpose**: Advanced routing for multi-asset payments with automatic path finding.

**Instance Storage** (Singleton, ~100 bytes)
| Key | Type | Size | Purpose |
|-----|------|------|---------|
| `DataKey::Admin` | `Address` | 32 bytes | Admin address |
| `DataKey::Paused` | `bool` | 1 byte | Pause state |

**Persistent Storage** (Per-payment record, ~1KB per payment)
| Key | Type | Size | Purpose | TTL |
|-----|------|------|---------|-----|
| `DataKey::PaymentCount` | `u64` | 8 bytes | Total payments processed counter | 6 months |
| `DataKey::Payment(u64)` | `PaymentRecord` | ~300-500 bytes | Payment details (source, destination, path, status) | 6 months |
| `DataKey::PathCache(Asset, Asset)` | `Vec<Asset>` | ~100-200 bytes | Cached payment paths for common asset pairs | 6 months |

**Storage Footprint**: ~1KB per payment record + ~200 bytes per cached path

**Gas Optimization Notes**:
- Cache frequently-used payment paths to reduce computation
- Use temporary storage for intermediate path calculations
- Prune old payment records periodically (archive to off-chain storage)

---

### 4. Revenue Split (`contracts/revenue_split/src/lib.rs`)

**Purpose**: Distribute revenue among multiple recipients according to configurable split ratios.

**Instance Storage** (Singleton, ~100 bytes)
| Key | Type | Size | Purpose |
|-----|------|------|---------|
| `DataKey::Admin` | `Address` | 32 bytes | Admin address |
| `DataKey::Paused` | `bool` | 1 byte | Pause state |

**Persistent Storage** (Per-split configuration, ~500 bytes per config)
| Key | Type | Size | Purpose | TTL |
|-----|------|------|---------|-----|
| `DataKey::Recipients` | `Vec<RecipientShare>` | ~200-400 bytes | List of recipients and their share percentages | 6 months |
| `DataKey::TotalDistributed` | `i128` | 16 bytes | Cumulative amount distributed | 6 months |
| `DataKey::RecipientBalance(Address)` | `i128` | 16 bytes | Per-recipient accumulated balance | 6 months |

**Storage Footprint**: ~500 bytes per split configuration + ~16 bytes per recipient

**Gas Optimization Notes**:
- Limit recipient list to <50 recipients per split to minimize storage
- Use batch distributions to amortize gas costs across multiple recipients
- Consider off-chain aggregation for high-frequency distributions

---

### 5. Cross Asset Payment (`contracts/cross_asset_payment/src/lib.rs`)

**Purpose**: Atomic cross-asset swap and payment routing between different Stellar assets.

**Instance Storage** (Singleton, ~100 bytes)
| Key | Type | Size | Purpose |
|-----|------|------|---------|
| `DataKey::Admin` | `Address` | 32 bytes | Admin address |
| `DataKey::Paused` | `bool` | 1 byte | Pause state |

**Persistent Storage** (Per-payment, ~1.5KB per payment)
| Key | Type | Size | Purpose | TTL |
|-----|------|------|---------|-----|
| `DataKey::PaymentCount` | `u64` | 8 bytes | Total cross-asset payments counter | 6 months |
| `DataKey::Payment(u64)` | `CrossAssetPayment` | ~400-600 bytes | Payment details (source asset, destination asset, amount, rate) | 6 months |
| `DataKey::ExchangeRate(Asset, Asset)` | `i128` | 16 bytes | Cached exchange rates for asset pairs | 6 months |

**Temporary Storage** (Per-swap, ~200 bytes per swap)
| Key | Type | Size | Purpose | TTL |
|-----|------|------|---------|-----|
| `DataKey::SwapQuote(u64)` | `QuoteInfo` | ~100-150 bytes | Temporary swap quote for rate locking | 10 minutes |

**Storage Footprint**: ~1.5KB per payment + ~16 bytes per cached rate

**Gas Optimization Notes**:
- Cache exchange rates to avoid repeated oracle calls
- Use temporary storage for swap quotes (expires after 10 minutes)
- Batch multiple cross-asset payments to reduce per-payment overhead

---

## Storage Footprint Analysis

### Total Storage by Contract

| Contract | Instance | Persistent | Temporary | Total |
|----------|----------|-----------|-----------|-------|
| Bulk Payment | ~200 bytes | ~2-3KB/account | ~300 bytes/batch | ~3-4KB active |
| Vesting Escrow | ~100 bytes | ~500 bytes/schedule | None | ~500 bytes/schedule |
| Asset Path Payment | ~100 bytes | ~1KB/payment | ~100 bytes/calc | ~1.1KB/payment |
| Revenue Split | ~100 bytes | ~500 bytes/config | None | ~500 bytes/config |
| Cross Asset Payment | ~100 bytes | ~1.5KB/payment | ~200 bytes/swap | ~1.7KB/payment |

### Estimated Monthly Storage Costs (Testnet)

Assuming 1000 active accounts and 100 payments/month:

| Contract | Monthly Cost (XLM) |
|----------|-------------------|
| Bulk Payment | ~0.5 XLM |
| Vesting Escrow | ~0.1 XLM |
| Asset Path Payment | ~0.2 XLM |
| Revenue Split | ~0.1 XLM |
| Cross Asset Payment | ~0.3 XLM |
| **Total** | **~1.2 XLM** |

---

## TTL Management

### TTL Extension Strategy

All persistent storage entries have a default TTL of 6 months. To prevent data expiration:

```rust
// Extend TTL on every contract invocation
env.storage().instance().extend_ttl(157680000, 157680000); // 5 years

// For persistent storage
env.storage().persistent().extend_ttl(
    &DataKey::Admin,
    157680000, // ledger_bump_to_live
    157680000  // ledger_bump_to_live_back
);
```

### TTL Monitoring

Monitor TTL expiration in the backend:

```typescript
// Check if contract data is about to expire
const lastSyncedAt = wallet.last_synced_at;
const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);

if (lastSyncedAt < sixMonthsAgo) {
  // Trigger TTL extension transaction
  await extendContractTTL(contractId);
}
```

---

## Gas Optimization Tips

### 1. Minimize Persistent Storage Writes

```rust
// Bad: Multiple writes
env.storage().persistent().set(&DataKey::Count, &(count + 1));
env.storage().persistent().set(&DataKey::Total, &(total + amount));

// Good: Batch updates
let mut state = env.storage().persistent().get(&DataKey::State).unwrap();
state.count += 1;
state.total += amount;
env.storage().persistent().set(&DataKey::State, &state);
```

### 2. Use Temporary Storage for Intermediate Data

```rust
// Bad: Persistent storage for temporary calculations
env.storage().persistent().set(&DataKey::TempSum, &sum);

// Good: Temporary storage
env.storage().temporary().set(&DataKey::TempSum, &sum);
```

### 3. Optimize Data Structures

```rust
// Bad: Large nested structures
#[derive(Serialize, Deserialize)]
struct Payment {
    id: u64,
    from: Address,
    to: Address,
    amount: i128,
    asset: Asset,
    timestamp: u64,
    memo: String,  // Large!
    metadata: Map<String, String>,  // Very large!
}

// Good: Minimal structure
#[derive(Serialize, Deserialize)]
struct Payment {
    id: u64,
    from: Address,
    to: Address,
    amount: i128,
    asset: Asset,
}
```

### 4. Batch Operations

```rust
// Bad: Individual payments
for recipient in recipients {
    transfer(&recipient, amount);
}

// Good: Batch transfer
batch_transfer(&recipients, &amounts);
```

---

## Contract Development Guide

### Setting Up a New Contract

1. **Create contract directory**:
   ```bash
   mkdir contracts/my_contract
   cd contracts/my_contract
   cargo init --lib
   ```

2. **Add Soroban dependencies** to `Cargo.toml`:
   ```toml
   [dependencies]
   soroban-sdk = "23.4.0"
   stellar-access = { git = "https://github.com/OpenZeppelin/stellar-contracts", tag = "v0.6.0" }
   ```

3. **Define storage keys**:
   ```rust
   #[derive(Clone)]
   pub enum DataKey {
       Admin,
       Paused,
       Config,
       // Add more keys as needed
   }
   ```

4. **Implement contract functions**:
   ```rust
   #[contract]
   pub struct MyContract;

   #[contractimpl]
   impl MyContract {
       pub fn initialize(env: Env, admin: Address) {
           env.storage().instance().set(&DataKey::Admin, &admin);
       }
   }
   ```

### Testing Storage

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage() {
        let env = Env::default();
        let contract = MyContractClient::new(&env, &env.register_contract(None, MyContract));
        
        let admin = Address::random(&env);
        contract.initialize(&admin);
        
        // Verify storage
        assert_eq!(
            env.storage().instance().get(&DataKey::Admin),
            Some(admin)
        );
    }
}
```

### Building and Deploying

```bash
# Build contract
cargo build --release --target wasm32-unknown-unknown

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/my_contract.wasm \
  --source-account <ACCOUNT_ID> \
  --network testnet
```

---

## Additional Resources

- [Soroban Documentation](https://developers.stellar.org/docs/learn/soroban)
- [Gas Optimization Checklist](../GAS_OPTIMIZATION_CHECKLIST.md)
- [Contract Registry](../CONTRACT_REGISTRY_IMPLEMENTATION.md)
- [PayD Architecture](../ARCHITECTURE_DIAGRAM.md)
