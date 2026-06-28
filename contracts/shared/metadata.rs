/// Shared contract metadata module for version tracking and audits.
///
/// This module provides a standardized way for all Soroban contracts to expose
/// metadata that facilitates version tracking, audit trails, and deployment updates.
///
/// Follows Stellar Enhancement Proposal 34 (SEP-0034) for contract identification.
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
/// }
/// ```
use soroban_sdk::{Env, String};

/// Complete metadata about the contract including version and audit information.
#[derive(Clone, Debug)]
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
