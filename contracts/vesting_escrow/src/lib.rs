#![no_std]
#![allow(clippy::too_many_arguments)]
use soroban_sdk::{
    Address, Env, String, contract, contracterror, contractevent, contractimpl, contracttype, token,
};

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    /// Duration must be >= cliff duration.
    InvalidDuration = 4,
    /// Amount must be > 0.
    InvalidAmount = 5,
    /// Grant has already been revoked or is inactive.
    AlreadyRevoked = 6,
    /// Contract is paused — claim and clawback operations are suspended.
    ContractPaused = 7,
    /// Operation already processed in this ledger sequence.
    LedgerReplayDetected = 8,
    /// Vesting grant is no longer active (required for beneficiary transfer).
    GrantInactive = 9,
    /// Same admin address supplied — no change required.
    SameAdmin = 10,
    /// Clawback amount must be positive.
    InvalidClawbackAmount = 11,
    /// Extension seconds must be positive.
    InvalidExtension = 12,
    /// Partial clawback would reduce the grant below what has already been claimed.
    ClawbackBelowClaimed = 13,
    /// Duration overflow when extending the vesting schedule.
    DurationOverflow = 14,
    /// Accounting invariant violated: clawback amount exceeds remaining total.
    InvariantViolation = 15,
    /// New beneficiary is the same as the current beneficiary.
    SameBeneficiary = 16,
    /// start_time of zero is rejected — it almost certainly indicates a missing field.
    InvalidStartTime = 17,
    /// duration_seconds must be greater than zero.
    ZeroDuration = 18,
}

// ── Events ────────────────────────────────────────────────────────────────────

/// Emitted when the vesting escrow is successfully funded and configured.
#[contractevent]
pub struct VestingInitializedEvent {
    pub beneficiary: Address,
    pub token: Address,
    pub total_amount: i128,
    pub cliff_seconds: u64,
    pub duration_seconds: u64,
    pub start_time: u64,
    pub admin: Address,
    pub clawback_admin: Address,
}

/// Emitted when the beneficiary successfully claims vested tokens.
#[contractevent]
pub struct TokensClaimedEvent {
    pub beneficiary: Address,
    pub amount: i128,
    pub total_claimed: i128,
}

/// Emitted when the clawback admin terminates the grant early (full clawback).
#[contractevent]
pub struct ClawbackExecutedEvent {
    pub clawback_admin: Address,
    pub unvested_returned: i128,
    pub vested_remaining: i128,
}

/// Emitted when the clawback admin executes a partial clawback.
#[contractevent]
pub struct PartialClawbackExecutedEvent {
    pub clawback_admin: Address,
    pub clawback_amount: i128,
    pub remaining_total: i128,
}

/// Emitted when the beneficiary address is transferred to a new account.
#[contractevent]
pub struct BeneficiaryTransferredEvent {
    pub old_beneficiary: Address,
    pub new_beneficiary: Address,
}

/// Emitted when the vesting schedule duration is extended.
#[contractevent]
pub struct VestingScheduleExtendedEvent {
    pub clawback_admin: Address,
    pub previous_duration: u64,
    pub new_duration: u64,
    pub previous_end: u64,
    pub new_end: u64,
}

/// Emitted when the contract is paused or unpaused (circuit breaker).
#[contractevent]
pub struct ContractStatusChangedEvent {
    pub paused: bool,
    pub admin: Address,
}

/// Emitted when the contract is upgraded to a new version.
#[contractevent]
pub struct ContractUpgradedEvent {
    pub admin: Address,
    pub old_version: u32,
    pub new_version: u32,
}

// ── Storage types ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub struct VestingConfig {
    pub beneficiary: Address,
    pub token: Address,
    pub start_time: u64,
    pub cliff_seconds: u64,
    pub duration_seconds: u64,
    pub total_amount: i128,
    pub claimed_amount: i128,
    pub clawback_admin: Address,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct VestingSnapshot {
    pub timestamp: u64,
    pub vested_amount: i128,
    pub claimable_amount: i128,
    pub locked_amount: i128,
    pub claimed_amount: i128,
    pub total_amount: i128,
    pub progress_bps: u32,
    pub is_active: bool,
}

#[contracttype]
pub enum DataKey {
    Config,
    Admin,
    /// Tracks the last ledger sequence in which a claim was processed.
    LastClaimLedger,
    /// Tracks the last ledger sequence in which a clawback was processed.
    LastClawbackLedger,
    /// Emergency pause flag (circuit breaker, stored in Instance).
    Paused,
    /// Contract version for upgrade tracking.
    Version,
}

const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;
const BASIS_POINTS_DENOMINATOR: u32 = 10_000;

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct VestingContract;

#[contractimpl]
impl VestingContract {
    // ── SEP-0034 Contract Metadata (Issue #263) ───────────────────────────

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

    // ── Initialization ────────────────────────────────────────────────────

    /// Funds and initializes the vesting escrow.
    ///
    /// This function can only be called once. The `funder` authorizes the
    /// transfer of `amount` tokens into the contract, after which the grant
    /// becomes claimable according to the configured cliff and duration.
    ///
    /// The `admin` address has governance rights (pause, set_admin, bump_ttl).
    /// The `clawback_admin` has operational rights (clawback, partial_clawback,
    /// extend_vesting, transfer_beneficiary).
    pub fn initialize(
        e: Env,
        funder: Address,
        beneficiary: Address,
        token: Address,
        start_time: u64,
        cliff_seconds: u64,
        duration_seconds: u64,
        amount: i128,
        clawback_admin: Address,
        admin: Address,
    ) -> Result<(), ContractError> {
        if e.storage().persistent().has(&DataKey::Config) {
            return Err(ContractError::AlreadyInitialized);
        }

        funder.require_auth();

        if start_time == 0 {
            return Err(ContractError::InvalidStartTime);
        }

        if duration_seconds == 0 {
            return Err(ContractError::ZeroDuration);
        }

        if duration_seconds < cliff_seconds {
            return Err(ContractError::InvalidDuration);
        }

        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        let config = VestingConfig {
            beneficiary: beneficiary.clone(),
            token: token.clone(),
            start_time,
            cliff_seconds,
            duration_seconds,
            total_amount: amount,
            claimed_amount: 0,
            clawback_admin: clawback_admin.clone(),
            is_active: true,
        };

        e.storage().persistent().set(&DataKey::Config, &config);
        e.storage().persistent().set(&DataKey::Admin, &admin);
        Self::bump_config_ttl(&e);

        let client = token::Client::new(&e, &token);
        client.transfer(&funder, e.current_contract_address(), &amount);

        VestingInitializedEvent {
            beneficiary,
            token,
            total_amount: amount,
            cliff_seconds,
            duration_seconds,
            start_time,
            admin,
            clawback_admin,
        }
        .publish(&e);
        Ok(())
    }

    // ── Admin governance ──────────────────────────────────────────────────

    /// Transfers administrative control to a new admin address.
    ///
    /// Only the current admin may call this function. If `new_admin` equals
    /// the current admin the call returns `SameAdmin` without side effects.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        admin.require_auth();

        env.storage().persistent().extend_ttl(
            &DataKey::Admin,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        if admin == new_admin {
            return Err(ContractError::SameAdmin);
        }

        env.storage().persistent().set(&DataKey::Admin, &new_admin);
        Self::bump_config_ttl(&env);
        Ok(())
    }

    /// Returns the current admin address.
    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

    // ── Emergency pause (circuit breaker) ─────────────────────────────────

    /// Pause or unpause the contract.
    ///
    /// When paused, `claim` and `clawback` (including `partial_clawback`) are
    /// rejected with `ContractPaused`. Read-only functions and admin governance
    /// functions (`set_admin`, `bump_ttl`, `set_paused`) remain available.
    ///
    /// Only the current admin may call this.
    pub fn set_paused(env: Env, paused: bool) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &paused);

        ContractStatusChangedEvent { paused, admin }.publish(&env);
        Ok(())
    }

    /// Returns `true` if the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    // ── Contract Upgrade / Version Management ──────────────────────────────

    /// Returns the current contract version.
    pub fn get_version(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Version)
            .unwrap_or(1)
    }

    /// Marks the contract as upgraded to a new version (admin only).
    /// Used for tracking contract state evolution and enabling state migrations.
    pub fn mark_upgrade(env: Env, new_version: u32) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        admin.require_auth();

        let old_version = env
            .storage()
            .persistent()
            .get(&DataKey::Version)
            .unwrap_or(1);

        env.storage()
            .persistent()
            .set(&DataKey::Version, &new_version);
        env.storage().persistent().extend_ttl(
            &DataKey::Version,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        ContractUpgradedEvent {
            admin,
            old_version,
            new_version,
        }
        .publish(&env);

        Ok(())
    }

    // ── Claim ─────────────────────────────────────────────────────────────

    /// Claims all currently vested and unclaimed tokens for the beneficiary.
    ///
    /// The beneficiary must authorize the call. If no new tokens have vested,
    /// the function is a no-op.
    pub fn claim(e: Env) -> Result<(), ContractError> {
        Self::require_not_paused(&e)?;

        let mut config: VestingConfig = e
            .storage()
            .persistent()
            .get(&DataKey::Config)
            .ok_or(ContractError::NotInitialized)?;

        config.beneficiary.require_auth();

        Self::require_unique_ledger(&e, &DataKey::LastClaimLedger)?;

        let vested = Self::calc_vested(&e, &config);
        let claimable = Self::calc_claimable(vested, config.claimed_amount);

        if claimable <= 0 {
            return Ok(());
        }

        config.claimed_amount += claimable;
        e.storage().persistent().set(&DataKey::Config, &config);
        Self::bump_config_ttl(&e);

        let client = token::Client::new(&e, &config.token);
        client.transfer(
            &e.current_contract_address(),
            &config.beneficiary,
            &claimable,
        );

        TokensClaimedEvent {
            beneficiary: config.beneficiary,
            amount: claimable,
            total_claimed: config.claimed_amount,
        }
        .publish(&e);
        Ok(())
    }

    // ── Full clawback ─────────────────────────────────────────────────────

    /// Terminates future vesting and returns unvested tokens to the clawback admin.
    ///
    /// Already vested but unclaimed tokens remain in escrow for the beneficiary.
    /// The clawback admin must authorize the call.
    pub fn clawback(e: Env) -> Result<(), ContractError> {
        Self::require_not_paused(&e)?;

        let mut config: VestingConfig = e
            .storage()
            .persistent()
            .get(&DataKey::Config)
            .ok_or(ContractError::NotInitialized)?;

        config.clawback_admin.require_auth();

        Self::require_unique_ledger(&e, &DataKey::LastClawbackLedger)?;

        if !config.is_active {
            return Err(ContractError::AlreadyRevoked);
        }

        let vested = Self::calc_vested(&e, &config);
        let vested_floor = Self::max_i128(vested, config.claimed_amount);

        let unvested = config.total_amount - vested_floor;

        config.total_amount = vested_floor;
        config.is_active = false;
        e.storage().persistent().set(&DataKey::Config, &config);
        Self::bump_config_ttl(&e);

        if unvested > 0 {
            let client = token::Client::new(&e, &config.token);
            client.transfer(
                &e.current_contract_address(),
                &config.clawback_admin,
                &unvested,
            );
        }

        let vested_remaining = Self::calc_claimable(vested_floor, config.claimed_amount);
        ClawbackExecutedEvent {
            clawback_admin: config.clawback_admin,
            unvested_returned: unvested,
            vested_remaining,
        }
        .publish(&e);
        Ok(())
    }

    // ── Partial clawback ──────────────────────────────────────────────────

    /// Clawback a specific amount of unvested tokens without terminating the grant.
    ///
    /// This allows the clawback admin to reduce the grant size while keeping
    /// the vesting schedule active. The amount must not reduce the total below
    /// what has already been claimed. Requires the clawback admin to authorize.
    pub fn partial_clawback(env: Env, amount: i128) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;

        let mut config: VestingConfig = env
            .storage()
            .persistent()
            .get(&DataKey::Config)
            .ok_or(ContractError::NotInitialized)?;

        config.clawback_admin.require_auth();

        if !config.is_active {
            return Err(ContractError::AlreadyRevoked);
        }

        if amount <= 0 {
            return Err(ContractError::InvalidClawbackAmount);
        }

        let new_total = config
            .total_amount
            .checked_sub(amount)
            .ok_or(ContractError::InvariantViolation)?;

        if new_total < config.claimed_amount {
            return Err(ContractError::ClawbackBelowClaimed);
        }

        let actual_clawback = config.total_amount - new_total;

        config.total_amount = new_total;
        env.storage().persistent().set(&DataKey::Config, &config);
        Self::bump_config_ttl(&env);

        let client = token::Client::new(&env, &config.token);
        client.transfer(
            &env.current_contract_address(),
            &config.clawback_admin,
            &actual_clawback,
        );

        PartialClawbackExecutedEvent {
            clawback_admin: config.clawback_admin,
            clawback_amount: actual_clawback,
            remaining_total: new_total,
        }
        .publish(&env);
        Ok(())
    }

    // ── Vesting schedule extension ────────────────────────────────────────

    /// Extends the vesting duration by `additional_seconds`.
    ///
    /// This allows the clawback admin to prolong the vesting period without
    /// changing the cliff. Only callable while the grant is active. The
    /// additional seconds must be positive.
    pub fn extend_vesting(env: Env, additional_seconds: u64) -> Result<(), ContractError> {
        let mut config: VestingConfig = env
            .storage()
            .persistent()
            .get(&DataKey::Config)
            .ok_or(ContractError::NotInitialized)?;

        config.clawback_admin.require_auth();

        if !config.is_active {
            return Err(ContractError::AlreadyRevoked);
        }

        if additional_seconds == 0 {
            return Err(ContractError::InvalidExtension);
        }

        let previous_duration = config.duration_seconds;
        let previous_end = config.start_time.saturating_add(previous_duration);

        config.duration_seconds = config
            .duration_seconds
            .checked_add(additional_seconds)
            .ok_or(ContractError::DurationOverflow)?;
        let new_end = config.start_time.saturating_add(config.duration_seconds);

        env.storage().persistent().set(&DataKey::Config, &config);
        Self::bump_config_ttl(&env);

        VestingScheduleExtendedEvent {
            clawback_admin: config.clawback_admin,
            previous_duration,
            new_duration: config.duration_seconds,
            previous_end,
            new_end,
        }
        .publish(&env);
        Ok(())
    }

    // ── Read-only accessors ───────────────────────────────────────────────

    /// Returns the amount that has vested at the current ledger timestamp.
    pub fn get_vested_amount(e: Env) -> i128 {
        let config: VestingConfig = e
            .storage()
            .persistent()
            .get(&DataKey::Config)
            .expect("Config entry unavailable; restore and retry");
        Self::calc_vested(&e, &config)
    }

    /// Returns the amount that is vested and not yet claimed.
    pub fn get_claimable_amount(e: Env) -> i128 {
        let config: VestingConfig = e
            .storage()
            .persistent()
            .get(&DataKey::Config)
            .expect("Config entry unavailable; restore and retry");
        let vested = Self::calc_vested(&e, &config);
        Self::calc_claimable(vested, config.claimed_amount)
    }

    /// Returns the current escrow configuration.
    pub fn get_config(e: Env) -> VestingConfig {
        let config: VestingConfig = e
            .storage()
            .persistent()
            .get(&DataKey::Config)
            .expect("Config entry unavailable; restore and retry");
        config
    }

    /// Returns the amount still held by the escrow contract for this grant.
    ///
    /// This includes vested-but-unclaimed tokens and, while the grant is active,
    /// future unvested tokens. It never returns a negative value.
    pub fn get_locked_amount(e: Env) -> i128 {
        let config: VestingConfig = e
            .storage()
            .persistent()
            .get(&DataKey::Config)
            .expect("Config entry unavailable; restore and retry");
        Self::calc_locked(config.total_amount, config.claimed_amount)
    }

    /// Returns the vested amount at an arbitrary timestamp without changing state.
    pub fn preview_vested_amount(e: Env, timestamp: u64) -> i128 {
        let config: VestingConfig = e
            .storage()
            .persistent()
            .get(&DataKey::Config)
            .expect("Config entry unavailable; restore and retry");
        Self::calc_vested_at(timestamp, &config)
    }

    /// Returns current vesting progress in basis points where 10_000 is 100%.
    pub fn get_vesting_progress_bps(e: Env) -> u32 {
        let config: VestingConfig = e
            .storage()
            .persistent()
            .get(&DataKey::Config)
            .expect("Config entry unavailable; restore and retry");
        let vested = Self::calc_vested(&e, &config);
        Self::calc_progress_bps(vested, config.total_amount)
    }

    /// Returns a compact read-only snapshot of the current escrow state.
    pub fn get_vesting_snapshot(e: Env) -> VestingSnapshot {
        let config: VestingConfig = e
            .storage()
            .persistent()
            .get(&DataKey::Config)
            .expect("Config entry unavailable; restore and retry");
        let timestamp = e.ledger().timestamp();
        let vested_amount = Self::calc_vested_at(timestamp, &config);
        let claimable_amount = Self::calc_claimable(vested_amount, config.claimed_amount);
        let locked_amount = Self::calc_locked(config.total_amount, config.claimed_amount);

        VestingSnapshot {
            timestamp,
            vested_amount,
            claimable_amount,
            locked_amount,
            claimed_amount: config.claimed_amount,
            total_amount: config.total_amount,
            progress_bps: Self::calc_progress_bps(vested_amount, config.total_amount),
            is_active: config.is_active,
        }
    }

    // ── Beneficiary management ────────────────────────────────────────────

    /// Transfers the vesting grant to a new beneficiary address. Only the
    /// `clawback_admin` may call this (e.g. to handle account migration).
    /// The new beneficiary inherits all unclaimed vested and future tokens.
    pub fn transfer_beneficiary(e: Env, new_beneficiary: Address) -> Result<(), ContractError> {
        let mut config: VestingConfig = e
            .storage()
            .persistent()
            .get(&DataKey::Config)
            .ok_or(ContractError::NotInitialized)?;

        config.clawback_admin.require_auth();

        if new_beneficiary == config.beneficiary {
            return Err(ContractError::SameBeneficiary);
        }

        if !config.is_active {
            return Err(ContractError::GrantInactive);
        }

        let old_beneficiary = config.beneficiary.clone();
        config.beneficiary = new_beneficiary.clone();
        e.storage().persistent().set(&DataKey::Config, &config);
        Self::bump_config_ttl(&e);

        BeneficiaryTransferredEvent {
            old_beneficiary,
            new_beneficiary,
        }
        .publish(&e);
        Ok(())
    }

    // ── TTL management ────────────────────────────────────────────────────

    /// Extends TTL for the vesting configuration and admin entries.
    /// Only the admin may call this.
    pub fn bump_ttl(e: Env) -> Result<(), ContractError> {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        admin.require_auth();
        Self::bump_config_ttl(&e);
        Ok(())
    }

    /// Returns the ledger sequence of the last successful claim.
    pub fn get_last_claim_ledger(e: Env) -> u32 {
        e.storage()
            .persistent()
            .get(&DataKey::LastClaimLedger)
            .unwrap_or(0)
    }

    /// Returns the ledger sequence of the last successful clawback.
    pub fn get_last_clawback_ledger(e: Env) -> u32 {
        e.storage()
            .persistent()
            .get(&DataKey::LastClawbackLedger)
            .unwrap_or(0)
    }

    // ── Private helpers ───────────────────────────────────────────────────

    fn calc_vested(e: &Env, config: &VestingConfig) -> i128 {
        Self::calc_vested_at(e.ledger().timestamp(), config)
    }

    fn calc_vested_at(now: u64, config: &VestingConfig) -> i128 {
        if config.duration_seconds == 0 {
            return config.total_amount;
        }

        let cliff_at = config.start_time.saturating_add(config.cliff_seconds);
        let end_at = config.start_time.saturating_add(config.duration_seconds);

        if now < cliff_at {
            return 0;
        }

        if now >= end_at || !config.is_active {
            return config.total_amount;
        }

        let time_elapsed = now.saturating_sub(config.start_time);
        let total = config.total_amount;
        let elapsed = time_elapsed as u128;
        let duration = config.duration_seconds as u128;

        let duration_i128 = config.duration_seconds as i128;
        let per_unit = total / duration_i128;
        let remainder = (total % duration_i128) as u128;
        let remainder_component = ((remainder * elapsed) / duration) as i128;
        per_unit * time_elapsed as i128 + remainder_component
    }

    fn calc_claimable(vested: i128, claimed: i128) -> i128 {
        if vested <= claimed {
            0
        } else {
            vested - claimed
        }
    }

    fn calc_locked(total: i128, claimed: i128) -> i128 {
        if total <= claimed { 0 } else { total - claimed }
    }

    fn calc_progress_bps(vested: i128, total: i128) -> u32 {
        if total <= 0 || vested <= 0 {
            return 0;
        }
        if vested >= total {
            return BASIS_POINTS_DENOMINATOR;
        }

        let multiplier = BASIS_POINTS_DENOMINATOR as i128;
        match vested.checked_mul(multiplier) {
            Some(scaled) => (scaled / total) as u32,
            None => {
                let units = total / multiplier;
                if units <= 0 {
                    return 0;
                }
                let coarse = vested / units;
                if coarse >= multiplier {
                    BASIS_POINTS_DENOMINATOR
                } else {
                    coarse as u32
                }
            }
        }
    }

    fn max_i128(lhs: i128, rhs: i128) -> i128 {
        if lhs >= rhs { lhs } else { rhs }
    }

    /// Ensures the operation has not already been executed in the current ledger
    /// sequence, preventing replay attacks. Records the current ledger on success.
    fn require_unique_ledger(e: &Env, key: &DataKey) -> Result<(), ContractError> {
        let current_ledger = e.ledger().sequence();
        let last_ledger: u32 = e.storage().persistent().get(key).unwrap_or(0);
        if last_ledger == current_ledger && current_ledger != 0 {
            return Err(ContractError::LedgerReplayDetected);
        }
        e.storage().persistent().set(key, &current_ledger);
        e.storage().persistent().extend_ttl(
            key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        Ok(())
    }

    fn require_not_paused(env: &Env) -> Result<(), ContractError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(ContractError::ContractPaused);
        }
        Ok(())
    }

    fn bump_config_ttl(e: &Env) {
        for key in [&DataKey::Config, &DataKey::Admin] {
            if e.storage().persistent().has(key) {
                e.storage().persistent().extend_ttl(
                    key,
                    PERSISTENT_TTL_THRESHOLD,
                    PERSISTENT_TTL_EXTEND_TO,
                );
            }
        }
    }
}

#[cfg(test)]
mod test;

#[cfg(test)]
mod test_escrow_logic;
