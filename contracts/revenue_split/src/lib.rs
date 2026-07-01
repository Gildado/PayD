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
}

// ── Events ────────────────────────────────────────────────────────────────────

/// Emitted when a distribution is executed successfully.
#[contractevent]
pub struct DistributedEvent {
    pub token: Address,
    pub from: Address,
    pub total_amount: i128,
    pub recipient_count: u32,
}

/// Emitted when the admin updates the recipient split configuration.
#[contractevent]
pub struct RecipientsUpdatedEvent {
    pub admin: Address,
    pub recipient_count: u32,
}

/// Emitted when the admin address is changed.
#[contractevent]
pub struct AdminChangedEvent {
    pub old_admin: Address,
    pub new_admin: Address,
}

/// Emitted when the contract pause state changes (circuit breaker).
#[contractevent]
pub struct PauseStateChangedEvent {
    pub paused: bool,
    pub admin: Address,
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

const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;

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

        Self::validate_shares(&shares)?;

        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::DistributionCount, &0u64);
        Self::store_recipients(&env, &shares);
        Self::bump_core_ttl(&env);
        Ok(())
    }

    /// Returns the current admin address.
    pub fn get_admin(env: Env) -> Address {
        Self::load_admin(&env)
    }

    /// Returns the currently configured recipient split.
    pub fn get_recipients(env: Env) -> Vec<RecipientShare> {
        Self::load_recipients(&env)
    }

    /// Previews how an incoming amount would be distributed across recipients.
    pub fn preview_distribution(env: Env, amount: i128) -> Vec<DistributionPreview> {
        let shares = Self::load_recipients(&env);
        Self::build_distribution_preview(&env, &shares, amount)
    }

    /// Allows the current admin to set a new admin.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), RevenueSplitError> {
        let admin = Self::load_admin(&env);
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &new_admin);
        Self::bump_core_ttl(&env);

        AdminChangedEvent {
            old_admin: admin,
            new_admin,
        }
        .publish(&env);
    }

    /// Updates the recipient splits dynamically (admin only).
    pub fn update_recipients(
        env: Env,
        new_shares: Vec<RecipientShare>,
    ) -> Result<(), RevenueSplitError> {
        let admin = Self::load_admin(&env);
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
    pub fn set_paused(env: Env, paused: bool) {
        let admin = Self::load_admin(&env);
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &paused);

        PauseStateChangedEvent { paused, admin }.publish(&env);
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
        if amount <= 0 {
            return Ok(());
        }

        Self::require_not_paused(&env)?;
        from.require_auth();
        Self::require_unique_ledger(&env)?;

        let shares = Self::load_recipients(&env);
        let recipient_count = shares.len();
        let preview = Self::build_distribution_preview(&env, &shares, amount);
        let client = token::Client::new(&env, &token);

        for payment in preview.iter() {
            if payment.amount > 0 {
                client.transfer(&from, &payment.destination, &payment.amount);
            }
        }

        // Accumulate total distributed for this token
        let td_key = DataKey::TotalDistributed(token.clone());
        let prev: i128 = env.storage().persistent().get(&td_key).unwrap_or(0);
        env.storage().persistent().set(&td_key, &(prev + amount));
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
            total_amount: amount,
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
    pub fn bump_ttl(env: Env) {
        let admin = Self::load_admin(&env);
        admin.require_auth();
        Self::bump_core_ttl(&env);
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

    fn load_admin(env: &Env) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Admin entry unavailable; restore and retry")
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
            let share = shares.get(i).expect("Recipient share missing");
            if share.basis_points == 0 {
                return Err(RevenueSplitError::ZeroBasisPoints);
            }

            let mut j = i + 1;
            while j < shares.len() {
                let other = shares.get(j).expect("Recipient share missing");
                if share.destination == other.destination {
                    return Err(RevenueSplitError::DuplicateRecipient);
                }
                j += 1;
            }

            total_bp = total_bp
                .checked_add(share.basis_points)
                .expect("Share total overflow");
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

    /// Internal helper to calculate the distribution of an amount across recipients.
    ///
    /// The final recipient absorbs any rounding remainder to ensure 100% of
    /// the funds are distributed.
    fn build_distribution_preview(
        env: &Env,
        shares: &Vec<RecipientShare>,
        amount: i128,
    ) -> Vec<DistributionPreview> {
        if amount < 0 {
            panic!("Amount must not be negative");
        }

        let mut preview = Vec::new(env);
        let total_bp = TOTAL_BASIS_POINTS as i128;
        let mut amount_distributed = 0i128;
        let shares_len = shares.len();

        for (index, share) in shares.iter().enumerate() {
            let recipient_amount = if index as u32 == shares_len - 1 {
                amount - amount_distributed
            } else {
                let split = (amount * share.basis_points as i128) / total_bp;
                amount_distributed += split;
                split
            };

            preview.push_back(DistributionPreview {
                destination: share.destination,
                basis_points: share.basis_points,
                amount: recipient_amount,
            });
        }

        preview
    }

    fn bump_core_ttl(env: &Env) {
        for key in [
            DataKey::Admin,
            DataKey::Recipients,
            DataKey::DistributionCount,
        ] {
            if env.storage().persistent().has(&key) {
                env.storage().persistent().extend_ttl(
                    &key,
                    PERSISTENT_TTL_THRESHOLD,
                    PERSISTENT_TTL_EXTEND_TO,
                );
            }
        }
    }
}
