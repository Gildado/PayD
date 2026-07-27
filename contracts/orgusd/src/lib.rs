//! # ORGUSD – Custom Stable Asset Contract
//!
//! Issues and manages the ORGUSD custom asset on the Stellar / Soroban
//! network.  This contract implements a controlled-issuance token with:
//!
//! * **Admin-gated minting** – only the configured admin can mint new tokens.
//! * **Authorization management** – the admin can authorize or revoke a
//!   holder's ability to receive / hold ORGUSD (mirrors Stellar's
//!   `auth_required` / `auth_revocable` asset flags at the contract layer).
//! * **Freeze / unfreeze** – admin can suspend a specific account's ability
//!   to transfer tokens (regulatory hold).
//! * **Burn** – holders can burn their own tokens; admin can clawback tokens
//!   from any account.
//! * **SEP-0034 metadata** – `name()`, `version()`, `author()` introspection.
//!
//! ## Storage layout
//!
//! | Key                           | Value type    | Purpose                      |
//! |-------------------------------|---------------|------------------------------|
//! | `DataKey::Admin`              | `Address`     | Contract administrator       |
//! | `DataKey::TotalSupply`        | `i128`        | Total minted supply          |
//! | `DataKey::Balance(addr)`      | `i128`        | Per-account token balance    |
//! | `DataKey::Authorized(addr)`   | `bool`        | Account is authorized to hold|
//! | `DataKey::Frozen(addr)`       | `bool`        | Account is frozen            |

#![no_std]
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    Address, Env, String, contract, contracterror, contractevent, contractimpl, contracttype,
};

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum OrgUsdError {
    /// Contract has already been initialized.
    AlreadyInitialized = 1,
    /// Contract has not been initialized yet.
    NotInitialized = 2,
    /// Caller does not have admin privileges.
    Unauthorized = 3,
    /// Mint amount must be positive.
    InvalidAmount = 4,
    /// Destination account is not authorized to hold ORGUSD.
    AccountNotAuthorized = 5,
    /// Account is frozen and cannot send or receive tokens.
    AccountFrozen = 6,
    /// Burn amount exceeds the account's current balance.
    InsufficientBalance = 7,
    /// Transfer amount exceeds the sender's current balance.
    InsufficientFunds = 8,
    /// Recipient and sender are the same address.
    SelfTransfer = 9,
    /// Arithmetic overflow or underflow in balance/supply calculation.
    Overflow = 10,
    /// No pending admin transfer to accept.
    NoPendingAdminTransfer = 11,
    /// Caller is not the proposed admin.
    NotProposedAdmin = 12,
}

/// SEP-0001 asset metadata mirrored from `.well-known/stellar.toml`.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Sep1AssetMetadata {
    pub code: String,
    pub issuer: String,
    pub home_domain: String,
    pub display_decimals: u32,
    pub anchored: bool,
    pub anchor_asset: String,
}

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    TotalSupply,
    Balance(Address),
    Authorized(Address),
    Frozen(Address),
    PendingAdmin,
    StateVersion,
}

// ── Events ────────────────────────────────────────────────────────────────────

/// Emitted when a two-step admin transfer is proposed.
#[contractevent]
pub struct AdminTransferProposedEvent {
    pub current_admin: Address,
    pub proposed_admin: Address,
}

/// Emitted when a proposed admin transfer is accepted.
#[contractevent]
pub struct AdminTransferAcceptedEvent {
    pub old_admin: Address,
    pub new_admin: Address,
}

/// Emitted when a pending admin transfer is cancelled.
#[contractevent]
pub struct AdminTransferCancelledEvent {
    pub admin: Address,
    pub cancelled_admin: Address,
}

/// Emitted when the contract is initialized.
#[contractevent]
pub struct InitializedEvent {
    pub admin: Address,
}

/// Emitted when new ORGUSD tokens are minted.
#[contractevent]
pub struct MintedEvent {
    #[topic]
    pub to: Address,
    pub amount: i128,
    pub new_total_supply: i128,
}

/// Emitted when an account is authorized to hold ORGUSD.
#[contractevent]
pub struct AuthorizedEvent {
    #[topic]
    pub account: Address,
}

/// Emitted when an account's authorization is revoked.
#[contractevent]
pub struct RevokedEvent {
    #[topic]
    pub account: Address,
}

/// Emitted when an account is frozen.
#[contractevent]
pub struct FrozenEvent {
    #[topic]
    pub account: Address,
}

/// Emitted when an account is unfrozen.
#[contractevent]
pub struct UnfrozenEvent {
    #[topic]
    pub account: Address,
}

/// Emitted on a successful token transfer.
#[contractevent]
pub struct TransferEvent {
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub amount: i128,
}

/// Emitted when tokens are burned.
#[contractevent]
pub struct BurnedEvent {
    #[topic]
    pub from: Address,
    pub amount: i128,
    pub new_total_supply: i128,
}

/// Emitted when the admin claws back tokens from an account.
#[contractevent]
pub struct ClawbackEvent {
    #[topic]
    pub from: Address,
    pub amount: i128,
    pub new_total_supply: i128,
}

const STATE_VERSION: u32 = 1;
pub const INSTANCE_TTL_THRESHOLD: u32 = 20_000;
pub const INSTANCE_TTL_EXTEND_TO: u32 = 120_000;
pub const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
pub const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct OrgUsdContract;

#[contractimpl]
impl OrgUsdContract {
    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /// Initialize the contract with an admin address.
    /// Can only be called once.
    pub fn initialize(env: Env, admin: Address) -> Result<(), OrgUsdError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(OrgUsdError::AlreadyInitialized);
        }
        Self::check_state_version(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &0_i128);
        Self::bump_instance_ttl(&env);

        InitializedEvent { admin }.publish(&env);
        Ok(())
    }

    // ── SEP-0034 metadata ─────────────────────────────────────────────────────

    /// Human-readable name of this contract (SEP-0034).
    pub fn name(env: Env) -> soroban_sdk::String {
        soroban_sdk::String::from_str(&env, "ORGUSD")
    }

    /// Contract version string (SEP-0034).
    pub fn version(env: Env) -> soroban_sdk::String {
        soroban_sdk::String::from_str(&env, VERSION)
    }

    /// Contract author / organization (SEP-0034).
    pub fn author(env: Env) -> soroban_sdk::String {
        soroban_sdk::String::from_str(&env, env!("CARGO_PKG_AUTHORS"))
    }

    /// Returns SEP-0001 metadata expected for the ORGUSD asset.
    ///
    /// These values must stay synchronized with `backend/.well-known/stellar.toml`
    /// so clients can verify the on-chain asset contract against hosted
    /// Stellar asset metadata.
    pub fn sep1_metadata(env: Env) -> Sep1AssetMetadata {
        Sep1AssetMetadata {
            code: String::from_str(&env, "ORGUSD"),
            issuer: String::from_str(
                &env,
                "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
            ),
            home_domain: String::from_str(&env, "payd.example.com"),
            display_decimals: 2,
            anchored: true,
            anchor_asset: String::from_str(&env, "USD"),
        }
    }

    /// Verifies externally supplied SEP-0001 metadata against the contract's
    /// expected ORGUSD asset metadata.
    pub fn verify_sep1_metadata(
        env: Env,
        code: String,
        issuer: String,
        home_domain: String,
        display_decimals: u32,
        anchor_asset: String,
    ) -> bool {
        let expected = Self::sep1_metadata(env);
        expected.code == code
            && expected.issuer == issuer
            && expected.home_domain == home_domain
            && expected.display_decimals == display_decimals
            && expected.anchor_asset == anchor_asset
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    /// Returns the total minted supply of ORGUSD.
    pub fn total_supply(env: Env) -> Result<i128, OrgUsdError> {
        Self::require_initialized(&env)?;
        Self::bump_instance_ttl(&env);
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0))
    }

    /// Returns the ORGUSD balance of `account`.
    pub fn balance(env: Env, account: Address) -> Result<i128, OrgUsdError> {
        Self::require_initialized(&env)?;
        let key = DataKey::Balance(account);
        let balance = env.storage().persistent().get(&key).unwrap_or(0);
        Self::bump_persistent_key_ttl(&env, &key);
        Ok(balance)
    }

    /// Returns whether `account` is authorized to hold ORGUSD.
    pub fn is_authorized(env: Env, account: Address) -> Result<bool, OrgUsdError> {
        Self::require_initialized(&env)?;
        let key = DataKey::Authorized(account);
        let authorized = env.storage().persistent().get(&key).unwrap_or(false);
        Self::bump_persistent_key_ttl(&env, &key);
        Ok(authorized)
    }

    /// Returns whether `account` is currently frozen.
    pub fn is_frozen(env: Env, account: Address) -> Result<bool, OrgUsdError> {
        Self::require_initialized(&env)?;
        let key = DataKey::Frozen(account);
        let frozen = env.storage().persistent().get(&key).unwrap_or(false);
        Self::bump_persistent_key_ttl(&env, &key);
        Ok(frozen)
    }

    // ── Admin: authorization management ──────────────────────────────────────

    /// Authorize `account` to hold ORGUSD.  Only the admin can call this.
    pub fn authorize(env: Env, account: Address) -> Result<(), OrgUsdError> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Authorized(account.clone()), &true);
        Self::bump_account_ttl(&env, &account);
        Self::bump_instance_ttl(&env);

        AuthorizedEvent { account }.publish(&env);
        Ok(())
    }

    /// Revoke `account`'s authorization to hold ORGUSD.  Only the admin can call this.
    pub fn revoke(env: Env, account: Address) -> Result<(), OrgUsdError> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Authorized(account.clone()), &false);
        Self::bump_account_ttl(&env, &account);
        Self::bump_instance_ttl(&env);

        RevokedEvent { account }.publish(&env);
        Ok(())
    }

    // ── Admin: freeze / unfreeze ──────────────────────────────────────────────

    /// Freeze `account` — all transfers to/from this account are suspended.
    pub fn freeze(env: Env, account: Address) -> Result<(), OrgUsdError> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Frozen(account.clone()), &true);
        Self::bump_account_ttl(&env, &account);
        Self::bump_instance_ttl(&env);

        FrozenEvent { account }.publish(&env);
        Ok(())
    }

    /// Unfreeze `account`, restoring its ability to send and receive tokens.
    pub fn unfreeze(env: Env, account: Address) -> Result<(), OrgUsdError> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Frozen(account.clone()), &false);
        Self::bump_account_ttl(&env, &account);
        Self::bump_instance_ttl(&env);

        UnfrozenEvent { account }.publish(&env);
        Ok(())
    }

    // ── Admin: mint ───────────────────────────────────────────────────────────

    /// Mint `amount` ORGUSD into `to`'s account.
    /// Recipient must be authorized; amount must be positive.
    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), OrgUsdError> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        if amount <= 0 {
            return Err(OrgUsdError::InvalidAmount);
        }

        let authorized: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Authorized(to.clone()))
            .unwrap_or(false);
        if !authorized {
            return Err(OrgUsdError::AccountNotAuthorized);
        }

        let frozen: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Frozen(to.clone()))
            .unwrap_or(false);
        if frozen {
            return Err(OrgUsdError::AccountFrozen);
        }

        let old_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        let new_balance = old_balance
            .checked_add(amount)
            .ok_or(OrgUsdError::Overflow)?;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &new_balance);
        let old_supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        let new_supply = old_supply
            .checked_add(amount)
            .ok_or(OrgUsdError::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &new_supply);
        Self::bump_account_ttl(&env, &to);
        Self::bump_instance_ttl(&env);

        MintedEvent {
            to,
            amount,
            new_total_supply: new_supply,
        }
        .publish(&env);
        Ok(())
    }

    // ── Transfer ──────────────────────────────────────────────────────────────

    /// Transfer `amount` ORGUSD from `from` to `to`.
    /// Both accounts must be authorized and not frozen.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), OrgUsdError> {
        Self::require_initialized(&env)?;

        // Reject self-transfer early, before auth and balance checks,
        // to save gas and keep transaction history clean.
        if from == to {
            return Err(OrgUsdError::SelfTransfer);
        }
        if amount <= 0 {
            return Err(OrgUsdError::InvalidAmount);
        }

        from.require_auth();

        Self::require_account_active(&env, &from)?;
        Self::require_account_active(&env, &to)?;

        let from_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        if from_balance < amount {
            return Err(OrgUsdError::InsufficientFunds);
        }
        let new_from_balance = from_balance
            .checked_sub(amount)
            .ok_or(OrgUsdError::Overflow)?;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &new_from_balance);

        let to_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        let new_to_balance = to_balance
            .checked_add(amount)
            .ok_or(OrgUsdError::Overflow)?;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &new_to_balance);
        Self::bump_account_ttl(&env, &from);
        Self::bump_account_ttl(&env, &to);
        Self::bump_instance_ttl(&env);

        TransferEvent { from, to, amount }.publish(&env);
        Ok(())
    }

    // ── Burn / clawback ───────────────────────────────────────────────────────

    /// Burn `amount` of the caller's own ORGUSD, reducing total supply.
    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), OrgUsdError> {
        Self::require_initialized(&env)?;
        from.require_auth();

        if amount <= 0 {
            return Err(OrgUsdError::InvalidAmount);
        }

        let balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        if balance < amount {
            return Err(OrgUsdError::InsufficientBalance);
        }

        let new_balance = balance.checked_sub(amount).ok_or(OrgUsdError::Overflow)?;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &new_balance);

        let old_supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        let new_supply = old_supply
            .checked_sub(amount)
            .ok_or(OrgUsdError::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &new_supply);
        Self::bump_account_ttl(&env, &from);
        Self::bump_instance_ttl(&env);

        BurnedEvent {
            from,
            amount,
            new_total_supply: new_supply,
        }
        .publish(&env);
        Ok(())
    }

    /// Admin clawback: forcibly remove `amount` tokens from `from`.
    pub fn clawback(env: Env, from: Address, amount: i128) -> Result<(), OrgUsdError> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        if amount <= 0 {
            return Err(OrgUsdError::InvalidAmount);
        }

        let balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        if balance < amount {
            return Err(OrgUsdError::InsufficientBalance);
        }

        let new_balance = balance.checked_sub(amount).ok_or(OrgUsdError::Overflow)?;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &new_balance);
        let old_supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        let new_supply = old_supply
            .checked_sub(amount)
            .ok_or(OrgUsdError::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &new_supply);
        Self::bump_account_ttl(&env, &from);
        Self::bump_instance_ttl(&env);

        ClawbackEvent {
            from,
            amount,
            new_total_supply: new_supply,
        }
        .publish(&env);
        Ok(())
    }

    // ── Two-step admin transfer ────────────────────────────────────────────────

    pub fn propose_admin_transfer(env: Env, new_admin: Address) {
        let current_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        current_admin.require_auth();

        if new_admin == current_admin {
            panic!("new admin must differ from the current admin");
        }

        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);
        Self::bump_instance_ttl(&env);

        AdminTransferProposedEvent {
            current_admin,
            proposed_admin: new_admin,
        }
        .publish(&env);
    }

    pub fn accept_admin_transfer(env: Env, new_admin: Address) -> Result<(), OrgUsdError> {
        let pending: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .ok_or(OrgUsdError::NoPendingAdminTransfer)?;

        if pending != new_admin {
            return Err(OrgUsdError::NotProposedAdmin);
        }

        new_admin.require_auth();

        let old_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(OrgUsdError::NotInitialized)?;

        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.storage().instance().remove(&DataKey::PendingAdmin);
        Self::bump_instance_ttl(&env);

        AdminTransferAcceptedEvent {
            old_admin,
            new_admin,
        }
        .publish(&env);

        Ok(())
    }

    pub fn cancel_admin_transfer(env: Env) {
        let current_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        current_admin.require_auth();

        let cancelled_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .expect("No pending admin transfer to cancel");

        env.storage().instance().remove(&DataKey::PendingAdmin);
        Self::bump_instance_ttl(&env);

        AdminTransferCancelledEvent {
            admin: current_admin,
            cancelled_admin,
        }
        .publish(&env);
    }

    pub fn get_pending_admin(env: Env) -> Option<Address> {
        Self::bump_instance_ttl(&env);
        env.storage().instance().get(&DataKey::PendingAdmin)
    }

    pub fn bump_ttl(env: Env) -> Result<(), OrgUsdError> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();
        Self::bump_instance_ttl(&env);
        Ok(())
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    fn require_initialized(env: &Env) -> Result<(), OrgUsdError> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(OrgUsdError::NotInitialized);
        }
        Ok(())
    }

    fn bump_instance_ttl(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
    }

    fn bump_persistent_key_ttl(env: &Env, key: &DataKey) {
        if env.storage().persistent().has(key) {
            env.storage().persistent().extend_ttl(
                key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
        }
    }

    fn bump_account_ttl(env: &Env, account: &Address) {
        for key in [
            DataKey::Balance(account.clone()),
            DataKey::Authorized(account.clone()),
            DataKey::Frozen(account.clone()),
        ] {
            Self::bump_persistent_key_ttl(env, &key);
        }
    }

    fn require_admin(env: &Env) -> Result<Address, OrgUsdError> {
        Self::require_initialized(env)?;
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin must be set after initialization"))
    }

    fn require_account_active(env: &Env, account: &Address) -> Result<(), OrgUsdError> {
        let authorized: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Authorized(account.clone()))
            .unwrap_or(false);
        if !authorized {
            return Err(OrgUsdError::AccountNotAuthorized);
        }

        let frozen: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Frozen(account.clone()))
            .unwrap_or(false);
        if frozen {
            return Err(OrgUsdError::AccountFrozen);
        }

        Ok(())
    }

    fn check_state_version(env: &Env) {
        let key = DataKey::StateVersion;
        let version: u32 = env.storage().persistent().get(&key).unwrap_or(0);
        if version < STATE_VERSION {
            env.storage().persistent().set(&key, &STATE_VERSION);
        }
        Self::bump_persistent_key_ttl(env, &key);
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Env, testutils::Address as _};

    fn setup() -> (Env, Address, OrgUsdContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        (env, admin, client)
    }

    // ── initialization ────────────────────────────────────────────────────────

    #[test]
    fn test_initialize_sets_admin() {
        let (_, _, client) = setup();
        assert_eq!(client.total_supply(), 0);
    }

    #[test]
    fn test_double_initialize_fails() {
        let (_, admin, client) = setup();
        let result = client.try_initialize(&admin);
        assert!(result.is_err());
    }

    // ── metadata ──────────────────────────────────────────────────────────────

    #[test]
    fn test_name_returns_orgusd() {
        let (env, _, client) = setup();
        assert_eq!(client.name(), soroban_sdk::String::from_str(&env, "ORGUSD"));
    }

    #[test]
    fn test_sep1_metadata_matches_stellar_toml_values() {
        let (env, _, client) = setup();
        let metadata = client.sep1_metadata();

        assert_eq!(metadata.code, String::from_str(&env, "ORGUSD"));
        assert_eq!(
            metadata.issuer,
            String::from_str(
                &env,
                "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
            )
        );
        assert_eq!(
            metadata.home_domain,
            String::from_str(&env, "payd.example.com")
        );
        assert_eq!(metadata.display_decimals, 2);
        assert!(metadata.anchored);
        assert_eq!(metadata.anchor_asset, String::from_str(&env, "USD"));
    }

    #[test]
    fn test_verify_sep1_metadata() {
        let (env, _, client) = setup();

        assert!(client.verify_sep1_metadata(
            &String::from_str(&env, "ORGUSD"),
            &String::from_str(
                &env,
                "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
            ),
            &String::from_str(&env, "payd.example.com"),
            &2,
            &String::from_str(&env, "USD"),
        ));

        assert!(!client.verify_sep1_metadata(
            &String::from_str(&env, "ORGUSD"),
            &String::from_str(
                &env,
                "GDIFFERENTISSUER0000000000000000000000000000000000000000"
            ),
            &String::from_str(&env, "payd.example.com"),
            &2,
            &String::from_str(&env, "USD"),
        ));
    }

    // ── authorize / revoke ────────────────────────────────────────────────────

    #[test]
    fn test_authorize_and_revoke() {
        let (env, _, client) = setup();
        let holder = Address::generate(&env);

        assert!(!client.is_authorized(&holder));

        client.authorize(&holder);
        assert!(client.is_authorized(&holder));

        client.revoke(&holder);
        assert!(!client.is_authorized(&holder));
    }

    // ── freeze / unfreeze ─────────────────────────────────────────────────────

    #[test]
    fn test_freeze_and_unfreeze() {
        let (env, _, client) = setup();
        let holder = Address::generate(&env);

        assert!(!client.is_frozen(&holder));

        client.freeze(&holder);
        assert!(client.is_frozen(&holder));

        client.unfreeze(&holder);
        assert!(!client.is_frozen(&holder));
    }

    // ── mint ──────────────────────────────────────────────────────────────────

    #[test]
    fn test_mint_increases_balance_and_supply() {
        let (env, _, client) = setup();
        let holder = Address::generate(&env);

        client.authorize(&holder);
        client.mint(&holder, &500_000);

        assert_eq!(client.balance(&holder), 500_000);
        assert_eq!(client.total_supply(), 500_000);
    }

    #[test]
    fn test_mint_fails_for_unauthorized_account() {
        let (env, _, client) = setup();
        let holder = Address::generate(&env);

        let result = client.try_mint(&holder, &1000);
        assert_eq!(result, Err(Ok(OrgUsdError::AccountNotAuthorized)));
    }

    #[test]
    fn test_mint_fails_for_frozen_account() {
        let (env, _, client) = setup();
        let holder = Address::generate(&env);

        client.authorize(&holder);
        client.freeze(&holder);

        let result = client.try_mint(&holder, &1000);
        assert_eq!(result, Err(Ok(OrgUsdError::AccountFrozen)));
    }

    #[test]
    fn test_mint_zero_fails() {
        let (env, _, client) = setup();
        let holder = Address::generate(&env);
        client.authorize(&holder);

        let result = client.try_mint(&holder, &0);
        assert_eq!(result, Err(Ok(OrgUsdError::InvalidAmount)));
    }

    // ── transfer ──────────────────────────────────────────────────────────────

    #[test]
    fn test_transfer_succeeds() {
        let (env, _, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.authorize(&alice);
        client.authorize(&bob);
        client.mint(&alice, &1_000_000);

        client.transfer(&alice, &bob, &250_000);

        assert_eq!(client.balance(&alice), 750_000);
        assert_eq!(client.balance(&bob), 250_000);
    }

    #[test]
    fn test_transfer_fails_if_insufficient_funds() {
        let (env, _, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.authorize(&alice);
        client.authorize(&bob);
        client.mint(&alice, &100);

        let result = client.try_transfer(&alice, &bob, &500);
        assert_eq!(result, Err(Ok(OrgUsdError::InsufficientFunds)));
    }

    #[test]
    fn test_transfer_fails_if_sender_frozen() {
        let (env, _, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.authorize(&alice);
        client.authorize(&bob);
        client.mint(&alice, &1000);
        client.freeze(&alice);

        let result = client.try_transfer(&alice, &bob, &100);
        assert_eq!(result, Err(Ok(OrgUsdError::AccountFrozen)));
    }

    #[test]
    fn test_self_transfer_fails() {
        let (env, _, client) = setup();
        let alice = Address::generate(&env);
        client.authorize(&alice);
        client.mint(&alice, &1000);

        let result = client.try_transfer(&alice, &alice, &100);
        assert_eq!(result, Err(Ok(OrgUsdError::SelfTransfer)));
    }

    // ── burn ──────────────────────────────────────────────────────────────────

    #[test]
    fn test_burn_reduces_balance_and_supply() {
        let (env, _, client) = setup();
        let holder = Address::generate(&env);

        client.authorize(&holder);
        client.mint(&holder, &1_000_000);
        client.burn(&holder, &200_000);

        assert_eq!(client.balance(&holder), 800_000);
        assert_eq!(client.total_supply(), 800_000);
    }

    #[test]
    fn test_burn_fails_if_insufficient_balance() {
        let (env, _, client) = setup();
        let holder = Address::generate(&env);
        client.authorize(&holder);
        client.mint(&holder, &100);

        let result = client.try_burn(&holder, &500);
        assert_eq!(result, Err(Ok(OrgUsdError::InsufficientBalance)));
    }

    // ── clawback ──────────────────────────────────────────────────────────────

    #[test]
    fn test_clawback_removes_tokens_from_account() {
        let (env, _, client) = setup();
        let holder = Address::generate(&env);

        client.authorize(&holder);
        client.mint(&holder, &1_000_000);
        client.clawback(&holder, &300_000);

        assert_eq!(client.balance(&holder), 700_000);
        assert_eq!(client.total_supply(), 700_000);
    }

    #[test]
    fn test_clawback_fails_if_amount_exceeds_balance() {
        let (env, _, client) = setup();
        let holder = Address::generate(&env);
        client.authorize(&holder);
        client.mint(&holder, &100);

        let result = client.try_clawback(&holder, &9999);
        assert_eq!(result, Err(Ok(OrgUsdError::InsufficientBalance)));
    }

    // ── multi-step: full issuance flow ────────────────────────────────────────

    #[test]
    fn test_full_issuance_flow() {
        let (env, _, client) = setup();
        let distribution = Address::generate(&env);
        let recipient = Address::generate(&env);

        // Authorize both accounts
        client.authorize(&distribution);
        client.authorize(&recipient);

        // Mint 1 000 000 ORGUSD to the distribution account
        client.mint(&distribution, &1_000_000);
        assert_eq!(client.total_supply(), 1_000_000);

        // Distribute 100 000 to a recipient
        client.transfer(&distribution, &recipient, &100_000);
        assert_eq!(client.balance(&distribution), 900_000);
        assert_eq!(client.balance(&recipient), 100_000);

        // Recipient burns 10 000
        client.burn(&recipient, &10_000);
        assert_eq!(client.balance(&recipient), 90_000);
        assert_eq!(client.total_supply(), 990_000);
    }

    // ══════════════════════════════════════════════════════════════════════
    // ── SERIALIZATION ROUNDTRIP ──────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    #[test]
    fn test_sep1_asset_metadata_roundtrip() {
        let env = Env::default();
        let contract_id = env.register(OrgUsdContract, ());
        let metadata = Sep1AssetMetadata {
            code: String::from_str(&env, "ORGUSD"),
            issuer: String::from_str(
                &env,
                "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
            ),
            home_domain: String::from_str(&env, "payd.example.com"),
            display_decimals: 2,
            anchored: true,
            anchor_asset: String::from_str(&env, "USD"),
        };

        env.as_contract(&contract_id, || {
            let key = DataKey::Admin;
            env.storage().instance().set(&key, &metadata);
            let loaded: Sep1AssetMetadata = env.storage().instance().get(&key).unwrap();
            assert_eq!(loaded.code, metadata.code);
            assert_eq!(loaded.issuer, metadata.issuer);
            assert_eq!(loaded.home_domain, metadata.home_domain);
            assert_eq!(loaded.display_decimals, 2);
            assert_eq!(loaded.anchored, true);
            assert_eq!(loaded.anchor_asset, metadata.anchor_asset);
        });
    }

    #[test]
    fn test_i128_storage_roundtrip() {
        let env = Env::default();
        let contract_id = env.register(OrgUsdContract, ());
        let account = Address::generate(&env);

        env.as_contract(&contract_id, || {
            let key = DataKey::Balance(account.clone());
            env.storage().persistent().set(&key, &i128::MAX);
            let loaded: i128 = env.storage().persistent().get(&key).unwrap_or(0);
            assert_eq!(loaded, i128::MAX);

            env.storage().persistent().set(&key, &0i128);
            let loaded: i128 = env.storage().persistent().get(&key).unwrap_or(-1);
            assert_eq!(loaded, 0);

            env.storage().persistent().set(&key, &(-100i128));
            let loaded: i128 = env.storage().persistent().get(&key).unwrap_or(0);
            assert_eq!(loaded, -100);
        });
    }

    #[test]
    fn test_bool_authorized_frozen_roundtrip() {
        let env = Env::default();
        let contract_id = env.register(OrgUsdContract, ());
        let account = Address::generate(&env);

        env.as_contract(&contract_id, || {
            let auth_key = DataKey::Authorized(account.clone());
            let frozen_key = DataKey::Frozen(account.clone());

            env.storage().persistent().set(&auth_key, &true);
            env.storage().persistent().set(&frozen_key, &false);

            let authorized: bool = env.storage().persistent().get(&auth_key).unwrap_or(false);
            let frozen: bool = env.storage().persistent().get(&frozen_key).unwrap_or(true);

            assert!(authorized);
            assert!(!frozen);
        });
    }

    #[test]
    fn test_storage_version_after_init_orgusd() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&Address::generate(&env));

        env.as_contract(&contract_id, || {
            let version: u32 = env
                .storage()
                .persistent()
                .get(&DataKey::StateVersion)
                .unwrap_or(0);
            assert_eq!(version, STATE_VERSION);
        });
    }

    #[test]
    fn test_storage_version_migration_from_zero_orgusd() {
        let env = Env::default();
        let contract_id = env.register(OrgUsdContract, ());

        env.as_contract(&contract_id, || {
            env.storage()
                .persistent()
                .set(&DataKey::StateVersion, &0u32);
            OrgUsdContract::check_state_version(&env);
            let version: u32 = env
                .storage()
                .persistent()
                .get(&DataKey::StateVersion)
                .unwrap_or(0);
            assert_eq!(version, STATE_VERSION);
        });
    }

    // ── TWO-STEP ADMIN TRANSFER TESTS ──────────────────────────────────────────

    #[test]
    fn test_propose_admin_transfer_stores_pending() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let new_admin = Address::generate(&env);
        client.propose_admin_transfer(&new_admin);

        assert_eq!(client.get_pending_admin(), Some(new_admin));
    }

    #[test]
    fn test_accept_admin_transfer_promotes_new_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let new_admin = Address::generate(&env);
        client.propose_admin_transfer(&new_admin);
        client.accept_admin_transfer(&new_admin);

        assert_eq!(client.get_pending_admin(), None);
    }

    #[test]
    fn test_accept_admin_transfer_allows_new_admin_operations() {
        let (env, _admin, _client) = setup();
        let new_admin = Address::generate(&env);
        let account = Address::generate(&env);

        _client.propose_admin_transfer(&new_admin);
        _client.accept_admin_transfer(&new_admin);

        let result = _client.try_authorize(&account);
        assert!(result.is_ok());
    }

    #[test]
    fn test_accept_admin_transfer_rejects_wrong_caller() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let proposed = Address::generate(&env);
        let impostor = Address::generate(&env);

        client.propose_admin_transfer(&proposed);

        let result = client.try_accept_admin_transfer(&impostor);
        assert_eq!(result, Err(Ok(OrgUsdError::NotProposedAdmin)));
    }

    #[test]
    fn test_accept_admin_transfer_with_no_proposal_returns_error() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let random = Address::generate(&env);
        let result = client.try_accept_admin_transfer(&random);
        assert_eq!(result, Err(Ok(OrgUsdError::NoPendingAdminTransfer)));
    }

    #[test]
    fn test_accept_admin_transfer_correct_caller_succeeds() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let new_admin = Address::generate(&env);
        client.propose_admin_transfer(&new_admin);

        let result = client.try_accept_admin_transfer(&new_admin);
        assert_eq!(result, Ok(Ok(())));
    }

    #[test]
    fn test_cancel_admin_transfer_clears_pending() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let new_admin = Address::generate(&env);
        client.propose_admin_transfer(&new_admin);
        assert_eq!(client.get_pending_admin(), Some(new_admin));

        client.cancel_admin_transfer();
        assert_eq!(client.get_pending_admin(), None);
    }

    #[test]
    fn test_propose_admin_transfer_replaces_previous_proposal() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let first_candidate = Address::generate(&env);
        let second_candidate = Address::generate(&env);

        client.propose_admin_transfer(&first_candidate);
        assert_eq!(client.get_pending_admin(), Some(first_candidate));

        client.propose_admin_transfer(&second_candidate);
        assert_eq!(client.get_pending_admin(), Some(second_candidate));
    }

    #[test]
    fn test_get_pending_admin_returns_none_initially() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        assert_eq!(client.get_pending_admin(), None);
    }

    #[test]
    #[should_panic(expected = "new admin must differ from the current admin")]
    fn test_propose_admin_transfer_rejects_current_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        client.propose_admin_transfer(&admin);
    }

    #[test]
    #[should_panic(expected = "No pending admin transfer to cancel")]
    fn test_cancel_admin_transfer_panics_without_pending_proposal() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        client.cancel_admin_transfer();
    }
}

#[cfg(test)]
#[path = "tests.rs"]
mod external_tests;
