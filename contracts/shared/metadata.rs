/// Shared contract metadata module for version tracking and audits.
///
/// This module provides a standardized way for all Soroban contracts to expose
/// metadata that facilitates version tracking, audit trails, and deployment updates.
///
/// Follows Stellar Enhancement Proposal 34 (SEP-0034) for contract identification.
///
/// # Semantic Versioning
///
/// All contracts using this module must follow [Semantic Versioning](https://semver.org/):
/// - **MAJOR**: Incompatible API changes (e.g., function signature changes, storage layout changes)
/// - **MINOR**: Backwards-compatible feature additions
/// - **PATCH**: Backwards-compatible bug fixes
///
/// Version strings are embedded via `env!("CARGO_PKG_VERSION")` at compile time.
///
/// # Usage
///
/// Include this in your contract's lib.rs:
/// ```ignore
/// mod metadata;
///
/// #[contractimpl]
/// impl MyContract {
///     pub fn contract_metadata(env: Env) -> ContractMetadata {
///         metadata::get_contract_metadata(&env)
///     }
///
///     pub fn version(env: Env) -> String {
///         metadata::get_version(&env)
///     }
/// }
/// ```
///
/// # Version History Tracking
///
/// When upgrading a contract:
/// 1. Update version in `Cargo.toml` following semver.
/// 2. Call `mark_upgrade()` with the new version to emit a `ContractUpgradedEvent`.
/// 3. Off-chain indexers consume the event to track version transitions.
///
/// # Mainnet Deployment
///
/// Before mainnet, ensure:
/// - Version in `Cargo.toml` matches intended release version (e.g., "1.0.0")
/// - Upgrade history is complete and accurate
/// - All contracts using this module have consistent versioning schemes
///
use soroban_sdk::{contractevent, contracttype, Address, Env, String, Vec};

/// Complete metadata about the contract including version and audit information.
#[derive(Clone, Debug)]
#[contracttype]
pub struct ContractMetadata {
    /// Human-readable contract name (from Cargo.toml)
    pub name: String,
    /// Semantic version string (from Cargo.toml)
    pub version: String,
    /// Contract author/organization (from Cargo.toml)
    pub author: String,
    /// Build timestamp (compilation time)
    pub build_info: String,
    /// SEP-0034 compliant flag
    pub sep34_compliant: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct UpgradeRecord {
    pub admin: Address,
    pub previous_version: String,
    pub new_version: String,
    pub ledger_sequence: u32,
    pub timestamp: u64,
}

#[contractevent]
pub struct VersionInitializedEvent {
    pub version: String,
    pub timestamp: u64,
}

#[contractevent]
pub struct ContractUpgradedEvent {
    pub admin: Address,
    pub previous_version: String,
    pub new_version: String,
    pub ledger_sequence: u32,
}

/// Returns the SEP-0034 contract name.
///
/// This function returns the contract's name as defined in Cargo.toml.
pub fn get_name(env: &Env) -> String {
    String::from_str(env, env!("CARGO_PKG_NAME"))
}

/// Returns the SEP-0034 contract version.
///
/// This function returns the contract's semantic version as defined in Cargo.toml.
/// Format: MAJOR.MINOR.PATCH (e.g., "1.0.0")
pub fn get_version(env: &Env) -> String {
    String::from_str(env, env!("CARGO_PKG_VERSION"))
}

/// Returns the SEP-0034 contract author.
///
/// This function returns the authors/organization field from Cargo.toml.
pub fn get_author(env: &Env) -> String {
    String::from_str(env, env!("CARGO_PKG_AUTHORS"))
}

/// Returns a build info string including the version and build date.
///
/// Useful for audit trails and deployment verification.
pub fn get_build_info(env: &Env) -> String {
    let version = String::from_str(env, env!("CARGO_PKG_VERSION"));
    let build_date = String::from_str(env, env!("CARGO_PKG_VERSION_BUILD_DATE"));

    // Combine version and build date for audit purposes
    // Note: env!("CARGO_PKG_VERSION_BUILD_DATE") is a build script variable
    String::from_str(
        env,
        &format!(
            "v{} (built at {})",
            env!("CARGO_PKG_VERSION"),
            env!("BUILD_TIMESTAMP")
        ),
    )
}

/// Returns complete contract metadata for auditing and version tracking.
///
/// # Returns
///
/// A `ContractMetadata` struct containing:
/// - name: Contract name from Cargo.toml
/// - version: Semantic version from Cargo.toml
/// - author: Author/organization from Cargo.toml
/// - build_info: Build timestamp information
/// - sep34_compliant: Always true (these functions are SEP-0034 compliant)
pub fn get_contract_metadata(env: &Env) -> ContractMetadata {
    ContractMetadata {
        name: get_name(env),
        version: get_version(env),
        author: get_author(env),
        build_info: String::from_str(env, env!("CARGO_PKG_VERSION")),
        sep34_compliant: true,
    }
}

pub fn current_version(env: &Env) -> String {
    String::from_str(env, env!("CARGO_PKG_VERSION"))
}

pub fn default_upgrade_history(env: &Env) -> Vec<UpgradeRecord> {
    Vec::new(env)
}

/// Compares two semantic version strings (e.g., "1.2.3" vs "1.2.4").
/// Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2, -2 if parse error.
///
/// This is a simple utility for upgrade tracking and is not required for contract operation.
/// It assumes valid semver format (MAJOR.MINOR.PATCH).
pub fn compare_versions(env: &Env, v1_str: &str, v2_str: &str) -> i32 {
    let v1_parts: Vec<&str> = v1_str.split('.').collect();
    let v2_parts: Vec<&str> = v2_str.split('.').collect();

    if v1_parts.len() != 3 || v2_parts.len() != 3 {
        return -2; // Parse error: invalid format
    }

    for i in 0..3 {
        if let (Ok(n1), Ok(n2)) = (v1_parts[i].parse::<u32>(), v2_parts[i].parse::<u32>()) {
            if n1 < n2 {
                return -1;
            } else if n1 > n2 {
                return 1;
            }
        } else {
            return -2; // Parse error: non-numeric component
        }
    }
    0 // Versions are equal
}
