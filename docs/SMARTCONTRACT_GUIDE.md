# Smart Contract Development Guide — PayD

This guide covers everything you need to know to contribute to PayD's Soroban smart contracts.

## 🛠 Prerequisites

- **Rust** (latest stable): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Soroban CLI**: `cargo install --locked soroban-cli`
- **wasm32 target**: `rustup target add wasm32-unknown-unknown`

## 📂 Project Structure

```
contracts/
├── Cargo.toml                    # Workspace root
└── contracts/
    ├── treasury/                 # Multi-sig treasury vault
    │   └── src/
    │       ├── lib.rs            # Main contract logic
    │       ├── types.rs          # Data structures
    │       ├── storage.rs        # Storage layer (DataKey + helpers)
    │       ├── errors.rs         # Error enum
    │       └── test.rs           # Unit tests
    ├── payroll_stream/           # Payment streaming
    ├── vesting/                  # Cliff + linear vesting
    └── governance/               # Proposals & voting
```

Each contract follows the same file structure.

## 🏗 Architecture

### Storage Pattern
All contracts use the same storage pattern:
1. **DataKey enum** — defines all storage keys
2. **Instance storage** — for config data (admin, thresholds)
3. **Persistent storage** — for entity data (proposals, streams, schedules)
4. **Helper functions** — `get_*`, `set_*`, `has_*` wrappers

### Error Handling
Every public function returns `Result<T, ContractError>`:
```rust
pub fn my_function(env: Env) -> Result<(), TreasuryError> {
    if !has_admin(&env) {
        return Err(TreasuryError::NotInitialized);
    }
    Ok(())
}
```

### Authorization
Use Soroban's built-in `require_auth()`:
```rust
pub fn deposit(env: Env, from: Address, amount: i128) -> Result<(), Error> {
    from.require_auth();  // Caller must sign the transaction
    // ...
}
```

### Events
Emit events for off-chain indexing:
```rust
env.events().publish(
    (symbol_short!("deposit"), from.clone()),
    amount,
);
```

## 🧑‍💻 Development Workflow

### Build all contracts
```bash
cd contracts
cargo build --all
```

### Run tests
```bash
cargo test --all
```

### Build for deployment (WASM)
```bash
soroban contract build
```

### Deploy to testnet
```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/treasury.wasm \
  --network testnet \
  --source YOUR_SECRET_KEY
```

## 🔍 Key Soroban Patterns

### Token Client (for transfers)
```rust
use soroban_sdk::token;

let client = token::Client::new(&env, &token_address);
client.transfer(&from, &to, &amount);
```

### Persistent Storage with TTL
```rust
env.storage().persistent().set(&key, &value);
env.storage().persistent().extend_ttl(&key, 100, 100);
```

### Cross-Contract Calls
```rust
let treasury_client = TreasuryContractClient::new(&env, &treasury_address);
treasury_client.deposit(&from, &token, &amount);
```

## 📋 Finding Issues

See `docs/ISSUES-SMARTCONTRACT.md` for all available tasks (SC-1 through SC-25).
Issues are organized by module and tagged with priority and labels.
