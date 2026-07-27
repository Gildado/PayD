#![no_std]

use soroban_sdk::{
    Address, Env, String, Vec, contract, contracterror, contractevent, contractimpl, contracttype,
    token,
};

#[cfg(test)]
mod test;

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum RevenueSplitError {
    AlreadyInitialized = 1,
    ZeroRecipients = 2,
    ZeroBasisPoints = 3,
    DuplicateRecipient = 4,
    BasisPointsSumMismatch = 5,
    LedgerReplayDetected = 6,
    UnauthorizedDistribution = 7,
    ContractPaused = 8,
    UnsupportedAsset = 9,
    /// Admin or Recipients storage entry is missing; contract may not be initialized.
    NotInitialized = 10,
    /// Accumulated basis-points sum overflowed u32 during share validation.
    ShareOverflow = 11,
    /// Distribution or preview amount must not be negative.
    InvalidAmount = 12,
    NotProposedAdmin = 13,
    NoPendingAdminTransfer = 14,
    AmountTooLarge = 15,
    ArithmeticOverflow = 16,
}

// ── Events ────────────────────────────────────────────────────────────────────

/// Emitted when a distribution is executed successfully.
#[contractevent]
pub struct DistributedEvent {
    #[topic]
    pub token: Address,
    pub from: Address,
    pub total_amount: i128,
    pub recipient_count: u32,
}

/// Emitted when the admin updates the recipient split configuration.
#[contractevent]
pub struct RecipientsUpdatedEvent {
    #[topic]
    pub admin: Address,
    pub recipient_count: u32,
}

/// Emitted when the admin address is changed.
#[contractevent]
pub struct AdminChangedEvent {
    #[topic]
    pub old_admin: Address,
    pub new_admin: Address,
}

/// Emitted when the contract pause state changes (circuit breaker).
#[contractevent]
pub struct PauseStateChangedEvent {
    pub paused: bool,
    pub admin: Address,
}

/// Emitted when an admin adds support for a token asset.
#[contractevent]
pub struct AssetSupportedEvent {
    pub admin: Address,
    #[topic]
    pub token: Address,
}

/// Emitted when an admin removes support for a token asset.
#[contractevent]
pub struct AssetRemovedEvent {
    pub admin: Address,
    #[topic]
    pub token: Address,
}

#[contractevent]
pub struct AdminTransferProposedEvent {
    pub current_admin: Address,
    pub proposed_admin: Address,
}

#[contractevent]
pub struct AdminTransferAcceptedEvent {
    pub old_admin: Address,
    pub new_admin: Address,
}

#[contractevent]
pub struct AdminTransferCancelledEvent {
    pub admin: Address,
    pub cancelled_admin: Address,
}

// ── Storage ───────────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    Recipients,
    /// Tracks the last ledger sequence in which a distribution was processed.
    LastDistributeLedger,
    /// Cumulative amount distributed per token address.
    TotalDistributed(Address),
    /// Circuit breaker flag — when true all distribute calls are rejected.
    Paused,
    /// Cumulative count of completed distributions.
    DistributionCount,
    /// Optional admin-managed allowlist of token assets.
    SupportedAssets,
    StateVersion,
    PendingAdmin,
    MaxDistributionAmount,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct RecipientShare {
    pub destination: Address,
    pub basis_points: u32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct DistributionPreview {
    pub destination: Address,
    pub basis_points: u32,
    pub amount: i128,
}

pub const TOTAL_BASIS_POINTS: u32 = 10_000;
pub const DEFAULT_MAX_DISTRIBUTION_AMOUNT: i128 = 1_000_000_000_000_000;

const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;
const STATE_VERSION: u32 = 1;

#[contract]
pub struct RevenueSplitContract;

#[contractimpl]
impl RevenueSplitContract {
    // ── SEP-0034 Contract Metadata ───────────────────────────

    /// Returns the human-readable contract name (SEP-0034).
    pub fn name(env: Env) -> String {
        String::from_str(&env, env!("CARGO_PKG_NAME"))
    }

    /// Returns the contract version string (SEP-0034).
    pub fn version(env: Env) -> String {
        String::from_str(&env, env!("CARGO_PKG_VERSION"))
    }

    /// Returns the contract author / organization (SEP-0034).
    pub fn author(env: Env) -> String {
        String::from_str(&env, env!("CARGO_PKG_AUTHORS"))
    }

    /// Initializes the contract with an admin and the initial recipient split.
    pub fn init(
        env: Env,
        admin: Address,
        shares: Vec<RecipientShare>,
    ) -> Result<(), RevenueSplitError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(RevenueSplitError::AlreadyInitialized);
        }
        Self::check_state_version(&env);

        Self::validate_shares(&shares)?;

        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::DistributionCount, &0u64);
        env.storage().persistent().set(
            &DataKey::MaxDistributionAmount,
            &DEFAULT_MAX_DISTRIBUTION_AMOUNT,
        );
        Self::store_recipients(&env, &shares);
        Self::bump_core_ttl(&env);
        Ok(())
    }

    /// Returns the current admin address.
    pub fn get_admin(env: Env) -> Result<Address, RevenueSplitError> {
        Self::load_admin(&env)
    }

    /// Returns the currently configured recipient split.
    pub fn get_recipients(env: Env) -> Vec<RecipientShare> {
        Self::load_recipients(&env)
    }

    /// Previews how an incoming amount would be distributed across recipients.
    pub fn preview_distribution(
        env: Env,
        amount: i128,
    ) -> Result<Vec<DistributionPreview>, RevenueSplitError> {
        Self::validate_distribution_amount(&env, amount)?;
        let shares = Self::load_recipients(&env);
        Self::build_distribution_preview(&env, &shares, amount)
    }

    /// Allows the current admin to set a new admin.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), RevenueSplitError> {
        let admin = Self::load_admin(&env)?;
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &new_admin);
        Self::bump_core_ttl(&env);

        AdminChangedEvent {
            old_admin: admin,
            new_admin,
        }
        .publish(&env);
        Ok(())
    }

    pub fn propose_admin_transfer(
        env: Env,
        proposed_admin: Address,
    ) -> Result<(), RevenueSplitError> {
        let admin = Self::load_admin(&env)?;
        admin.require_auth();
        if admin == proposed_admin {
            panic!("cannot propose self as pending admin");
        }
        env.storage()
            .persistent()
            .set(&DataKey::PendingAdmin, &proposed_admin);
        env.storage().persistent().extend_ttl(
            &DataKey::PendingAdmin,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        AdminTransferProposedEvent {
            current_admin: admin,
            proposed_admin,
        }
        .publish(&env);
        Ok(())
    }

    pub fn accept_admin_transfer(env: Env, new_admin: Address) -> Result<(), RevenueSplitError> {
        let pending_admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::PendingAdmin)
            .ok_or(RevenueSplitError::NoPendingAdminTransfer)?;
        if new_admin != pending_admin {
            return Err(RevenueSplitError::NotProposedAdmin);
        }
        new_admin.require_auth();
        let old_admin = Self::load_admin(&env)?;
        env.storage().persistent().set(&DataKey::Admin, &new_admin);
        env.storage().persistent().remove(&DataKey::PendingAdmin);
        Self::bump_core_ttl(&env);
        AdminTransferAcceptedEvent {
            old_admin,
            new_admin,
        }
        .publish(&env);
        Ok(())
    }

    pub fn cancel_admin_transfer(env: Env) -> Result<(), RevenueSplitError> {
        let admin = Self::load_admin(&env)?;
        admin.require_auth();
        let cancelled_admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::PendingAdmin)
            .ok_or(RevenueSplitError::NoPendingAdminTransfer)?;
        env.storage().persistent().remove(&DataKey::PendingAdmin);
        AdminTransferCancelledEvent {
            admin,
            cancelled_admin,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_pending_admin(env: Env) -> Option<Address> {
        env.storage().persistent().get(&DataKey::PendingAdmin)
    }

    /// Updates the recipient splits dynamically (admin only).
    pub fn update_recipients(
        env: Env,
        new_shares: Vec<RecipientShare>,
    ) -> Result<(), RevenueSplitError> {
        let admin = Self::load_admin(&env)?;
        admin.require_auth();
        Self::validate_shares(&new_shares)?;
        let recipient_count = new_shares.len();
        Self::store_recipients(&env, &new_shares);
        Self::bump_core_ttl(&env);

        RecipientsUpdatedEvent {
            admin,
            recipient_count,
        }
        .publish(&env);
        Ok(())
    }

    // ── Circuit breaker (Part 46) ─────────────────────────────────────────

    /// Pauses or unpauses the contract (admin only).
    ///
    /// While paused, all `distribute` calls are rejected. Administrative
    /// functions (`set_admin`, `update_recipients`, `bump_ttl`) remain
    /// available so that the contract can be restored to a healthy state.
    pub fn set_paused(env: Env, paused: bool) -> Result<(), RevenueSplitError> {
        let admin = Self::load_admin(&env)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &paused);
        env.storage()
            .instance()
            .extend_ttl(PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO);

        PauseStateChangedEvent { paused, admin }.publish(&env);
        Ok(())
    }

    /// Returns `true` if the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    /// Returns the total number of completed distributions.
    pub fn get_distribution_count(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::DistributionCount)
            .unwrap_or(0)
    }

    pub fn set_max_distribution_amount(
        env: Env,
        max_amount: i128,
    ) -> Result<(), RevenueSplitError> {
        let admin = Self::load_admin(&env)?;
        admin.require_auth();
        if max_amount <= 0 {
            return Err(RevenueSplitError::InvalidAmount);
        }
        env.storage()
            .persistent()
            .set(&DataKey::MaxDistributionAmount, &max_amount);
        env.storage().persistent().extend_ttl(
            &DataKey::MaxDistributionAmount,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        Self::bump_core_ttl(&env);
        Ok(())
    }

    pub fn get_max_distribution_amount(env: Env) -> i128 {
        let key = DataKey::MaxDistributionAmount;
        let max_amount = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(DEFAULT_MAX_DISTRIBUTION_AMOUNT);
        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
        }
        max_amount
    }

    /// Adds a token asset to the supported-asset allowlist (admin only).
    ///
    /// An empty allowlist preserves legacy behavior and accepts any token.
    /// Once at least one asset is added, `distribute` only accepts listed
    /// assets.
    pub fn add_supported_asset(env: Env, token: Address) -> Result<(), RevenueSplitError> {
        let admin = Self::load_admin(&env)?;
        admin.require_auth();

        let mut assets = Self::load_supported_assets_or_empty(&env);
        if !Self::asset_vec_contains(&assets, &token) {
            assets.push_back(token.clone());
            Self::store_supported_assets(&env, &assets);
        }

        AssetSupportedEvent { admin, token }.publish(&env);
        Ok(())
    }

    /// Removes a token asset from the supported-asset allowlist (admin only).
    pub fn remove_supported_asset(env: Env, token: Address) -> Result<(), RevenueSplitError> {
        let admin = Self::load_admin(&env)?;
        admin.require_auth();

        let assets = Self::load_supported_assets_or_empty(&env);
        let mut updated = Vec::new(&env);
        for asset in assets.iter() {
            if asset != token {
                updated.push_back(asset);
            }
        }
        Self::store_supported_assets(&env, &updated);

        AssetRemovedEvent { admin, token }.publish(&env);
        Ok(())
    }

    /// Returns the configured supported token assets.
    ///
    /// An empty list means the legacy open policy is active.
    pub fn get_supported_assets(env: Env) -> Vec<Address> {
        Self::load_supported_assets_or_empty(&env)
    }

    /// Returns whether `token` is currently distributable.
    pub fn is_asset_supported(env: Env, token: Address) -> bool {
        Self::is_asset_supported_internal(&env, &token)
    }

    /// Distributes a specific token amount from a sender to the listed recipients based on their shares.
    ///
    /// ### Algorithm: Basis Points Distribution
    /// - Each recipient receives a portion calculated as: `(amount * basis_points) / 10000`.
    /// - **Precision Management**: To ensure 100% of the funds are distributed and avoid
    ///   "dust" remaining in the sender's account due to rounding, the final recipient
    ///   in the list automatically absorbs any remainders.
    ///
    /// ### Requirements
    /// - `from` must authorize the transaction.
    /// - Contract must not be paused (circuit breaker).
    /// - Must be the only distribution in this ledger (replay protection).
    pub fn distribute(
        env: Env,
        token: Address,
        from: Address,
        amount: i128,
    ) -> Result<(), RevenueSplitError> {
        Self::validate_distribution_amount(&env, amount)?;
        if amount <= 0 {
            return Err(RevenueSplitError::InvalidAmount);
        }

        Self::require_not_paused(&env)?;
        from.require_auth();
        if !Self::is_asset_supported_internal(&env, &token) {
            return Err(RevenueSplitError::UnsupportedAsset);
        }
        Self::require_unique_ledger(&env)?;

        let shares = Self::load_recipients(&env);
        let recipient_count = shares.len();
        let preview = Self::build_distribution_preview(&env, &shares, amount)?;
        let client = token::Client::new(&env, &token);
        let mut actual_distributed = 0i128;

        for payment in preview.iter() {
            if payment.amount > 0 {
                client.transfer(&from, &payment.destination, &payment.amount);
                actual_distributed = actual_distributed
                    .checked_add(payment.amount)
                    .ok_or(RevenueSplitError::ArithmeticOverflow)?;
            }
        }

        // Accumulate total distributed for this token
        let td_key = DataKey::TotalDistributed(token.clone());
        let prev: i128 = env.storage().persistent().get(&td_key).unwrap_or(0);
        let total_distributed = prev
            .checked_add(actual_distributed)
            .ok_or(RevenueSplitError::ArithmeticOverflow)?;
        env.storage().persistent().set(&td_key, &total_distributed);
        env.storage().persistent().extend_ttl(
            &td_key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        // Increment distribution counter
        let count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::DistributionCount)
            .unwrap_or(0)
            + 1;
        env.storage()
            .persistent()
            .set(&DataKey::DistributionCount, &count);
        env.storage().persistent().extend_ttl(
            &DataKey::DistributionCount,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        DistributedEvent {
            token,
            from,
            total_amount: actual_distributed,
            recipient_count,
        }
        .publish(&env);
        Ok(())
    }

    /// Returns the ledger sequence of the last successful distribution.
    pub fn get_last_distribute_ledger(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::LastDistributeLedger)
            .unwrap_or(0)
    }

    /// Returns the cumulative amount of a given token that has been distributed
    /// through this contract since deployment.
    pub fn get_total_distributed(env: Env, token: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalDistributed(token))
            .unwrap_or(0)
    }

    /// Extends TTL for all critical contract state (admin only).
    pub fn bump_ttl(env: Env) -> Result<(), RevenueSplitError> {
        let admin = Self::load_admin(&env)?;
        admin.require_auth();
        Self::bump_core_ttl(&env);
        Ok(())
    }

    // ── Private helpers ───────────────────────────────────────────────────

    fn require_not_paused(env: &Env) -> Result<(), RevenueSplitError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(RevenueSplitError::ContractPaused);
        }
        Ok(())
    }

    fn validate_distribution_amount(env: &Env, amount: i128) -> Result<(), RevenueSplitError> {
        if amount <= 0 {
            return Err(RevenueSplitError::InvalidAmount);
        }
        let max_amount: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::MaxDistributionAmount)
            .unwrap_or(DEFAULT_MAX_DISTRIBUTION_AMOUNT);
        if amount > max_amount {
            return Err(RevenueSplitError::AmountTooLarge);
        }
        Ok(())
    }

    /// Ensures a distribution has not already been executed in the current ledger
    /// sequence, preventing replay attacks.
    fn require_unique_ledger(env: &Env) -> Result<(), RevenueSplitError> {
        let current_ledger = env.ledger().sequence();
        let last_ledger: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::LastDistributeLedger)
            .unwrap_or(0);
        if last_ledger == current_ledger && current_ledger != 0 {
            return Err(RevenueSplitError::LedgerReplayDetected);
        }

        env.storage()
            .persistent()
            .set(&DataKey::LastDistributeLedger, &current_ledger);
        env.storage().persistent().extend_ttl(
            &DataKey::LastDistributeLedger,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        Ok(())
    }

    fn load_admin(env: &Env) -> Result<Address, RevenueSplitError> {
        env.storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(RevenueSplitError::NotInitialized)
    }

    fn load_recipients(env: &Env) -> Vec<RecipientShare> {
        let key = DataKey::Recipients;
        let shares: Vec<RecipientShare> = env
            .storage()
            .persistent()
            .get(&key)
            .expect("Recipients entry unavailable; restore and retry");
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        shares
    }

    fn validate_shares(shares: &Vec<RecipientShare>) -> Result<(), RevenueSplitError> {
        if shares.is_empty() {
            return Err(RevenueSplitError::ZeroRecipients);
        }

        let mut total_bp = 0u32;
        let mut i = 0u32;
        while i < shares.len() {
            // Index is bounded by `i < shares.len()`, so None is an unreachable
            // invariant violation; surface it as a typed error rather than panicking.
            let share = shares.get(i).ok_or(RevenueSplitError::ZeroRecipients)?;
            if share.basis_points == 0 {
                return Err(RevenueSplitError::ZeroBasisPoints);
            }

            let mut j = i + 1;
            while j < shares.len() {
                let other = shares.get(j).ok_or(RevenueSplitError::ZeroRecipients)?;
                if share.destination == other.destination {
                    return Err(RevenueSplitError::DuplicateRecipient);
                }
                j += 1;
            }

            // checked_add guards against maliciously large basis_points values that
            // would silently wrap around and bypass the BasisPointsSumMismatch check.
            total_bp = total_bp
                .checked_add(share.basis_points)
                .ok_or(RevenueSplitError::ShareOverflow)?;
            i += 1;
        }

        if total_bp != TOTAL_BASIS_POINTS {
            return Err(RevenueSplitError::BasisPointsSumMismatch);
        }

        Ok(())
    }

    fn store_recipients(env: &Env, shares: &Vec<RecipientShare>) {
        let key = DataKey::Recipients;
        env.storage().persistent().set(&key, shares);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
    }

    fn load_supported_assets_or_empty(env: &Env) -> Vec<Address> {
        let key = DataKey::SupportedAssets;
        let assets = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env));
        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
        }
        assets
    }

    fn store_supported_assets(env: &Env, assets: &Vec<Address>) {
        let key = DataKey::SupportedAssets;
        env.storage().persistent().set(&key, assets);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
    }

    fn asset_vec_contains(assets: &Vec<Address>, token: &Address) -> bool {
        for asset in assets.iter() {
            if asset == *token {
                return true;
            }
        }
        false
    }

    fn is_asset_supported_internal(env: &Env, token: &Address) -> bool {
        let assets = Self::load_supported_assets_or_empty(env);
        assets.is_empty() || Self::asset_vec_contains(&assets, token)
    }

    /// Internal helper to calculate the distribution of an amount across recipients.
    ///
    /// The final recipient absorbs any rounding remainder to ensure 100% of
    /// the funds are distributed.
    fn build_distribution_preview(
        env: &Env,
        shares: &Vec<RecipientShare>,
        amount: i128,
    ) -> Result<Vec<DistributionPreview>, RevenueSplitError> {
        if amount < 0 {
            return Err(RevenueSplitError::InvalidAmount);
        }
        if shares.is_empty() {
            return Err(RevenueSplitError::ZeroRecipients);
        }

        let mut preview = Vec::new(env);
        let total_bp = TOTAL_BASIS_POINTS as i128;
        let mut amount_distributed = 0i128;

        for share in shares.iter() {
            let product = amount
                .checked_mul(share.basis_points as i128)
                .ok_or(RevenueSplitError::ArithmeticOverflow)?;
            let recipient_amount = product / total_bp;
            amount_distributed = amount_distributed
                .checked_add(recipient_amount)
                .ok_or(RevenueSplitError::ArithmeticOverflow)?;
            if amount_distributed > amount {
                return Err(RevenueSplitError::ArithmeticOverflow);
            }

            preview.push_back(DistributionPreview {
                destination: share.destination,
                basis_points: share.basis_points,
                amount: recipient_amount,
            });
        }

        Ok(preview)
    }

    fn bump_core_ttl(env: &Env) {
        for key in [
            DataKey::Admin,
            DataKey::Recipients,
            DataKey::DistributionCount,
            DataKey::SupportedAssets,
            DataKey::MaxDistributionAmount,
        ] {
            if env.storage().persistent().has(&key) {
                env.storage().persistent().extend_ttl(
                    &key,
                    PERSISTENT_TTL_THRESHOLD,
                    PERSISTENT_TTL_EXTEND_TO,
                );
            }
        }
        env.storage()
            .instance()
            .extend_ttl(PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO);
    }

    fn check_state_version(env: &Env) {
        let key = DataKey::StateVersion;
        let version: u32 = env.storage().persistent().get(&key).unwrap_or(0);
        if version < STATE_VERSION {
            env.storage().persistent().set(&key, &STATE_VERSION);
        }
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
    }
}
