#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, contractevent,
    Address, Env, Vec, token, symbol_short, Symbol,
};

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized   = 1,
    NotInitialized       = 2,
    Unauthorized         = 3,
    EmptyBatch           = 4,
    BatchTooLarge        = 5,
    InvalidAmount        = 6,
    AmountOverflow       = 7,
    SequenceMismatch     = 8,
    BatchNotFound        = 9,
    DailyLimitExceeded   = 10,
    WeeklyLimitExceeded  = 11,
    MonthlyLimitExceeded = 12,
    InvalidLimitConfig   = 13,
    /// Payment is not in a Failed state, so no refund is available.
    RefundNotAvailable   = 14,
    /// Payment has already been refunded; cannot refund twice.
    AlreadyRefunded      = 15,
    /// No PaymentEntry found for the given (batch_id, payment_index).
    PaymentNotFound      = 16,
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
    pub recipient: Address,
    pub amount: i128,
}

#[contractevent]
pub struct PaymentSkippedEvent {
    pub recipient: Address,
    pub amount: i128,
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
    pub batch_id:      u64,
    pub payment_index: u32,
    pub sender:        Address,
    pub amount:        i128,
}

// ── Storage types ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentOp {
    pub recipient: Address,
    pub amount: i128,
    pub category: Symbol,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
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

/// Tier identifier used in events.
#[contracttype]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum LimitTier {
    Daily   = 0,
    Weekly  = 1,
    Monthly = 2,
}

/// Per-payment lifecycle status used by `execute_batch_v2`.
///
/// State machine:
///   Pending → Sent     (payment executed successfully in partial mode)
///   Pending → Failed   (payment skipped; funds held in contract for refund)
///   Failed  → Refunded (`refund_failed_payment` called successfully)
///
/// In `all_or_nothing = true` mode all entries are written directly as `Sent`
/// (the function reverts before writing anything if any amount is invalid).
#[contracttype]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum PaymentStatus {
    Pending  = 0,
    Sent     = 1,
    Failed   = 2,
    Refunded = 3,
}

/// Individual payment record stored per `(batch_id, payment_index)`.
/// Enables per-payment status queries and targeted manual refunds.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PaymentEntry {
    pub recipient: Address,
    pub amount:    i128,
    pub category:  Symbol,
    pub status:    PaymentStatus,
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
    /// Configurable maximum batch size (defaults to MAX_BATCH_SIZE if not set)
    MaxBatchSize,
}

const MAX_BATCH_SIZE: u32 = 100;
const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;
const TEMPORARY_TTL_THRESHOLD: u32 = 2_000;
const TEMPORARY_TTL_EXTEND_TO: u32 = 20_000;

// Approximate ledger counts for time windows.
// Stellar closes a ledger roughly every 5 seconds.
// Daily  ≈ 86_400 / 5 = 17_280
// Weekly ≈ 7 × 17_280 = 120_960
// Monthly ≈ 30 × 17_280 = 518_400
const LEDGERS_PER_DAY: u32   = 17_280;
const LEDGERS_PER_WEEK: u32  = 120_960;
const LEDGERS_PER_MONTH: u32 = 518_400;

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct BulkPaymentContract;

#[contractimpl]
impl BulkPaymentContract {
    /// Returns the contract version as (major, minor, patch).
    pub fn version() -> (u32, u32, u32) {
        (1, 0, 0)
    }

    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::BatchCount, &0u64);
        env.storage().persistent().set(&DataKey::Sequence, &0u64);
        Self::bump_core_ttl(&env);
        Ok(())
    }

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

    /// Set the maximum batch size ceiling (admin-only).
    /// This ceiling is independent of the hard-coded 100-payment limit.
    /// If not set, defaults to MAX_BATCH_SIZE (100).
    /// Cannot be set higher than MAX_BATCH_SIZE.
    pub fn set_max_batch_size(env: Env, max_size: u32) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        if max_size == 0 || max_size > MAX_BATCH_SIZE {
            return Err(ContractError::InvalidLimitConfig);
        }
        env.storage().instance().set(&DataKey::MaxBatchSize, &max_size);
        Ok(())
    }

    /// Get the current maximum batch size ceiling.
    pub fn get_max_batch_size(env: Env) -> u32 {
        env.storage().instance()
            .get(&DataKey::MaxBatchSize)
            .unwrap_or(MAX_BATCH_SIZE)
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
        env.storage().instance().set(&DataKey::DefaultLimits, &limits);
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
        env.storage().persistent().set(&DataKey::AcctLimits(account.clone()), &limits);

        env.events().publish(
            (symbol_short!("limits"), account.clone()),
            (daily, weekly, monthly),
        );

        Ok(())
    }

    /// Remove per-account overrides so the account falls back to default limits.
    pub fn remove_account_limits(env: Env, account: Address) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        env.storage().persistent().remove(&DataKey::AcctLimits(account));
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

    // ── Batch execution ───────────────────────────────────────────────────

    /// Gas-optimized all-or-nothing batch payment.
    pub fn execute_batch(
        env: Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        expected_sequence: u64,
    ) -> Result<u64, ContractError> {
        sender.require_auth();
        Self::bump_core_ttl(&env);
        Self::check_and_advance_sequence(&env, expected_sequence)?;

        let max_size = Self::get_max_batch_size(env.clone());
        let len = payments.len();
        if len == 0 { return Err(ContractError::EmptyBatch); }
        if len > max_size { return Err(ContractError::BatchTooLarge); }

        let mut total: i128 = 0;
        for op in payments.iter() {
            if op.amount <= 0 { return Err(ContractError::InvalidAmount); }
            total = total.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
        }

        Self::check_limits(&env, &sender, total)?;

        let token_client = token::Client::new(&env, &token);
        for op in payments.iter() {
            token_client.transfer(&sender, &op.recipient, &op.amount);
        }

        Self::record_usage(&env, &sender, total);

        let batch_id = Self::next_batch_id(&env);
        env.storage().temporary().set(&DataKey::Batch(batch_id), &BatchRecord {
            sender, token,
            total_sent: total, success_count: len, fail_count: 0,
            status: symbol_short!("completed"),
        });
        env.storage().temporary().extend_ttl(
            &DataKey::Batch(batch_id), TEMPORARY_TTL_THRESHOLD, TEMPORARY_TTL_EXTEND_TO,
        );

        for op in payments.iter() {
            if op.category == symbol_short!("bonus") {
                let mut total_bonuses: i128 = env.storage().instance()
                    .get(&DataKey::TotalBonusesPaid).unwrap_or(0);
                total_bonuses = total_bonuses.checked_add(op.amount)
                    .ok_or(ContractError::AmountOverflow)?;
                env.storage().instance().set(&DataKey::TotalBonusesPaid, &total_bonuses);
                env.events().publish(
                    (symbol_short!("bonus"), op.category.clone(), op.recipient.clone()),
                    op.amount,
                );
            } else {
                env.events().publish((symbol_short!("payment"), op.recipient.clone()), op.amount);
            }
        }

        Ok(batch_id)
    }

    /// Gas-optimized best-effort batch payment (legacy — no per-payment entries).
    pub fn execute_batch_partial(
        env: Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        expected_sequence: u64,
    ) -> Result<u64, ContractError> {
        sender.require_auth();
        Self::bump_core_ttl(&env);
        Self::check_and_advance_sequence(&env, expected_sequence)?;

        let max_size = Self::get_max_batch_size(env.clone());
        let len = payments.len();
        if len == 0 { return Err(ContractError::EmptyBatch); }
        if len > max_size { return Err(ContractError::BatchTooLarge); }

        let mut total: i128 = 0;
        for op in payments.iter() {
            if op.amount > 0 {
                total = total.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
            }
        }

        Self::check_limits(&env, &sender, total)?;

        let token_client = token::Client::new(&env, &token);
        let contract_addr = env.current_contract_address();
        token_client.transfer(&sender, &contract_addr, &total);

        let mut remaining = total;
        let mut success_count: u32 = 0;
        let mut fail_count: u32 = 0;
        let mut total_sent: i128 = 0;

        for op in payments.iter() {
            if op.amount <= 0 || remaining < op.amount {
                fail_count += 1;
                env.events().publish((symbol_short!("skipped"), op.recipient.clone()), op.amount);
                continue;
            }
            token_client.transfer(&contract_addr, &op.recipient, &op.amount);
            remaining -= op.amount;
            total_sent += op.amount;
            success_count += 1;
            env.events().publish((symbol_short!("payment"), op.recipient.clone()), op.amount);

            if op.category == symbol_short!("bonus") {
                let mut total_bonuses: i128 = env.storage().instance()
                    .get(&DataKey::TotalBonusesPaid).unwrap_or(0);
                total_bonuses = total_bonuses.checked_add(op.amount)
                    .ok_or(ContractError::AmountOverflow)?;
                env.storage().instance().set(&DataKey::TotalBonusesPaid, &total_bonuses);
                env.events().publish(
                    (symbol_short!("bonus"), op.category.clone(), op.recipient.clone()),
                    op.amount,
                );
            }
        }

        if remaining > 0 {
            token_client.transfer(&contract_addr, &sender, &remaining);
        }

        Self::record_usage(&env, &sender, total_sent);

        let status = if fail_count == 0 { symbol_short!("completed") }
                     else if success_count == 0 { symbol_short!("rollbck") }
                     else { symbol_short!("partial") };

        let batch_id = Self::next_batch_id(&env);
        env.storage().temporary().set(&DataKey::Batch(batch_id), &BatchRecord {
            sender, token, total_sent, success_count, fail_count, status,
        });
        env.storage().temporary().extend_ttl(
            &DataKey::Batch(batch_id), TEMPORARY_TTL_THRESHOLD, TEMPORARY_TTL_EXTEND_TO,
        );

        env.events().publish(
            (symbol_short!("batch"), symbol_short!("partial")),
            (batch_id, success_count, fail_count),
        );

        Ok(batch_id)
    }

    // ── Graceful revert with refund (Issue #261) ──────────────────────────

    /// Unified batch entry point with a runtime `all_or_nothing` flag.
    ///
    /// ### `all_or_nothing = true`  
    /// Identical semantics to `execute_batch`: every amount is validated before
    /// any funds move. Any invalid amount reverts the entire call. On success,
    /// each payment is recorded as `PaymentStatus::Sent` for auditability.
    ///
    /// ### `all_or_nothing = false`  
    /// Partial-success mode with per-payment state tracking and a manual refund
    /// path:
    /// - Valid payments execute immediately (contract → recipient).
    /// - Invalid payments (`amount ≤ 0`) are recorded as `PaymentStatus::Failed`
    ///   and their proportional funds are **held inside the contract**.
    /// - The caller — or anyone on their behalf — may later call
    ///   `refund_failed_payment(batch_id, payment_index)` to return held funds
    ///   to the original sender.
    ///
    /// In both modes every payment gets a `PaymentEntry` that can be queried
    /// with `get_payment_entry`.
    pub fn execute_batch_v2(
        env: Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        expected_sequence: u64,
        all_or_nothing: bool,
    ) -> Result<u64, ContractError> {
        sender.require_auth();
        Self::bump_core_ttl(&env);
        Self::check_and_advance_sequence(&env, expected_sequence)?;

        let max_size = Self::get_max_batch_size(env.clone());
        let len = payments.len();
        if len == 0 { return Err(ContractError::EmptyBatch); }
        if len > max_size { return Err(ContractError::BatchTooLarge); }

        if all_or_nothing {
            Self::execute_strict(&env, sender, token, payments, len)
        } else {
            Self::execute_partial_with_refund(&env, sender, token, payments)
        }
    }

    /// Refund a single `Failed` payment from an `execute_batch_v2` partial
    /// batch back to the original batch sender.
    ///
    /// The refund destination is always `BatchRecord.sender`; the caller
    /// cannot redirect it, so no additional `require_auth` is needed.
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
        let batch: BatchRecord = env.storage().temporary().get(&batch_key)
            .ok_or(ContractError::BatchNotFound)?;

        // Load the individual payment entry.
        let entry_key = DataKey::PaymentEntry(batch_id, payment_index);
        let mut entry: PaymentEntry = env.storage().temporary().get(&entry_key)
            .ok_or(ContractError::PaymentNotFound)?;

        // Guard: status must be Failed — Refunded and Sent/Pending are errors.
        match entry.status {
            PaymentStatus::Failed   => {} // proceed
            PaymentStatus::Refunded => return Err(ContractError::AlreadyRefunded),
            _                       => return Err(ContractError::RefundNotAvailable),
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
            &entry_key, TEMPORARY_TTL_THRESHOLD, TEMPORARY_TTL_EXTEND_TO,
        );

        env.events().publish(
            (symbol_short!("refund"), batch_id, payment_index),
            (batch.sender.clone(), entry.amount),
        );

        Ok(())
    }

    /// Query the status and details of a single payment within a batch.
    pub fn get_payment_entry(
        env: Env,
        batch_id: u64,
        payment_index: u32,
    ) -> Result<PaymentEntry, ContractError> {
        let key = DataKey::PaymentEntry(batch_id, payment_index);
        let entry: PaymentEntry = env.storage().temporary().get(&key)
            .ok_or(ContractError::PaymentNotFound)?;
        env.storage().temporary().extend_ttl(
            &key, TEMPORARY_TTL_THRESHOLD, TEMPORARY_TTL_EXTEND_TO,
        );
        Ok(entry)
    }

    // ── Read-only accessors ───────────────────────────────────────────────

    pub fn get_sequence(env: Env) -> u64 {
        let key = DataKey::Sequence;
        if let Some(value) = env.storage().persistent().get(&key) {
            env.storage().persistent().extend_ttl(
                &key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO,
            );
            value
        } else { 0 }
    }

    pub fn get_batch(env: Env, batch_id: u64) -> Result<BatchRecord, ContractError> {
        let key = DataKey::Batch(batch_id);
        let record = env.storage().temporary().get(&key)
            .ok_or(ContractError::BatchNotFound)?;
        env.storage().temporary().extend_ttl(
            &key, TEMPORARY_TTL_THRESHOLD, TEMPORARY_TTL_EXTEND_TO,
        );
        Ok(record)
    }

    pub fn get_batch_count(env: Env) -> u64 {
        let key = DataKey::BatchCount;
        if let Some(value) = env.storage().persistent().get(&key) {
            env.storage().persistent().extend_ttl(
                &key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO,
            );
            value
        } else { 0 }
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
            if op.amount <= 0 { return Err(ContractError::InvalidAmount); }
            total = total.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
        }

        Self::check_limits(env, &sender, total)?;

        let token_client = token::Client::new(env, &token);
        for op in payments.iter() {
            token_client.transfer(&sender, &op.recipient, &op.amount);
        }

        Self::record_usage(env, &sender, total);

        let batch_id = Self::next_batch_id(env);
        env.storage().temporary().set(&DataKey::Batch(batch_id), &BatchRecord {
            sender: sender.clone(),
            token:  token.clone(),
            total_sent:    total,
            success_count: len,
            fail_count:    0,
            status:        symbol_short!("completed"),
        });
        env.storage().temporary().extend_ttl(
            &DataKey::Batch(batch_id), TEMPORARY_TTL_THRESHOLD, TEMPORARY_TTL_EXTEND_TO,
        );

        for (index, op) in payments.iter().enumerate() {
            Self::write_payment_entry(env, batch_id, index as u32, &op, PaymentStatus::Sent);

            if op.category == symbol_short!("bonus") {
                let mut tb: i128 = env.storage().instance()
                    .get(&DataKey::TotalBonusesPaid).unwrap_or(0);
                tb = tb.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
                env.storage().instance().set(&DataKey::TotalBonusesPaid, &tb);
                env.events().publish(
                    (symbol_short!("bonus"), op.category.clone(), op.recipient.clone()),
                    op.amount,
                );
            } else {
                env.events().publish(
                    (symbol_short!("payment"), op.recipient.clone()), op.amount,
                );
            }
        }

        Ok(batch_id)
    }

    /// Partial-success path used by `execute_batch_v2(all_or_nothing = false)`.
    ///
    /// Pulls only the sum of positive amounts into the contract. Valid payments
    /// transfer immediately. Payments with `amount ≤ 0` are recorded as
    /// `PaymentStatus::Failed` and their funds remain in the contract for
    /// later retrieval via `refund_failed_payment`.
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
                total = total.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
            }
        }

        Self::check_limits(env, &sender, total)?;

        let token_client = token::Client::new(env, &token);
        let contract_addr = env.current_contract_address();
        token_client.transfer(&sender, &contract_addr, &total);

        let mut remaining      = total;
        let mut success_count  = 0u32;
        let mut fail_count     = 0u32;
        let mut total_sent     = 0i128;
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
                env.events().publish(
                    (symbol_short!("skipped"), op.recipient.clone()), op.amount,
                );
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
                env.events().publish(
                    (symbol_short!("skipped"), op.recipient.clone()), op.amount,
                );
                continue;
            }

            // Valid — transfer contract → recipient.
            token_client.transfer(&contract_addr, &op.recipient, &op.amount);
            remaining  -= op.amount;
            total_sent += op.amount;
            success_count += 1;

            Self::write_payment_entry(env, batch_id, idx, &op, PaymentStatus::Sent);
            env.events().publish(
                (symbol_short!("payment"), op.recipient.clone()), op.amount,
            );

            if op.category == symbol_short!("bonus") {
                let mut tb: i128 = env.storage().instance()
                    .get(&DataKey::TotalBonusesPaid).unwrap_or(0);
                tb = tb.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
                env.storage().instance().set(&DataKey::TotalBonusesPaid, &tb);
                env.events().publish(
                    (symbol_short!("bonus"), op.category.clone(), op.recipient.clone()),
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

        let status = if fail_count == 0      { symbol_short!("completed") }
                     else if success_count == 0 { symbol_short!("rollbck") }
                     else                       { symbol_short!("partial") };

        env.storage().temporary().set(&DataKey::Batch(batch_id), &BatchRecord {
            sender: sender.clone(),
            token:  token.clone(),
            total_sent,
            success_count,
            fail_count,
            status,
        });
        env.storage().temporary().extend_ttl(
            &DataKey::Batch(batch_id), TEMPORARY_TTL_THRESHOLD, TEMPORARY_TTL_EXTEND_TO,
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
        env.storage().temporary().set(&key, &PaymentEntry {
            recipient: op.recipient.clone(),
            amount:    op.amount,
            category:  op.category.clone(),
            status,
        });
        env.storage().temporary().extend_ttl(
            &key, TEMPORARY_TTL_THRESHOLD, TEMPORARY_TTL_EXTEND_TO,
        );
    }

    fn require_admin(env: &Env) -> Result<(), ContractError> {
        let admin: Address = env.storage().persistent().get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        env.storage().persistent().extend_ttl(
            &DataKey::Admin, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO,
        );
        admin.require_auth();
        Ok(())
    }

    fn check_and_advance_sequence(env: &Env, expected: u64) -> Result<(), ContractError> {
        let current: u64 = env.storage().persistent().get(&DataKey::Sequence)
            .ok_or(ContractError::NotInitialized)?;
        if current != expected { return Err(ContractError::SequenceMismatch); }
        env.storage().persistent().set(&DataKey::Sequence, &(current + 1));
        env.storage().persistent().extend_ttl(
            &DataKey::Sequence, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO,
        );
        Ok(())
    }

    fn next_batch_id(env: &Env) -> u64 {
        let count: u64 = env.storage().persistent()
            .get(&DataKey::BatchCount).unwrap_or(0) + 1;
        env.storage().persistent().set(&DataKey::BatchCount, &count);
        env.storage().persistent().extend_ttl(
            &DataKey::BatchCount, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO,
        );
        count
    }

    fn validate_limits(daily: i128, weekly: i128, monthly: i128) -> Result<(), ContractError> {
        if daily < 0 || weekly < 0 || monthly < 0 {
            return Err(ContractError::InvalidLimitConfig);
        }
        Ok(())
    }

    fn effective_limits(env: &Env, account: &Address) -> AccountLimits {
        if let Some(limits) = env.storage().persistent()
            .get::<DataKey, AccountLimits>(&DataKey::AcctLimits(account.clone()))
        {
            return limits;
        }
        if let Some(limits) = env.storage().instance()
            .get::<DataKey, AccountLimits>(&DataKey::DefaultLimits)
        {
            return limits;
        }
        AccountLimits { daily_limit: 0, weekly_limit: 0, monthly_limit: 0 }
    }

    fn current_usage(env: &Env, account: &Address) -> AccountUsage {
        let ledger = env.ledger().sequence();
        let mut usage: AccountUsage = env.storage().persistent()
            .get(&DataKey::AcctUsage(account.clone()))
            .unwrap_or(AccountUsage {
                daily_spent: 0,   daily_reset_ledger: ledger,
                weekly_spent: 0,  weekly_reset_ledger: ledger,
                monthly_spent: 0, monthly_reset_ledger: ledger,
            });

        if ledger >= usage.daily_reset_ledger   + LEDGERS_PER_DAY   { usage.daily_spent = 0;   usage.daily_reset_ledger = ledger; }
        if ledger >= usage.weekly_reset_ledger  + LEDGERS_PER_WEEK  { usage.weekly_spent = 0;  usage.weekly_reset_ledger = ledger; }
        if ledger >= usage.monthly_reset_ledger + LEDGERS_PER_MONTH { usage.monthly_spent = 0; usage.monthly_reset_ledger = ledger; }

        usage
    }

    fn check_limits(env: &Env, account: &Address, amount: i128) -> Result<(), ContractError> {
        let limits = Self::effective_limits(env, account);
        let usage  = Self::current_usage(env, account);

        if limits.daily_limit > 0 {
            let projected = usage.daily_spent + amount;
            if projected > limits.daily_limit {
                env.events().publish(
                    (symbol_short!("blocked"), account.clone()),
                    (amount, LimitTier::Daily, usage.daily_spent, limits.daily_limit),
                );
                return Err(ContractError::DailyLimitExceeded);
            }
        }
        if limits.weekly_limit > 0 {
            let projected = usage.weekly_spent + amount;
            if projected > limits.weekly_limit {
                env.events().publish(
                    (symbol_short!("blocked"), account.clone()),
                    (amount, LimitTier::Weekly, usage.weekly_spent, limits.weekly_limit),
                );
                return Err(ContractError::WeeklyLimitExceeded);
            }
        }
        if limits.monthly_limit > 0 {
            let projected = usage.monthly_spent + amount;
            if projected > limits.monthly_limit {
                env.events().publish(
                    (symbol_short!("blocked"), account.clone()),
                    (amount, LimitTier::Monthly, usage.monthly_spent, limits.monthly_limit),
                );
                return Err(ContractError::MonthlyLimitExceeded);
            }
        }

        Ok(())
    }

    fn record_usage(env: &Env, account: &Address, amount: i128) {
        let mut usage = Self::current_usage(env, account);
        usage.daily_spent   += amount;
        usage.weekly_spent  += amount;
        usage.monthly_spent += amount;
        env.storage().persistent().set(&DataKey::AcctUsage(account.clone()), &usage);
    }

    fn bump_core_ttl(env: &Env) {
        for key in [DataKey::Admin, DataKey::BatchCount, DataKey::Sequence] {
            if env.storage().persistent().has(&key) {
                env.storage().persistent().extend_ttl(
                    &key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO,
                );
            }
        }
    }
}

#[cfg(test)]
mod test;