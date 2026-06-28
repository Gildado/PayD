# Contract Maintenance Guide
## Issues #779, #780: Maintenance & Stability Improvements

This guide documents maintenance procedures and best practices for PayD smart contracts.

## Table of Contents

1. [Code Quality Standards](#code-quality-standards)
2. [Testing Requirements](#testing-requirements)
3. [Security Guidelines](#security-guidelines)
4. [Performance Optimization](#performance-optimization)
5. [Documentation Standards](#documentation-standards)
6. [CI/CD Pipeline](#cicd-pipeline)

---

## Code Quality Standards

### Clippy Configuration

All contracts must pass clippy with the following configuration:

```bash
cargo clippy --all-targets --all-features -- -D warnings
```

### Common Clippy Fixes

#### 1. Unnecessary Clones
```rust
// ❌ Bad
let data_copy = data.clone();
process(data_copy);

// ✅ Good
process(&data);
```

#### 2. Redundant Pattern Matching
```rust
// ❌ Bad
match result {
    Ok(val) => Ok(val),
    Err(e) => Err(e),
}

// ✅ Good
result
```

#### 3. Inefficient String Operations
```rust
// ❌ Bad
let s = format!("{}", value);

// ✅ Good
let s = value.to_string();
```

### Code Formatting

Use `rustfmt` for consistent formatting:

```bash
cargo fmt --all
```

---

## Testing Requirements

### Minimum Test Coverage

- **Unit tests**: 80% code coverage
- **Integration tests**: All public functions
- **Edge cases**: Boundary conditions, error paths

### Test Structure

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_success_case() {
        let env = Env::default();
        // Setup
        // Execute
        // Assert
    }

    #[test]
    #[should_panic(expected = "ContractError::InvalidAmount")]
    fn test_error_case() {
        // Test error conditions
    }
}
```

### Running Tests

```bash
# Run all tests
cargo test --all-features

# Run tests with output
cargo test --all-features -- --nocapture

# Run specific test
cargo test test_name --all-features
```

---

## Security Guidelines

### 1. Integer Overflow Protection

Always use checked arithmetic:

```rust
// ❌ Bad
let total = amount1 + amount2;

// ✅ Good
let total = amount1
    .checked_add(amount2)
    .ok_or(ContractError::AmountOverflow)?;
```

### 2. Authorization Checks

Verify caller permissions:

```rust
fn admin_function(env: Env, caller: Address) -> Result<(), ContractError> {
    caller.require_auth();
    
    let admin: Address = env.storage().instance().get(&ADMIN_KEY)
        .ok_or(ContractError::NotInitialized)?;
    
    if caller != admin {
        return Err(ContractError::Unauthorized);
    }
    
    // ... admin logic
    Ok(())
}
```

### 3. Input Validation

Validate all inputs:

```rust
fn process_payment(env: Env, amount: i128, recipient: Address) -> Result<(), ContractError> {
    // Validate amount
    if amount <= 0 {
        return Err(ContractError::InvalidAmount);
    }
    
    // Validate recipient
    recipient.require_auth();
    
    // ... process payment
    Ok(())
}
```

### 4. Reentrancy Protection

Avoid external calls in critical sections:

```rust
// ❌ Bad: External call before state update
token_client.transfer(&sender, &recipient, &amount);
env.storage().instance().set(&BALANCE_KEY, new_balance);

// ✅ Good: State update before external call
env.storage().instance().set(&BALANCE_KEY, new_balance);
token_client.transfer(&sender, &recipient, &amount);
```

### 5. Error Handling

Use proper error types:

```rust
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    AmountOverflow = 5,
}
```

---

## Performance Optimization

### 1. Storage Access Optimization

Minimize storage reads:

```rust
// ❌ Bad: Multiple reads
let config = env.storage().instance().get(&CONFIG_KEY);
let paused = env.storage().instance().get(&PAUSED_KEY);
let limits = env.storage().instance().get(&LIMITS_KEY);

// ✅ Good: Batch reads
let storage = env.storage().instance();
let (config, paused, limits) = (
    storage.get(&CONFIG_KEY),
    storage.get(&PAUSED_KEY),
    storage.get(&LIMITS_KEY),
);
```

### 2. Event Emission Optimization

Batch events when possible:

```rust
// ❌ Bad: Individual emissions
for payment in payments.iter() {
    env.events().publish((PAYMENT_SENT,), payment);
}

// ✅ Good: Batch emission (if supported)
let events: Vec<_> = payments.iter()
    .map(|p| (PAYMENT_SENT, p))
    .collect();
// Note: Check if batch emission is available in your SDK version
```

### 3. Memory Optimization

Use references instead of clones:

```rust
// ❌ Bad: Unnecessary clone
fn process_data(data: Vec<Payment>) {
    let data_copy = data.clone();
    // ...
}

// ✅ Good: Use reference
fn process_data(data: &[Payment]) {
    // ...
}
```

### 4. Data Structure Selection

Choose appropriate data structures:

```rust
// For lookups: Use Map
let mut payments: Map<u64, Payment> = Map::new(&env);
payments.set(id, payment);
let payment = payments.get(id); // O(1)

// For iteration: Use Vec
let mut payments: Vec<Payment> = Vec::new(&env);
payments.push_back(payment);
```

---

## Documentation Standards

### Function Documentation

```rust
/// Processes a bulk payment batch.
///
/// # Arguments
/// * `env` - The contract environment
/// * `sender` - Address initiating the batch
/// * `token` - Token contract address for payments
/// * `payments` - Vector of payment entries to process
///
/// # Returns
/// * `Result<u64, ContractError>` - Batch ID on success
///
/// # Errors
/// * `ContractError::EmptyBatch` - If payments vector is empty
/// * `ContractError::BatchTooLarge` - If batch exceeds MAX_BATCH_SIZE
/// * `ContractError::InvalidAmount` - If any payment amount is invalid
/// * `ContractError::Unauthorized` - If sender is not authorized
///
/// # Examples
/// ```ignore
/// let batch_id = contract.process_batch(
///     env,
///     sender,
///     token,
///     payments
/// )?;
/// ```
pub fn process_batch(
    env: Env,
    sender: Address,
    token: Address,
    payments: Vec<PaymentEntry>,
) -> Result<u64, ContractError> {
    // Implementation
}
```

### Module Documentation

```rust
//! # Bulk Payment Contract
//!
//! This contract enables efficient batch payment processing on Stellar.
//!
//! ## Features
//! - Batch payment processing
//! - Automatic refunds for failed payments
//! - Daily/weekly/monthly spending limits
//! - Scheduled batch execution
//!
//! ## Usage
//! ```ignore
//! let contract = BulkPaymentClient::new(&env, &contract_id);
//! contract.initialize(&admin, &token);
//! ```
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: Contract CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          target: wasm32-unknown-unknown
          override: true
          components: rustfmt, clippy
      
      - name: Check Formatting
        run: cargo fmt --all -- --check
      
      - name: Run Clippy
        run: cargo clippy --all-targets --all-features -- -D warnings
      
      - name: Run Tests
        run: cargo test --all-features
      
      - name: Build Release
        run: cargo build --release --target wasm32-unknown-unknown
```

### Pre-commit Hooks

```bash
#!/bin/sh
# .git/hooks/pre-commit

echo "Running pre-commit checks..."

# Format check
cargo fmt --all -- --check
if [ $? -ne 0 ]; then
    echo "❌ Formatting check failed. Run 'cargo fmt' to fix."
    exit 1
fi

# Clippy check
cargo clippy --all-targets --all-features -- -D warnings
if [ $? -ne 0 ]; then
    echo "❌ Clippy check failed. Fix warnings before committing."
    exit 1
fi

# Tests
cargo test --all-features
if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Fix tests before committing."
    exit 1
fi

echo "✅ All pre-commit checks passed!"
exit 0
```

---

## Maintenance Checklist

### Weekly
- [ ] Run full test suite
- [ ] Check for dependency updates
- [ ] Review clippy warnings

### Monthly
- [ ] Security audit
- [ ] Performance profiling
- [ ] Documentation review
- [ ] Update dependencies

### Quarterly
- [ ] Comprehensive code review
- [ ] Refactoring opportunities
- [ ] Architecture review
- [ ] Upgrade Soroban SDK

---

## Common Issues and Solutions

### Issue: Clippy Warnings

**Solution**: Run `cargo clippy --fix` to auto-fix many warnings.

### Issue: Test Failures

**Solution**: Run tests with `--nocapture` to see output:
```bash
cargo test --all-features -- --nocapture
```

### Issue: Build Failures

**Solution**: Clean and rebuild:
```bash
cargo clean
cargo build --release --target wasm32-unknown-unknown
```

### Issue: Large WASM Size

**Solution**: Ensure release profile is optimized:
```toml
[profile.release]
opt-level = "z"
lto = true
strip = true
```

---

## Resources

- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Rust Book](https://doc.rust-lang.org/book/)
- [Clippy Lints](https://rust-lang.github.io/rust-clippy/master/)
- [Stellar Developer Discord](https://discord.gg/stellar)

---

## Contact

For questions or issues, please:
1. Check this guide first
2. Search existing GitHub issues
3. Create a new issue with detailed description
4. Tag with `maintenance` or `stability` label

---

**Last Updated**: 2026-05-29
**Issues**: #779, #780
**Status**: ✅ Implemented
< ! - -   l e g a c y   s t a b i l i t y   c h e c k s   - - >  
 