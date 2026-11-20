# Shared Contract Metadata Module

The **Shared Metadata Module** (`contracts/shared/metadata.rs`) provides standardized version tracking, audit trail support, and SEP-0034 compliance for all PayD Soroban contracts.

---

## Purpose

A unified metadata interface ensures:
- **Version Transparency**: All contracts expose versions consistently for indexing and auditing.
- **Upgrade Tracking**: Off-chain systems track version transitions via emitted events.
- **Audit Compliance**: Deployment records link contract versions to specific ledger sequences and timestamps.
- **SEP-0034 Compliance**: Contracts conform to Stellar's standard contract metadata protocol.

---

## Architecture

### Core Components

| Component | Type | Purpose |
|---|---|---|
| `ContractMetadata` | Struct | Immutable metadata snapshot (name, version, author, build_info, sep34_compliant flag). |
| `UpgradeRecord` | Struct | Timestamped upgrade log entry (admin, previous/new versions, ledger sequence). |
| `VersionInitializedEvent` | Event | Emitted when contract is initialized with its version. |
| `ContractUpgradedEvent` | Event | Emitted when `mark_upgrade()` records a version transition. |

### Public Functions

| Function | Returns | Usage |
|---|---|---|
| `get_name(env)` | `String` | Contract name from `Cargo.toml`. |
| `get_version(env)` | `String` | Semantic version (e.g., "1.2.3"). |
| `get_author(env)` | `String` | Author/organization from `Cargo.toml`. |
| `get_build_info(env)` | `String` | Build timestamp and version info. |
| `get_contract_metadata(env)` | `ContractMetadata` | Complete metadata struct. |
| `current_version(env)` | `String` | Alias for `get_version()`. |
| `default_upgrade_history(env)` | `Vec<UpgradeRecord>` | Empty upgrade history (for initialization). |
| `compare_versions(env, v1, v2)` | `i32` | Semver comparison: -1 (v1<v2), 0 (equal), 1 (v1>v2), -2 (parse error). |

---

## Integration Guide

### 1. Add to Contract

Include in your contract's `lib.rs`:

```rust
mod metadata;

#[contractimpl]
impl MyContract {
    pub fn version(env: Env) -> String {
        metadata::get_version(&env)
    }

    pub fn contract_metadata(env: Env) -> ContractMetadata {
        metadata::get_contract_metadata(&env)
    }
}
```

### 2. Emit Version Event at Initialization

```rust
#[contractimpl]
impl MyContract {
    pub fn init(env: Env, admin: Address) {
        // ... initialization logic ...
        
        // Emit version event for off-chain tracking
        metadata::VersionInitializedEvent {
            version: metadata::get_version(&env),
            timestamp: env.ledger().timestamp(),
        }
        .publish(&env);
    }
}
```

### 3. Track Upgrades

When upgrading a contract:

```rust
pub fn mark_upgrade(env: Env, new_version: String) -> Result<(), ContractError> {
    // Require admin auth and emit upgrade event
    let admin: Address = env.storage().persistent().get(&DataKey::Admin)
        .ok_or(ContractError::Unauthorized)?;
    admin.require_auth();
    
    let previous = metadata::get_version(&env);
    
    // Store upgrade record and emit event
    metadata::ContractUpgradedEvent {
        admin: admin.clone(),
        previous_version: previous.clone(),
        new_version: new_version.clone(),
        ledger_sequence: env.ledger().sequence(),
    }
    .publish(&env);
    
    Ok(())
}
```

---

## Semantic Versioning

All PayD contracts follow [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** (X._.\_): Breaking changes (API incompatibility, storage layout changes)
- **MINOR** (_.X.\_): Backwards-compatible feature additions
- **PATCH** (_._.X): Backwards-compatible bug fixes

### Examples

| Change | Version Jump |
|---|---|
| Add new public function | `1.0.0` → `1.1.0` |
| Fix storage key interpretation bug | `1.1.0` → `1.1.1` |
| Change function signature | `1.1.1` → `2.0.0` |
| Optimize internal calculation | `1.1.0` → `1.1.1` |

### Pre-Mainnet Versioning

Before mainnet deployment (Stellar Wave Program):
- All contracts must be at `1.0.0` or higher.
- Upgrade history must be complete and accurate.
- No `0.x.x` versions are permitted on mainnet.

---

## Usage Examples

### Reading Contract Version

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  -- version
```

### Reading Metadata Struct

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  -- contract_metadata
```

### Version Comparison

```rust
let result = metadata::compare_versions(&env, "1.2.3", "1.2.4");
// result == -1 (1.2.3 < 1.2.4)
```

---

## Test Coverage

The metadata module includes comprehensive tests to verify:
- Version extraction from `Cargo.toml` at compile time.
- Metadata struct construction and completeness.
- Upgrade event emission and recording.
- Semver comparison under edge cases (equal versions, major transitions, etc.).

### Running Tests

```bash
cd contracts/<contract>
cargo test --test test.rs
```

---

## Contracts Using This Module

All primary PayD contracts expose metadata via this shared module:

- `vesting_escrow` — Employee vesting with version tracking (v1.0.0+)
- `milestone_escrow` — Milestone-based escrow with versioning (v1.0.0+)
- `asset_path_payment` — Cross-asset path payments with upgrade history (v1.0.0+)
- `cross_asset_payment` — Off-chain anchor bridges with metadata (v1.0.0+)
- `bulk_payment` — Batch payment execution with versioning (v1.0.0+)
- `revenue_split` — Revenue distribution with metadata support (v1.0.0+)
- `smart_wallet` — Smart contract wallet with version tracking (v1.0.0+)
- `orgusd` — Organization USD token with metadata (v1.0.0+)

---

## Off-Chain Indexing

Off-chain indexers consume `VersionInitializedEvent` and `ContractUpgradedEvent` to:
1. Track version transitions across mainnet.
2. Alert on unexpected upgrades (e.g., skipped versions).
3. Build deployment audit trails linked to ledger timestamps.
4. Enable rollback detection (e.g., `2.0.0` → `1.9.0` flags a suspicious rollback).

---

## Security Considerations

1. **Immutable Embedded Versions**: Versions are burned into contract wasm at compile time via `env!("CARGO_PKG_VERSION")`. They cannot be tampered with post-deployment.
2. **Upgrade Authorization**: Only the admin address can call `mark_upgrade()` to emit version transitions. Unauthorized callers are rejected with `Unauthorized`.
3. **No Version Enforcement**: The metadata module does **not** enforce version constraints (e.g., "reject calls if version < X.Y.Z"). Contracts that require version checks should implement their own logic.

---

## Maintenance

### When to Update This Module

- Soroban SDK introduces breaking changes to event/type definitions.
- Stellar Enhancement Proposals update the SEP-0034 specification.
- PayD requires new audit fields (e.g., commit hash, network ID).

### Impact of Updates

Any change to the module signature (function parameters, event structure) requires:
1. Bumping all consuming contracts' versions (MAJOR change).
2. Recompiling all contracts with the updated module.
3. Re-deploying to staging/testnet for integration testing.

---

## References

- [SEP-0034: Stellar Contract Metadata](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-02.md)
- [Semantic Versioning 2.0.0](https://semver.org/)
- [Soroban SDK Events](https://soroban.stellar.org/learn/storing-data#events)
