#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    Address, Env, String, Symbol, Vec, contract, contracterror, contractevent, contractimpl,
    contracttype, symbol_short, token,
};

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    EmptyBatch = 4,
    BatchTooLarge = 5,
    InvalidAmount = 6,
    AmountOverflow = 7,
    SequenceMismatch = 8,
    BatchNotFound = 9,
    DailyLimitExceeded = 10,
    WeeklyLimitExceeded = 11,
    MonthlyLimitExceeded = 12,
    InvalidLimitConfig = 13,
    /// Payment is not in a Failed state, so no refund is available.
    RefundNotAvailable = 14,
    /// Payment has already been refunded; cannot refund twice.
    AlreadyRefunded = 15,
    /// No PaymentEntry found for the given (batch_id, payment_index).
    PaymentNotFound = 16,
    /// Contract is paused — all payment operations are suspended.
    ContractPaused = 17,
    /// Sender already executed a batch in this ledger sequence.
    LedgerReplayDetected = 18,
    /// Scheduled batch does not exist or has expired.
    ScheduledBatchNotFound = 19,
    /// Scheduled batch cannot be executed yet — target ledger not reached.
    ScheduledBatchNotReady = 20,
    /// Scheduled batch has already been executed or cancelled.
    ScheduledBatchConsumed = 21,
    /// Only the original sender may cancel a scheduled batch.
    ScheduledBatchUnauthorized = 22,
    /// Throttle configuration is outside supported contract bounds.
    InvalidThrottleConfig = 23,
    /// Sender submitted another batch before the configured throttle gap elapsed.
    ThrottleLimitExceeded = 24,
    /// Fee estimation inputs are invalid.
    InvalidFeeConfig = 25,
    /// Auto-refund transfer failed or configuration is invalid.
    AutoRefundFailed = 26,
    /// Refund threshold or amount is invalid (zero or negative).
    RefundThresholdInvalid = 27,
    /// Auto-refund is not configured yet.
    RefundConfigNotSet = 28,
    /// Balance is above threshold — no refund needed.
    RefundNotNeeded = 29,
}

// ── Events ────────────────────────────────────────────────────────────────────

#[contractevent]
pub struct BonusPaymentEvent {
    pub batch_id: u64,
    pub recipient: Address,
    pub amount: i128,
    pub category: Symbol,
}

#[contractevent]
pub struct PaymentSentEvent {
    pub batch_id: u64,
    pub payment_index: u32,
    pub recipient: Address,
    pub amount: i128,
    pub category: Symbol,
}

#[contractevent]
pub struct PaymentSkippedEvent {
    pub batch_id: u64,
    pub payment_index: u32,
    pub recipient: Address,
    pub amount: i128,
    pub category: Symbol,
}

#[contractevent]
pub struct TransactionBlockedEvent {
    pub account: Address,
    pub attempted_amount: i128,
    pub limit_type: LimitTier,
    pub current_usage: i128,
    pub cap: i128,
}

#[contractevent]
pub struct LimitsUpdatedEvent {
    pub account: Address,
    pub daily_limit: i128,
    pub weekly_limit: i128,
    pub monthly_limit: i128,
}

/// Emitted when a failed payment's held funds are returned to the batch sender.
#[contractevent]
pub struct RefundIssuedEvent {
    pub batch_id: u64,
    pub payment_index: u32,
    pub sender: Address,
    pub amount: i128,
}

/// Emitted when the contract is paused or unpaused (circuit breaker).
#[contractevent]
pub struct ContractStatusChangedEvent {
    pub paused: bool,
    pub admin: Address,
}

/// Emitted when a batch is scheduled for future execution.
#[contractevent]
pub struct BatchScheduledEvent {
    pub scheduled_id: u64,
    pub sender: Address,
    pub execute_after_ledger: u32,
}

/// Emitted when a scheduled batch is executed.
#[contractevent]
pub struct ScheduledBatchExecutedEvent {
    pub scheduled_id: u64,
    pub batch_id: u64,
    pub total_sent: i128,
}

/// Emitted when a scheduled batch is cancelled by its sender.
#[contractevent]
pub struct ScheduledBatchCancelledEvent {
    pub scheduled_id: u64,
    pub sender: Address,
}

/// Emitted when an all-or-nothing batch completes successfully.
#[contractevent]
pub struct BatchExecutedEvent {
    pub batch_id: u64,
    pub total_sent: i128,
}

/// Emitted when a partial batch completes (some payments may have been skipped).
#[contractevent]
pub struct BatchPartialEvent {
    pub batch_id: u64,
    pub success_count: u32,
    pub fail_count: u32,
}

/// Emitted for real-time analytics indexing on contract initialization.
#[contractevent]
pub struct ContractInitializedEvent {
    pub admin: Address,
    pub timestamp: u64,
}

/// Emitted for real-time analytics tracking of batch processing metrics.
#[contractevent]
pub struct BatchAnalyticsEvent {
    pub batch_id: u64,
    pub sender: Address,
    pub token: Address,
    pub total_sent: i128,
    pub payment_count: u32,
    pub timestamp: u64,
}

/// Emitted when the distribution account is automatically re-funded.
#[contractevent]
pub struct AccountRefundedEvent {
    pub distribution_account: Address,
    pub funding_source: Address,
    pub token: Address,
    pub amount: i128,
    pub balance_before: i128,
    pub balance_after: i128,
}

/// Emitted when auto-refund configuration is updated.
#[contractevent]
pub struct RefundConfigUpdatedEvent {
    pub distribution_account: Address,
    pub funding_source: Address,
    pub token: Address,
    pub threshold: i128,
    pub refund_amount: i128,
}

/// Emitted when a batch status map is archived to compressed storage.
#[contractevent]
pub struct BatchArchivedEvent {
    pub batch_id: u64,
    pub payment_count: u32,
}

// ── Storage types ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentOp {
    pub recipient: Address,
    pub amount: i128,
    pub category: Symbol,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct BatchRecord {
    pub sender: Address,
    pub token: Address,
    pub total_sent: i128,
    pub success_count: u32,
    pub fail_count: u32,
    pub status: Symbol,
}

/// Configurable limit tiers per account.
/// A cap value of 0 means "no limit" for that tier.
#[contracttype]
#[derive(Clone, Debug)]
pub struct AccountLimits {
    pub daily_limit: i128,
    pub weekly_limit: i128,
    pub monthly_limit: i128,
}

/// Tracks cumulative spending within each rolling window.
#[contracttype]
#[derive(Clone, Debug)]
pub struct AccountUsage {
    pub daily_spent: i128,
    pub daily_reset_ledger: u32,
    pub weekly_spent: i128,
    pub weekly_reset_ledger: u32,
    pub monthly_spent: i128,
    pub monthly_reset_ledger: u32,
}

/// Network throughput controls applied to every batch submission path.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ThrottleConfig {
    pub max_batch_size: u32,
    pub min_ledger_gap: u32,
}

/// Deterministic fee estimate for a payroll batch.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeeEstimate {
    pub payment_count: u32,
    pub operation_count: u32,
    pub base_fee_stroops: i128,
    pub recommended_fee_stroops: i128,
    pub budget_fee_stroops: i128,
    pub fee_bump_required: bool,
}

/// Tier identifier used in events.
#[contracttype]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum LimitTier {
    Daily = 0,
    Weekly = 1,
    Monthly = 2,
}

/// Per-payment lifecycle status used by `execute_batch_v2`.
///
/// ### State Machine
/// 1. **Pending**: Initial state before any execution (internal to input).
/// 2. **Sent**: Successfully executed payment where funds moved from sender to recipient.
/// 3. **Failed**: Payment skipped due to invalid amount or insufficient funds.
///    The proportional funds are held in the contract account.
/// 4. **Refunded**: A previously `Failed` payment whose funds have been returned
///    to the original sender via `refund_failed_payment`.
#[contracttype]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum PaymentStatus {
    Pending = 0,
    Sent = 1,
    Failed = 2,
    Refunded = 3,
}

/// Individual payment record stored per `(batch_id, payment_index)`.
/// Enables per-payment status queries and targeted manual refunds.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PaymentEntry {
    pub recipient: Address,
    pub amount: i128,
    pub category: Symbol,
    pub status: PaymentStatus,
}

/// Status of a scheduled batch.
#[contracttype]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum ScheduledBatchStatus {
    Pending = 0,
    Executed = 1,
    Cancelled = 2,
}

/// A batch queued for future execution.
#[contracttype]
#[derive(Clone, Debug)]
pub struct ScheduledBatch {
    pub sender: Address,
    pub token: Address,
    pub payments: Vec<PaymentOp>,
    pub execute_after_ledger: u32,
    pub status: ScheduledBatchStatus,
}

/// Compressed batch status map: packs payment statuses (2 bits each) into u32 words.
/// Each u32 holds statuses for 16 payments. This reduces storage footprint from
/// O(N) individual keys to a single key per batch for status tracking.
#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchStatusMap {
    pub payment_count: u32,
    pub status_words: Vec<u32>,
}

/// A single skipped/failed entry reported by `execute_batch_partial`.
#[contracttype]
#[derive(Clone, Debug)]
pub struct FailureEntry {
    pub index: u32,
    pub amount: i128,
    pub reason: Symbol,
}

/// Extended result returned by `execute_batch_partial`.
#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchPartialResult {
    pub batch_id: u64,
    pub failures: Vec<FailureEntry>,
}

/// Configuration for automatic distribution account re-funding.
#[contracttype]
#[derive(Clone, Debug)]
pub struct RefundConfig {
    pub distribution_account: Address,
    pub funding_source: Address,
    pub token: Address,
    pub threshold: i128,
    pub refund_amount: i128,
}

#[contracttype]
pub enum DataKey {
    Admin,
    BatchCount,
    Batch(u64),
    Sequence,
    /// Per-account configurable limits
    AcctLimits(Address),
    /// Per-account rolling usage tracker
    AcctUsage(Address),
    /// Default limits applied to all accounts without overrides
    DefaultLimits,
    TotalBonusesPaid,
    /// Individual payment entry: (batch_id, payment_index)
    PaymentEntry(u64, u32),
    /// Emergency pause flag (circuit breaker)
    Paused,
    /// Tracks the last ledger sequence in which a batch was executed (per sender).
    LastBatchLedger(Address),
    /// Scheduled batch record
    ScheduledBatch(u64),
    /// Counter for scheduled batches
    ScheduledBatchCount,
    /// Configurable network throttling limits
    ThrottleConfig,
    /// Compressed batch status map for storage optimization (Issue #599)
    BatchStatusMap(u64),
    /// Auto-refund configuration for distribution accounts (Issue #600)
    RefundConfig,
}

const MAX_BATCH_SIZE: u32 = 100;
const MAX_THROTTLE_LEDGER_GAP: u32 = LEDGERS_PER_DAY;
const FEE_BUMP_MULTIPLIER: i128 = 2;
const BATCH_OPERATION_OVERHEAD: u32 = 1;
const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;
const TEMPORARY_TTL_THRESHOLD: u32 = 2_000;
const TEMPORARY_TTL_EXTEND_TO: u32 = 20_000;

const ARCHIVE_TTL_THRESHOLD: u32 = 5_000;
const ARCHIVE_TTL_EXTEND_TO: u32 = 50_000;

const BITS_PER_STATUS: u32 = 2;
const STATUSES_PER_WORD: u32 = 16;

// Approximate ledger counts for time windows.
// Stellar closes a ledger roughly every 5 seconds.
// Daily  ≈ 86_400 / 5 = 17_280
// Weekly ≈ 7 × 17_280 = 120_960
// Monthly ≈ 30 × 17_280 = 518_400
const LEDGERS_PER_DAY: u32 = 17_280;
const LEDGERS_PER_WEEK: u32 = 120_960;
const LEDGERS_PER_MONTH: u32 = 518_400;

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct BulkPaymentContract;

#[contractimpl]
impl BulkPaymentContract {
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

    /// Initializes the contract with an admin and default maintenance settings.
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::BatchCount, &0u64);
        env.storage().persistent().set(&DataKey::Sequence, &0u64);
        env.storage()
            .instance()
            .set(&DataKey::ThrottleConfig, &Self::default_throttle_config());
        Self::bump_core_ttl(&env);
        Ok(())
    }

    /// Transfers the admin role to `new_admin`.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        env.storage().persistent().set(&DataKey::Admin, &new_admin);
        Self::bump_core_ttl(&env);
        Ok(())
    }

    /// Extends TTL for critical contract state to reduce archival risk.
    pub fn bump_ttl(env: Env) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        Self::bump_core_ttl(&env);
        Ok(())
    }

    // ── Emergency pause (circuit breaker, Issue #265) ─────────────────────

    /// Pause or unpause the contract. When paused, all `execute_batch*`
    /// operations are rejected with `ContractPaused`. Administrative
    /// functions (set_admin, set_limits, bump_ttl) remain available.
    ///
    /// Only the current admin (multi-sig administrator) may call this.
    pub fn set_paused(env: Env, paused: bool) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        env.storage().persistent().extend_ttl(
            &DataKey::Admin,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &paused);

        env.events()
            .publish((symbol_short!("paused"),), (paused, admin.clone()));

        Ok(())
    }

    /// Returns `true` if the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    // ── Limit management (admin-only) ─────────────────────────────────────

    /// Set default limits applied to all accounts that don't have overrides.
    /// A cap of 0 means "unlimited" for that tier.
    pub fn set_default_limits(
        env: Env,
        daily: i128,
        weekly: i128,
        monthly: i128,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        Self::validate_limits(daily, weekly, monthly)?;

        let limits = AccountLimits {
            daily_limit: daily,
            weekly_limit: weekly,
            monthly_limit: monthly,
        };
        env.storage()
            .instance()
            .set(&DataKey::DefaultLimits, &limits);
        Ok(())
    }

    /// Override limits for a specific trusted account.
    /// A cap of 0 means "unlimited" for that tier.
    pub fn set_account_limits(
        env: Env,
        account: Address,
        daily: i128,
        weekly: i128,
        monthly: i128,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        Self::validate_limits(daily, weekly, monthly)?;

        let limits = AccountLimits {
            daily_limit: daily,
            weekly_limit: weekly,
            monthly_limit: monthly,
        };
        env.storage()
            .persistent()
            .set(&DataKey::AcctLimits(account.clone()), &limits);

        env.events().publish(
            (symbol_short!("limits"), account.clone()),
            (daily, weekly, monthly),
        );

        Ok(())
    }

    /// Remove per-account overrides so the account falls back to default limits.
    pub fn remove_account_limits(env: Env, account: Address) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        env.storage()
            .persistent()
            .remove(&DataKey::AcctLimits(account));
        Ok(())
    }

    /// Query the effective limits for an account (per-account override or defaults).
    pub fn get_account_limits(env: Env, account: Address) -> AccountLimits {
        Self::effective_limits(&env, &account)
    }

    /// Query the current usage counters for an account.
    pub fn get_account_usage(env: Env, account: Address) -> AccountUsage {
        Self::current_usage(&env, &account)
    }

    /// Sets global on-chain throttling for batch submissions.
    ///
    /// `max_batch_size` caps the number of payments per batch and may not exceed
    /// the protocol safety ceiling of 100. `min_ledger_gap` controls how many
    /// ledgers must separate two batches from the same sender.
    pub fn set_throttle_config(
        env: Env,
        max_batch_size: u32,
        min_ledger_gap: u32,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        Self::validate_throttle_config(max_batch_size, min_ledger_gap)?;

        let config = ThrottleConfig {
            max_batch_size,
            min_ledger_gap,
        };
        env.storage()
            .instance()
            .set(&DataKey::ThrottleConfig, &config);
        Ok(())
    }

    /// Returns the active throttling configuration.
    pub fn get_throttle_config(env: Env) -> ThrottleConfig {
        Self::throttle_config(&env)
    }

    // ── Auto-refund configuration (Issue #600) ────────────────────────────

    /// Configures automatic re-funding for a distribution account.
    /// When the distribution account's token balance drops below `threshold`,
    /// `check_and_refund` will transfer `refund_amount` from `funding_source`.
    pub fn set_refund_config(
        env: Env,
        distribution_account: Address,
        funding_source: Address,
        token: Address,
        threshold: i128,
        refund_amount: i128,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env)?;

        if threshold <= 0 || refund_amount <= 0 {
            return Err(ContractError::RefundThresholdInvalid);
        }

        let config = RefundConfig {
            distribution_account: distribution_account.clone(),
            funding_source: funding_source.clone(),
            token: token.clone(),
            threshold,
            refund_amount,
        };

        env.storage()
            .instance()
            .set(&DataKey::RefundConfig, &config);

        RefundConfigUpdatedEvent {
            distribution_account,
            funding_source,
            token,
            threshold,
            refund_amount,
        }
        .publish(&env);

        Ok(())
    }

    /// Returns the current auto-refund configuration, if set.
    pub fn get_refund_config(env: Env) -> Result<RefundConfig, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::RefundConfig)
            .ok_or(ContractError::RefundConfigNotSet)
    }

    /// Removes the auto-refund configuration.
    pub fn remove_refund_config(env: Env) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        env.storage().instance().remove(&DataKey::RefundConfig);
        Ok(())
    }

    /// Checks the distribution account balance and transfers `refund_amount`
    /// from the funding source if the balance is below the configured threshold.
    /// The funding source must authorize the transfer.
    ///
    /// Returns the amount transferred (0 if no refund was needed).
    pub fn check_and_refund(env: Env) -> Result<i128, ContractError> {
        Self::require_not_paused(&env)?;

        let config: RefundConfig = env
            .storage()
            .instance()
            .get(&DataKey::RefundConfig)
            .ok_or(ContractError::RefundConfigNotSet)?;

        let token_client = token::Client::new(&env, &config.token);
        let balance_before = token_client.balance(&config.distribution_account);

        if balance_before >= config.threshold {
            return Err(ContractError::RefundNotNeeded);
        }

        config.funding_source.require_auth();

        token_client.transfer(
            &config.funding_source,
            &config.distribution_account,
            &config.refund_amount,
        );

        let balance_after = token_client.balance(&config.distribution_account);

        AccountRefundedEvent {
            distribution_account: config.distribution_account,
            funding_source: config.funding_source,
            token: config.token,
            amount: config.refund_amount,
            balance_before,
            balance_after,
        }
        .publish(&env);

        Ok(config.refund_amount)
    }

    // ── Storage optimization (Issue #599) ────────────────────────────────

    /// Archives a batch's individual PaymentEntry records into a compressed
    /// status map. This reduces the storage footprint from N individual keys
    /// to a single key holding a bit-packed status vector.
    ///
    /// Call this after a batch is fully processed and all refunds are complete.
    /// Individual PaymentEntry keys are removed after archival.
    pub fn archive_batch_statuses(
        env: Env,
        batch_id: u64,
    ) -> Result<BatchStatusMap, ContractError> {
        Self::require_admin(&env)?;

        let batch: BatchRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Batch(batch_id))
            .ok_or(ContractError::BatchNotFound)?;

        let payment_count = batch.success_count + batch.fail_count;
        let word_count = (payment_count + STATUSES_PER_WORD - 1) / STATUSES_PER_WORD;
        let mut status_words: Vec<u32> = Vec::new(&env);

        for w in 0..word_count {
            let mut word: u32 = 0;
            for s in 0..STATUSES_PER_WORD {
                let idx = w * STATUSES_PER_WORD + s;
                if idx >= payment_count {
                    break;
                }
                let entry_key = DataKey::PaymentEntry(batch_id, idx);
                let status_bits: u32 = if let Some(entry) = env
                    .storage()
                    .temporary()
                    .get::<DataKey, PaymentEntry>(&entry_key)
                {
                    match entry.status {
                        PaymentStatus::Pending => 0,
                        PaymentStatus::Sent => 1,
                        PaymentStatus::Failed => 2,
                        PaymentStatus::Refunded => 3,
                    }
                } else {
                    0
                };
                word |= status_bits << (s * BITS_PER_STATUS);
                env.storage().temporary().remove(&entry_key);
            }
            status_words.push_back(word);
        }

        let map = BatchStatusMap {
            payment_count,
            status_words: status_words.clone(),
        };

        let key = DataKey::BatchStatusMap(batch_id);
        env.storage().persistent().set(&key, &map);
        env.storage().persistent().extend_ttl(
            &key,
            ARCHIVE_TTL_THRESHOLD,
            ARCHIVE_TTL_EXTEND_TO,
        );

        BatchArchivedEvent {
            batch_id,
            payment_count,
        }
        .publish(&env);

        Ok(map)
    }

    /// Reads a payment status from a compressed batch status map.
    /// Returns the PaymentStatus for the given payment index.
    pub fn get_archived_status(
        env: Env,
        batch_id: u64,
        payment_index: u32,
    ) -> Result<PaymentStatus, ContractError> {
        let key = DataKey::BatchStatusMap(batch_id);
        let map: BatchStatusMap = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ContractError::BatchNotFound)?;

        if payment_index >= map.payment_count {
            return Err(ContractError::PaymentNotFound);
        }

        let word_index = payment_index / STATUSES_PER_WORD;
        let bit_offset = (payment_index % STATUSES_PER_WORD) * BITS_PER_STATUS;
        let word = map.status_words.get(word_index).unwrap_or(0);
        let bits = (word >> bit_offset) & 0b11;

        let status = match bits {
            0 => PaymentStatus::Pending,
            1 => PaymentStatus::Sent,
            2 => PaymentStatus::Failed,
            3 => PaymentStatus::Refunded,
            _ => PaymentStatus::Pending,
        };

        Ok(status)
    }

    /// Returns the compressed batch status map for a given batch.
    pub fn get_batch_status_map(
        env: Env,
        batch_id: u64,
    ) -> Result<BatchStatusMap, ContractError> {
        let key = DataKey::BatchStatusMap(batch_id);
        env.storage()
            .persistent()
            .get(&key)
            .ok_or(ContractError::BatchNotFound)
    }

    /// Reduces TTL on old batch records to free storage sooner.
    /// Call periodically for batches older than the active window.
    pub fn reduce_batch_ttl(
        env: Env,
        batch_id: u64,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env)?;

        let key = DataKey::Batch(batch_id);
        if !env.storage().persistent().has(&key) {
            return Err(ContractError::BatchNotFound);
        }

        env.storage().persistent().extend_ttl(
            &key,
            ARCHIVE_TTL_THRESHOLD,
            ARCHIVE_TTL_EXTEND_TO,
        );

        Ok(())
    }

    /// Estimates the fee budget for a batch using an externally supplied
    /// current base fee from Horizon or transaction simulation.
    ///
    /// The contract cannot fetch Horizon data on-chain, so callers pass the
    /// observed base fee in stroops. The estimate includes one batch overhead
    /// operation plus one operation per payment.
    pub fn estimate_batch_fee(
        _env: Env,
        payment_count: u32,
        base_fee_stroops: i128,
        fee_bump_required: bool,
    ) -> Result<FeeEstimate, ContractError> {
        Self::validate_fee_inputs(payment_count, base_fee_stroops)?;

        let operation_count = payment_count
            .checked_add(BATCH_OPERATION_OVERHEAD)
            .ok_or(ContractError::AmountOverflow)?;
        let multiplier = if fee_bump_required {
            FEE_BUMP_MULTIPLIER
        } else {
            1
        };
        let recommended_fee_stroops = i128::from(operation_count)
            .checked_mul(base_fee_stroops)
            .and_then(|fee| fee.checked_mul(multiplier))
            .ok_or(ContractError::AmountOverflow)?;
        let budget_fee_stroops = recommended_fee_stroops
            .checked_mul(2)
            .ok_or(ContractError::AmountOverflow)?;

        Ok(FeeEstimate {
            payment_count,
            operation_count,
            base_fee_stroops,
            recommended_fee_stroops,
            budget_fee_stroops,
            fee_bump_required,
        })
    }

    // ── Batch execution ───────────────────────────────────────────────────

    /// Gas-optimized all-or-nothing batch payment.
    pub fn execute_batch(
        env: Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        expected_sequence: u64,
    ) -> Result<u64, ContractError> {
        Self::require_not_paused(&env)?;
        sender.require_auth();
        Self::require_unique_ledger(&env, &sender)?;
        Self::bump_core_ttl(&env);
        Self::check_and_advance_sequence(&env, expected_sequence)?;

        let len = payments.len();
        Self::validate_batch_len(&env, len)?;

        let mut total: i128 = 0;
        let mut success_count: u32 = 0;

        // Use a single loop to calculate total and validate (O(n))
        for op in payments.iter() {
            if op.amount <= 0 {
                return Err(ContractError::InvalidAmount);
            }
            total = total
                .checked_add(op.amount)
                .ok_or(ContractError::AmountOverflow)?;
            success_count += 1;
        }

        Self::check_limits(&env, &sender, total)?;

        let token_client = token::Client::new(&env, &token);
        let current_contract = env.current_contract_address();

        // Single transfer of total amount to escrow
        token_client.transfer(&sender, &current_contract, &total);

        let batch_id = Self::next_batch_id(&env);

        // Distribute from escrow to recipients (minimize event overhead)
        let mut payment_index: u32 = 0;
        for op in payments.iter() {
            token_client.transfer(&current_contract, &op.recipient, &op.amount);
            PaymentSentEvent {
                batch_id,
                payment_index,
                recipient: op.recipient.clone(),
                amount: op.amount,
                category: op.category,
            }
            .publish(&env);
            payment_index += 1;
        }

        Self::record_usage(&env, &sender, total);
        let record = BatchRecord {
            sender: sender.clone(),
            token: token.clone(),
            total_sent: total,
            success_count,
            fail_count: 0,
            status: soroban_sdk::symbol_short!("completed"),
        };

        // Use Persistent storage for historical records to keep Instance storage small
        let key = DataKey::Batch(batch_id);
        env.storage().persistent().set(&key, &record);

        // Extend TTL to ensure record is available for off-chain querying (1 year minimum suggested)
        // 500,000 ledgers is ~30 days, we could extend more if needed.
        env.storage()
            .persistent()
            .extend_ttl(&key, 100_000, 500_000);

        BatchExecutedEvent {
            batch_id,
            total_sent: total,
        }
        .publish(&env);

        // Emit analytics event for real-time indexing
        BatchAnalyticsEvent {
            batch_id,
            sender: sender.clone(),
            token: token.clone(),
            total_sent: total,
            payment_count: success_count,
            timestamp: env.ledger().timestamp(),
        }
        .publish(&env);

        Ok(batch_id)
    }

    /// Gas-optimized best-effort batch payment (legacy — no per-payment entries).
    pub fn execute_batch_partial(
        env: Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        expected_sequence: u64,
    ) -> Result<BatchPartialResult, ContractError> {
        Self::require_not_paused(&env)?;
        sender.require_auth();
        Self::require_unique_ledger(&env, &sender)?;
        Self::bump_core_ttl(&env);
        Self::check_and_advance_sequence(&env, expected_sequence)?;

        let len = payments.len();
        Self::validate_batch_len(&env, len)?;

        let mut total: i128 = 0;
        let mut success_count: u32 = 0;

        // Use a single loop to calculate total and validate (O(n))
        // This is more efficient than looping twice
        for op in payments.iter() {
            if op.amount <= 0 {
                // Invalid amount — skip it and mark fail
                continue;
            }
            total = total
                .checked_add(op.amount)
                .ok_or(ContractError::AmountOverflow)?;
            success_count += 1;
        }

        Self::check_limits(&env, &sender, total)?;

        let token_client = token::Client::new(&env, &token);
        let contract_addr = env.current_contract_address();
        token_client.transfer(&sender, &contract_addr, &total);
        let batch_id = Self::next_batch_id(&env);

        let mut remaining = total;
        let mut actual_success: u32 = 0;
        let mut fail_count: u32 = 0;
        let mut total_sent: i128 = 0;
        let mut failures: Vec<FailureEntry> = Vec::new(&env);

        let mut payment_index: u32 = 0;
        for op in payments.iter() {
            // Optimized: single pass for validation and distribution
            if op.amount <= 0 || remaining < op.amount {
                let reason = if op.amount <= 0 {
                    symbol_short!("bad_amt")
                } else {
                    symbol_short!("low_bal")
                };
                fail_count += 1;
                failures.push_back(FailureEntry {
                    index: payment_index,
                    amount: op.amount,
                    reason,
                });
                PaymentSkippedEvent {
                    batch_id,
                    payment_index,
                    recipient: op.recipient.clone(),
                    amount: op.amount,
                    category: op.category,
                }
                .publish(&env);
                payment_index += 1;
                continue;
            }
            token_client.transfer(&contract_addr, &op.recipient, &op.amount);
            remaining -= op.amount;
            total_sent += op.amount;
            actual_success += 1;
            PaymentSentEvent {
                batch_id,
                payment_index,
                recipient: op.recipient.clone(),
                amount: op.amount,
                category: op.category,
            }
            .publish(&env);
            payment_index += 1;
        }

        if remaining > 0 {
            token_client.transfer(&contract_addr, &sender, &remaining);
        }

        Self::record_usage(&env, &sender, total_sent);

        let status = if fail_count == 0 {
            symbol_short!("completed")
        } else if actual_success == 0 {
            symbol_short!("rollback")
        } else {
            symbol_short!("partial")
        };

        let record = BatchRecord {
            sender,
            token,
            total_sent,
            success_count,
            fail_count,
            status,
        };

        let key = DataKey::Batch(batch_id);
        env.storage().persistent().set(&key, &record);

        env.storage()
            .persistent()
            .extend_ttl(&key, 100_000, 500_000);

        BatchPartialEvent {
            batch_id,
            success_count,
            fail_count,
        }
        .publish(&env);
        Ok(BatchPartialResult { batch_id, failures })
    }

    // ── Graceful revert with refund (Issue #261) ──────────────────────────

    /// Unified batch entry point with a runtime `all_or_nothing` flag.
    ///
    /// This function serves as the primary entry point for batch payments, supporting
    /// two distinct modes of execution to balance strict atomicity with resilience.
    ///
    /// ### `all_or_nothing = true` (Strict Mode)
    /// - **Atomicity**: The entire batch succeeds or the entire call reverts.
    /// - **Validation**: Every payment amount is validated (must be > 0) before
    ///   any funds move.
    /// - **Transfer**: Funds move directly from `sender` to each `recipient`.
    /// - **Auditability**: On success, each payment is recorded as `Sent`.
    ///
    /// ### `all_or_nothing = false` (Resilient/Partial Mode)
    /// - **Best-effort**: Valid payments execute immediately; invalid ones are skipped.
    /// - **Escrow Mechanism**: Funds for the entire batch (sum of positive amounts)
    ///   are first pulled into the contract.
    /// - **State Tracking**:
    ///     - Successful transfers are marked `Sent`.
    ///     - Failed transfers (e.g. invalid amount) are marked `Failed`.
    /// - **Manual Recovery**: Funds associated with `Failed` entries remain in the
    ///   contract and must be retrieved using `refund_failed_payment`.
    ///
    /// In both modes, every individual payment generates a `PaymentEntry` for
    /// granular status querying via `get_payment_entry`.
    pub fn execute_batch_v2(
        env: Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        expected_sequence: u64,
        all_or_nothing: bool,
    ) -> Result<u64, ContractError> {
        Self::require_not_paused(&env)?;
        sender.require_auth();
        Self::require_unique_ledger(&env, &sender)?;
        Self::bump_core_ttl(&env);
        Self::check_and_advance_sequence(&env, expected_sequence)?;

        let len = payments.len();
        Self::validate_batch_len(&env, len)?;

        if all_or_nothing {
            Self::execute_strict(&env, sender, token, payments, len)
        } else {
            Self::execute_partial_with_refund(&env, sender, token, payments)
        }
    }

    /// Refund a single `Failed` payment from an `execute_batch_v2` partial
    /// batch back to the original batch sender.
    ///
    /// This function implements a secure recovery path for funds that were
    /// earmarked for a payment that failed validation.
    ///
    /// ### Security Model
    /// - **Fixed Destination**: Funds are *always* returned to `BatchRecord.sender`.
    /// - **No Authorization Required**: Since the destination is fixed to the
    ///   original funder, anyone can trigger the refund (e.g. a maintenance bot)
    ///   without risking fund diversion.
    ///
    /// ### State Transition
    /// `Failed` → `Refunded` (Prevents double-refunding).
    ///
    /// ### Errors
    /// | Code | Meaning |
    /// |------|---------|
    /// | `BatchNotFound`      | `batch_id` does not exist (or TTL expired). |
    /// | `PaymentNotFound`    | `payment_index` has no entry for this batch. |
    /// | `RefundNotAvailable` | Payment status is not `Failed` (e.g. `Sent` or `Pending`). |
    /// | `AlreadyRefunded`    | Refund was already issued for this payment. |
    pub fn refund_failed_payment(
        env: Env,
        batch_id: u64,
        payment_index: u32,
    ) -> Result<(), ContractError> {
        // Resolve sender and token from the batch record.
        let batch_key = DataKey::Batch(batch_id);
        let batch: BatchRecord = env
            .storage()
            .persistent()
            .get(&batch_key)
            .ok_or(ContractError::BatchNotFound)?;

        // Load the individual payment entry.
        let entry_key = DataKey::PaymentEntry(batch_id, payment_index);
        let mut entry: PaymentEntry = env
            .storage()
            .temporary()
            .get(&entry_key)
            .ok_or(ContractError::PaymentNotFound)?;

        // Guard: status must be Failed — Refunded and Sent/Pending are errors.
        match entry.status {
            PaymentStatus::Failed => {} // proceed
            PaymentStatus::Refunded => return Err(ContractError::AlreadyRefunded),
            _ => return Err(ContractError::RefundNotAvailable),
        }

        // Return the held funds to the original sender.
        let token_client = token::Client::new(&env, &batch.token);
        token_client.transfer(
            &env.current_contract_address(),
            &batch.sender,
            &entry.amount,
        );

        // Transition status to Refunded and persist.
        entry.status = PaymentStatus::Refunded;
        env.storage().temporary().set(&entry_key, &entry);
        env.storage().temporary().extend_ttl(
            &entry_key,
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );

        env.events().publish(
            (symbol_short!("refund"), batch_id, payment_index),
            (batch.sender.clone(), entry.amount),
        );

        Ok(())
    }

    // ── Scheduled batch execution (Issue #187 / Part 42) ─────────────────

    /// Schedules a batch payment to be executed no earlier than
    /// `execute_after_ledger`. Funds are pulled from the sender at schedule
    /// time and held by the contract until execution or cancellation.
    ///
    /// ### Security
    /// - Only the sender can cancel the scheduled batch and reclaim held funds.
    /// - Execution is open to anyone once the ledger condition is met (e.g. a
    ///   keeper or the sender themselves), ensuring liveness.
    pub fn schedule_batch(
        env: Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        execute_after_ledger: u32,
    ) -> Result<u64, ContractError> {
        Self::require_not_paused(&env)?;
        sender.require_auth();
        Self::bump_core_ttl(&env);

        let len = payments.len();
        Self::validate_batch_len(&env, len)?;

        let mut total: i128 = 0;
        for op in payments.iter() {
            if op.amount <= 0 {
                return Err(ContractError::InvalidAmount);
            }
            total = total
                .checked_add(op.amount)
                .ok_or(ContractError::AmountOverflow)?;
        }

        Self::check_limits(&env, &sender, total)?;

        // Pull funds into the contract now so execution requires no sender auth later
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &total);

        let count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::ScheduledBatchCount)
            .unwrap_or(0)
            + 1;
        env.storage()
            .persistent()
            .set(&DataKey::ScheduledBatchCount, &count);
        env.storage().persistent().extend_ttl(
            &DataKey::ScheduledBatchCount,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        let scheduled = ScheduledBatch {
            sender: sender.clone(),
            token,
            payments,
            execute_after_ledger,
            status: ScheduledBatchStatus::Pending,
        };

        let key = DataKey::ScheduledBatch(count);
        env.storage().persistent().set(&key, &scheduled);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        BatchScheduledEvent {
            scheduled_id: count,
            sender,
            execute_after_ledger,
        }
        .publish(&env);
        Ok(count)
    }

    /// Executes a previously scheduled batch once the target ledger has been
    /// reached. Funds were already pulled at schedule time and are distributed
    /// from the contract's balance. Open to any caller once the ledger condition
    /// is satisfied.
    pub fn execute_scheduled_batch(env: Env, scheduled_id: u64) -> Result<u64, ContractError> {
        Self::require_not_paused(&env)?;
        Self::bump_core_ttl(&env);

        let key = DataKey::ScheduledBatch(scheduled_id);
        let mut scheduled: ScheduledBatch = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ContractError::ScheduledBatchNotFound)?;

        if scheduled.status != ScheduledBatchStatus::Pending {
            return Err(ContractError::ScheduledBatchConsumed);
        }

        let current_ledger = env.ledger().sequence();
        if current_ledger < scheduled.execute_after_ledger {
            return Err(ContractError::ScheduledBatchNotReady);
        }

        let mut total: i128 = 0;
        for op in scheduled.payments.iter() {
            total = total
                .checked_add(op.amount)
                .ok_or(ContractError::AmountOverflow)?;
        }

        let token_client = token::Client::new(&env, &scheduled.token);
        let contract_addr = env.current_contract_address();

        // Funds are already held by the contract — distribute to recipients
        for op in scheduled.payments.iter() {
            token_client.transfer(&contract_addr, &op.recipient, &op.amount);
        }

        Self::record_usage(&env, &scheduled.sender, total);

        let batch_id = Self::next_batch_id(&env);
        let success_count = scheduled.payments.len();
        env.storage().persistent().set(
            &DataKey::Batch(batch_id),
            &BatchRecord {
                sender: scheduled.sender.clone(),
                token: scheduled.token.clone(),
                total_sent: total,
                success_count,
                fail_count: 0,
                status: symbol_short!("completed"),
            },
        );
        env.storage().persistent().extend_ttl(
            &DataKey::Batch(batch_id),
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        // Mark scheduled batch as executed
        scheduled.status = ScheduledBatchStatus::Executed;
        env.storage().persistent().set(&key, &scheduled);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        ScheduledBatchExecutedEvent {
            scheduled_id,
            batch_id,
            total_sent: total,
        }
        .publish(&env);
        Ok(batch_id)
    }

    /// Cancels a pending scheduled batch and returns held funds to the original
    /// sender. Only the original sender may cancel.
    pub fn cancel_scheduled_batch(
        env: Env,
        sender: Address,
        scheduled_id: u64,
    ) -> Result<(), ContractError> {
        sender.require_auth();

        let key = DataKey::ScheduledBatch(scheduled_id);
        let mut scheduled: ScheduledBatch = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ContractError::ScheduledBatchNotFound)?;

        if scheduled.status != ScheduledBatchStatus::Pending {
            return Err(ContractError::ScheduledBatchConsumed);
        }
        if scheduled.sender != sender {
            return Err(ContractError::ScheduledBatchUnauthorized);
        }

        // Return held funds to sender
        let mut total: i128 = 0;
        for op in scheduled.payments.iter() {
            total = total
                .checked_add(op.amount)
                .ok_or(ContractError::AmountOverflow)?;
        }
        let token_client = token::Client::new(&env, &scheduled.token);
        token_client.transfer(&env.current_contract_address(), &sender, &total);

        scheduled.status = ScheduledBatchStatus::Cancelled;
        env.storage().persistent().set(&key, &scheduled);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        ScheduledBatchCancelledEvent {
            scheduled_id,
            sender,
        }
        .publish(&env);
        Ok(())
    }

    /// Returns a scheduled batch record by ID.
    pub fn get_scheduled_batch(
        env: Env,
        scheduled_id: u64,
    ) -> Result<ScheduledBatch, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::ScheduledBatch(scheduled_id))
            .ok_or(ContractError::ScheduledBatchNotFound)
    }

    /// Query the status and details of a single payment within a batch.
    pub fn get_payment_entry(
        env: Env,
        batch_id: u64,
        payment_index: u32,
    ) -> Result<PaymentEntry, ContractError> {
        let key = DataKey::PaymentEntry(batch_id, payment_index);
        let entry: PaymentEntry = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(ContractError::PaymentNotFound)?;
        // Reading state should not modify TTL; extend only on write
        Ok(entry)
    }

    // ── Read-only accessors ───────────────────────────────────────────────

    pub fn get_sequence(env: Env) -> u64 {
        let key = DataKey::Sequence;
        if let Some(value) = env.storage().persistent().get(&key) {
            // Reading state should not modify TTL; extend only on write
            value
        } else {
            0
        }
    }

    pub fn get_batch(env: Env, batch_id: u64) -> Result<BatchRecord, ContractError> {
        let key = DataKey::Batch(batch_id);
        let record = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ContractError::BatchNotFound)?;

        // Reading state should not modify TTL; extend only on write
        Ok(record)
    }

    pub fn get_batch_count(env: Env) -> u64 {
        let key = DataKey::BatchCount;
        if let Some(value) = env.storage().persistent().get(&key) {
            // Reading state should not modify TTL; extend only on write
            value
        } else {
            0
        }
    }

    /// Returns the ledger sequence of the last batch executed by a given sender.
    pub fn get_last_batch_ledger(env: Env, sender: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::LastBatchLedger(sender))
            .unwrap_or(0)
    }

    // ── Private helpers ───────────────────────────────────────────────────

    /// All-or-nothing path used by `execute_batch_v2(all_or_nothing = true)`.
    ///
    /// Validates every amount before touching funds. Transfers directly
    /// sender → recipient (N calls). Writes every `PaymentEntry` as `Sent`.
    fn execute_strict(
        env: &Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        len: u32,
    ) -> Result<u64, ContractError> {
        let mut total: i128 = 0;
        for op in payments.iter() {
            if op.amount <= 0 {
                return Err(ContractError::InvalidAmount);
            }
            total = total
                .checked_add(op.amount)
                .ok_or(ContractError::AmountOverflow)?;
        }

        Self::check_limits(env, &sender, total)?;

        let token_client = token::Client::new(env, &token);
        for op in payments.iter() {
            token_client.transfer(&sender, &op.recipient, &op.amount);
        }

        Self::record_usage(env, &sender, total);

        let batch_id = Self::next_batch_id(env);
        env.storage().persistent().set(
            &DataKey::Batch(batch_id),
            &BatchRecord {
                sender: sender.clone(),
                token: token.clone(),
                total_sent: total,
                success_count: len,
                fail_count: 0,
                status: symbol_short!("completed"),
            },
        );
        env.storage().persistent().extend_ttl(
            &DataKey::Batch(batch_id),
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        for (index, op) in payments.iter().enumerate() {
            Self::write_payment_entry(env, batch_id, index as u32, &op, PaymentStatus::Sent);

            if op.category == symbol_short!("bonus") {
                let mut tb: i128 = env
                    .storage()
                    .instance()
                    .get(&DataKey::TotalBonusesPaid)
                    .unwrap_or(0);
                tb = tb
                    .checked_add(op.amount)
                    .ok_or(ContractError::AmountOverflow)?;
                env.storage()
                    .instance()
                    .set(&DataKey::TotalBonusesPaid, &tb);
                env.events().publish(
                    (
                        symbol_short!("bonus"),
                        op.category.clone(),
                        op.recipient.clone(),
                    ),
                    op.amount,
                );
            } else {
                env.events()
                    .publish((symbol_short!("payment"), op.recipient.clone()), op.amount);
            }
        }

        Ok(batch_id)
    }

    /// Partial-success path used by `execute_batch_v2(all_or_nothing = false)`.
    ///
    /// ### Logic Flow
    /// 1. **Escrow Initialization**: Calculates the sum of all positive amounts and
    ///    transfers that total from `sender` to the contract address.
    /// 2. **Execution Loop**: Iterates through payments:
    ///    - If `amount > 0`: Transfers from contract to `recipient`, marks as `Sent`.
    ///    - If `amount <= 0`: Marks as `Failed`. Proportional funds remain in contract.
    /// 3. **Dust/Residual Handling**: Any remaining funds (due to calculation
    ///    discrepancies or explicit skips) are held for manual refund.
    fn execute_partial_with_refund(
        env: &Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
    ) -> Result<u64, ContractError> {
        // Sum only valid amounts — these are the funds we pull from the sender.
        let mut total: i128 = 0;
        for op in payments.iter() {
            if op.amount > 0 {
                total = total
                    .checked_add(op.amount)
                    .ok_or(ContractError::AmountOverflow)?;
            }
        }

        Self::check_limits(env, &sender, total)?;

        let token_client = token::Client::new(env, &token);
        let contract_addr = env.current_contract_address();
        token_client.transfer(&sender, &contract_addr, &total);

        let mut remaining = total;
        let mut success_count = 0u32;
        let mut fail_count = 0u32;
        let mut total_sent = 0i128;
        // Funds earmarked for deferred refund — kept in contract, not returned
        // immediately.  Under normal accounting this is 0 because invalid
        // amounts were excluded from `total`; the defensive branch below guards
        // against any future accounting divergence.
        let mut held_for_refund = 0i128;

        // Allocate the batch_id before the loop so PaymentEntry keys can
        // reference it.  The BatchRecord itself is written after the loop.
        let batch_id = Self::next_batch_id(env);

        for (index, op) in payments.iter().enumerate() {
            let idx = index as u32;

            if op.amount <= 0 {
                // Invalid amount — nothing was pulled for this entry (the
                // pre-pass excluded it), so we record it as Failed with 0
                // held funds.
                fail_count += 1;
                Self::write_payment_entry(env, batch_id, idx, &op, PaymentStatus::Failed);
                env.events()
                    .publish((symbol_short!("skipped"), op.recipient.clone()), op.amount);
                continue;
            }

            if remaining < op.amount {
                // Defensive path: should not fire under normal accounting but
                // guards future logic changes.  The amount was already pulled
                // so we hold it for a deferred refund rather than losing it.
                fail_count += 1;
                held_for_refund = held_for_refund
                    .checked_add(op.amount)
                    .ok_or(ContractError::AmountOverflow)?;
                Self::write_payment_entry(env, batch_id, idx, &op, PaymentStatus::Failed);
                env.events()
                    .publish((symbol_short!("skipped"), op.recipient.clone()), op.amount);
                continue;
            }

            // Valid — transfer contract → recipient.
            token_client.transfer(&contract_addr, &op.recipient, &op.amount);
            remaining -= op.amount;
            total_sent += op.amount;
            success_count += 1;

            Self::write_payment_entry(env, batch_id, idx, &op, PaymentStatus::Sent);
            env.events()
                .publish((symbol_short!("payment"), op.recipient.clone()), op.amount);

            if op.category == symbol_short!("bonus") {
                let mut tb: i128 = env
                    .storage()
                    .instance()
                    .get(&DataKey::TotalBonusesPaid)
                    .unwrap_or(0);
                tb = tb
                    .checked_add(op.amount)
                    .ok_or(ContractError::AmountOverflow)?;
                env.storage()
                    .instance()
                    .set(&DataKey::TotalBonusesPaid, &tb);
                env.events().publish(
                    (
                        symbol_short!("bonus"),
                        op.category.clone(),
                        op.recipient.clone(),
                    ),
                    op.amount,
                );
            }
        }

        // Return any residual that is NOT held for deferred refund immediately.
        let immediate_refund = remaining.saturating_sub(held_for_refund);
        if immediate_refund > 0 {
            token_client.transfer(&contract_addr, &sender, &immediate_refund);
        }

        Self::record_usage(env, &sender, total_sent);

        let status = if fail_count == 0 {
            symbol_short!("completed")
        } else if success_count == 0 {
            symbol_short!("rollback")
        } else {
            symbol_short!("partial")
        };

        env.storage().persistent().set(
            &DataKey::Batch(batch_id),
            &BatchRecord {
                sender: sender.clone(),
                token: token.clone(),
                total_sent,
                success_count,
                fail_count,
                status,
            },
        );
        env.storage().persistent().extend_ttl(
            &DataKey::Batch(batch_id),
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        env.events().publish(
            (symbol_short!("batch"), symbol_short!("v2part")),
            (batch_id, success_count, fail_count),
        );

        Ok(batch_id)
    }

    /// Write a `PaymentEntry` to temporary storage.  Shared by both execution
    /// paths so TTL and key construction are consistent.
    fn write_payment_entry(
        env: &Env,
        batch_id: u64,
        payment_index: u32,
        op: &PaymentOp,
        status: PaymentStatus,
    ) {
        let key = DataKey::PaymentEntry(batch_id, payment_index);
        env.storage().temporary().set(
            &key,
            &PaymentEntry {
                recipient: op.recipient.clone(),
                amount: op.amount,
                category: op.category.clone(),
                status,
            },
        );
        env.storage().temporary().extend_ttl(
            &key,
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );
    }

    fn require_admin(env: &Env) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        env.storage().persistent().extend_ttl(
            &DataKey::Admin,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        admin.require_auth();
        Ok(())
    }

    /// Returns `ContractPaused` if the circuit breaker is engaged.
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

    fn check_and_advance_sequence(env: &Env, expected: u64) -> Result<(), ContractError> {
        let current: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::Sequence)
            .ok_or(ContractError::NotInitialized)?;
        if current != expected {
            return Err(ContractError::SequenceMismatch);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Sequence, &(current + 1));
        env.storage().persistent().extend_ttl(
            &DataKey::Sequence,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        Ok(())
    }

    fn next_batch_id(env: &Env) -> u64 {
        let count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::BatchCount)
            .unwrap_or(0)
            + 1;
        env.storage().persistent().set(&DataKey::BatchCount, &count);
        env.storage().persistent().extend_ttl(
            &DataKey::BatchCount,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        count
    }

    fn validate_limits(daily: i128, weekly: i128, monthly: i128) -> Result<(), ContractError> {
        if daily < 0 || weekly < 0 || monthly < 0 {
            return Err(ContractError::InvalidLimitConfig);
        }
        Ok(())
    }

    fn default_throttle_config() -> ThrottleConfig {
        ThrottleConfig {
            max_batch_size: MAX_BATCH_SIZE,
            min_ledger_gap: 0,
        }
    }

    fn throttle_config(env: &Env) -> ThrottleConfig {
        env.storage()
            .instance()
            .get(&DataKey::ThrottleConfig)
            .unwrap_or_else(Self::default_throttle_config)
    }

    fn validate_throttle_config(
        max_batch_size: u32,
        min_ledger_gap: u32,
    ) -> Result<(), ContractError> {
        if max_batch_size == 0
            || max_batch_size > MAX_BATCH_SIZE
            || min_ledger_gap > MAX_THROTTLE_LEDGER_GAP
        {
            return Err(ContractError::InvalidThrottleConfig);
        }
        Ok(())
    }

    fn validate_batch_len(env: &Env, len: u32) -> Result<(), ContractError> {
        if len == 0 {
            return Err(ContractError::EmptyBatch);
        }
        if len > Self::throttle_config(env).max_batch_size {
            return Err(ContractError::BatchTooLarge);
        }
        Ok(())
    }

    fn validate_fee_inputs(
        payment_count: u32,
        base_fee_stroops: i128,
    ) -> Result<(), ContractError> {
        if payment_count == 0 || payment_count > MAX_BATCH_SIZE || base_fee_stroops <= 0 {
            return Err(ContractError::InvalidFeeConfig);
        }
        Ok(())
    }

    fn effective_limits(env: &Env, account: &Address) -> AccountLimits {
        if let Some(limits) = env
            .storage()
            .persistent()
            .get::<DataKey, AccountLimits>(&DataKey::AcctLimits(account.clone()))
        {
            return limits;
        }
        if let Some(limits) = env
            .storage()
            .instance()
            .get::<DataKey, AccountLimits>(&DataKey::DefaultLimits)
        {
            return limits;
        }
        AccountLimits {
            daily_limit: 0,
            weekly_limit: 0,
            monthly_limit: 0,
        }
    }

    fn current_usage(env: &Env, account: &Address) -> AccountUsage {
        let ledger = env.ledger().sequence();
        let mut usage: AccountUsage = env
            .storage()
            .persistent()
            .get(&DataKey::AcctUsage(account.clone()))
            .unwrap_or(AccountUsage {
                daily_spent: 0,
                daily_reset_ledger: ledger,
                weekly_spent: 0,
                weekly_reset_ledger: ledger,
                monthly_spent: 0,
                monthly_reset_ledger: ledger,
            });

        if ledger >= usage.daily_reset_ledger + LEDGERS_PER_DAY {
            usage.daily_spent = 0;
            usage.daily_reset_ledger = ledger;
        }
        if ledger >= usage.weekly_reset_ledger + LEDGERS_PER_WEEK {
            usage.weekly_spent = 0;
            usage.weekly_reset_ledger = ledger;
        }
        if ledger >= usage.monthly_reset_ledger + LEDGERS_PER_MONTH {
            usage.monthly_spent = 0;
            usage.monthly_reset_ledger = ledger;
        }

        usage
    }

    fn check_limits(env: &Env, account: &Address, amount: i128) -> Result<(), ContractError> {
        let limits = Self::effective_limits(env, account);
        let usage = Self::current_usage(env, account);

        if limits.daily_limit > 0 {
            let projected = usage.daily_spent + amount;
            if projected > limits.daily_limit {
                env.events().publish(
                    (symbol_short!("blocked"), account.clone()),
                    (
                        amount,
                        LimitTier::Daily,
                        usage.daily_spent,
                        limits.daily_limit,
                    ),
                );
                return Err(ContractError::DailyLimitExceeded);
            }
        }
        if limits.weekly_limit > 0 {
            let projected = usage.weekly_spent + amount;
            if projected > limits.weekly_limit {
                env.events().publish(
                    (symbol_short!("blocked"), account.clone()),
                    (
                        amount,
                        LimitTier::Weekly,
                        usage.weekly_spent,
                        limits.weekly_limit,
                    ),
                );
                return Err(ContractError::WeeklyLimitExceeded);
            }
        }
        if limits.monthly_limit > 0 {
            let projected = usage.monthly_spent + amount;
            if projected > limits.monthly_limit {
                env.events().publish(
                    (symbol_short!("blocked"), account.clone()),
                    (
                        amount,
                        LimitTier::Monthly,
                        usage.monthly_spent,
                        limits.monthly_limit,
                    ),
                );
                return Err(ContractError::MonthlyLimitExceeded);
            }
        }

        Ok(())
    }

    fn record_usage(env: &Env, account: &Address, amount: i128) {
        let mut usage = Self::current_usage(env, account);
        usage.daily_spent = usage.daily_spent.saturating_add(amount);
        usage.weekly_spent = usage.weekly_spent.saturating_add(amount);
        usage.monthly_spent = usage.monthly_spent.saturating_add(amount);
        env.storage()
            .persistent()
            .set(&DataKey::AcctUsage(account.clone()), &usage);
    }

    fn bump_core_ttl(env: &Env) {
        for key in [DataKey::Admin, DataKey::BatchCount, DataKey::Sequence] {
            if env.storage().persistent().has(&key) {
                env.storage().persistent().extend_ttl(
                    &key,
                    PERSISTENT_TTL_THRESHOLD,
                    PERSISTENT_TTL_EXTEND_TO,
                );
            }
        }
    }

    /// Ensures the sender has not already executed a batch in the current
    /// ledger sequence, preventing replay attacks.
    fn require_unique_ledger(env: &Env, sender: &Address) -> Result<(), ContractError> {
        let current_ledger = env.ledger().sequence();
        let key = DataKey::LastBatchLedger(sender.clone());
        let last_ledger: u32 = env.storage().persistent().get(&key).unwrap_or(0);
        if last_ledger == current_ledger && current_ledger != 0 {
            return Err(ContractError::LedgerReplayDetected);
        }
        let min_gap = Self::throttle_config(env).min_ledger_gap;
        if current_ledger != 0 && last_ledger != 0 && min_gap > 0 {
            let earliest_allowed = last_ledger.saturating_add(min_gap);
            if current_ledger < earliest_allowed {
                return Err(ContractError::ThrottleLimitExceeded);
            }
        }
        env.storage().persistent().set(&key, &current_ledger);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        Ok(())
    }
}

#[cfg(test)]
mod test;
