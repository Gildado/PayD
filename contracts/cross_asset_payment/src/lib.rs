#![no_std]

use soroban_sdk::{
    Address, Env, String, Symbol, contract, contracterror, contractevent, contractimpl,
    contracttype, symbol_short, token,
};

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum CrossAssetPaymentError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    EmptyRoutingFields = 5,
    PaymentNotFound = 6,
    PaymentNotPending = 7,
    InvalidStatusTransition = 8,
    AdminMismatch = 9,
    LedgerReplayDetected = 10,
    ContractPaused = 11,
}

/// Emitted when the current admin proposes a new admin (two-step transfer).
#[contractevent]
pub struct AdminTransferProposedEvent {
    pub current_admin: Address,
    pub proposed_admin: Address,
}

/// Emitted when the proposed admin accepts the transfer and becomes the new admin.
#[contractevent]
pub struct AdminTransferAcceptedEvent {
    pub old_admin: Address,
    pub new_admin: Address,
}

/// Emitted when the current admin cancels a pending admin transfer.
#[contractevent]
pub struct AdminTransferCancelledEvent {
    pub admin: Address,
}

// ── Events ────────────────────────────────────────────────────────────────────

#[contractevent]
pub struct PaymentInitiatedEvent {
    #[topic]
    pub payment_id: u64,
    pub from: Address,
    pub amount: i128,
}

#[contractevent]
pub struct PaymentStatusUpdatedEvent {
    #[topic]
    pub payment_id: u64,
    pub new_status: Symbol,
}

#[contractevent]
pub struct EscrowReleasedEvent {
    #[topic]
    pub payment_id: u64,
    pub recipient: Address,
    pub amount: i128,
}

#[contractevent]
pub struct EscrowRefundedEvent {
    #[topic]
    pub payment_id: u64,
    pub sender: Address,
    pub amount: i128,
}

/// Emitted when the contract is paused or unpaused (circuit breaker).
#[contractevent]
pub struct ContractStatusChangedEvent {
    pub paused: bool,
    pub admin: Address,
}

// ── Storage types ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Payment(u64),
    PaymentCount,
    /// Tracks the last ledger sequence in which a payment was initiated (per sender).
    LastPaymentLedger(Address),
    /// Proposed next admin awaiting acceptance (two-step admin transfer).
    PendingAdmin,
    Paused,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct PaymentRecord {
    pub from: Address,
    pub amount: i128,
    pub asset: Address,
    pub receiver_id: String,
    pub target_asset: String,
    pub anchor_id: String,
    pub status: Symbol,
}

const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;
const PAYMENT_TTL_THRESHOLD: u32 = 100_000;
const PAYMENT_TTL_EXTEND_TO: u32 = 1_500_000;

#[contract]
pub struct CrossAssetPaymentContract;

#[contractimpl]
impl CrossAssetPaymentContract {
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

    /// Initializes the contract with an admin and resets the payment counter.
    pub fn init(env: Env, admin: Address) -> Result<(), CrossAssetPaymentError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(CrossAssetPaymentError::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::PaymentCount, &0u64);
        Self::bump_core_ttl(&env);
        Ok(())
    }

    /// Extends TTL for critical config and counter keys.
    pub fn bump_ttl(env: Env) {
        Self::require_admin(&env);
        Self::bump_core_ttl(&env);
    }

    // ── Two-step admin transfer (Issue #192 / Part 47) ────────────────────

    /// Proposes a new admin address. The current admin must authorize this call.
    ///
    /// The proposed admin must then call `accept_admin_transfer` to complete
    /// the handoff. Only one pending transfer can exist at a time; calling this
    /// again replaces the previous proposal.
    pub fn propose_admin_transfer(env: Env, new_admin: Address) {
        let current_admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        current_admin.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::PendingAdmin, &new_admin);
        env.storage().persistent().extend_ttl(
            &DataKey::PendingAdmin,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        AdminTransferProposedEvent {
            current_admin,
            proposed_admin: new_admin,
        }
        .publish(&env);
    }

    /// Accepts the pending admin transfer. Must be called by the proposed admin.
    ///
    /// On success the caller becomes the new admin and the pending proposal is
    /// cleared, completing the two-step handoff.
    pub fn accept_admin_transfer(env: Env, new_admin: Address) {
        let pending: Address = env
            .storage()
            .persistent()
            .get(&DataKey::PendingAdmin)
            .expect("No pending admin transfer");

        if pending != new_admin {
            panic!("Caller is not the proposed admin");
        }

        new_admin.require_auth();

        let old_admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");

        env.storage().persistent().set(&DataKey::Admin, &new_admin);
        env.storage().persistent().remove(&DataKey::PendingAdmin);
        Self::bump_core_ttl(&env);

        AdminTransferAcceptedEvent {
            old_admin,
            new_admin,
        }
        .publish(&env);
    }

    /// Cancels the pending admin transfer proposal. Only the current admin may call this.
    pub fn cancel_admin_transfer(env: Env) {
        let current_admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        current_admin.require_auth();

        env.storage().persistent().remove(&DataKey::PendingAdmin);

        AdminTransferCancelledEvent {
            admin: current_admin,
        }
        .publish(&env);
    }

    /// Returns the pending admin address if a transfer has been proposed, or `None`.
    pub fn get_pending_admin(env: Env) -> Option<Address> {
        env.storage().persistent().get(&DataKey::PendingAdmin)
    }

    /// Pauses or unpauses the contract (admin-only circuit breaker).
    ///
    /// When paused, all payment operations (`initiate_payment`,
    /// `update_status`, `complete_payment`, `fail_payment`) are
    /// rejected with `ContractPaused`. Administrative and read-only
    /// functions remain available.
    pub fn set_paused(env: Env, paused: bool) -> Result<(), CrossAssetPaymentError> {
        Self::require_admin(&env);
        let key = DataKey::Paused;
        env.storage().persistent().set(&key, &paused);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        ContractStatusChangedEvent {
            paused,
            admin,
        }
        .publish(&env);
        Ok(())
    }

    /// Returns whether the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    /// Initiates a cross-asset payment and escrows the source asset in the contract.
    pub fn initiate_payment(
        env: Env,
        from: Address,
        amount: i128,
        asset: Address,
        receiver_id: String,
        target_asset: String,
        anchor_id: String,
    ) -> Result<u64, CrossAssetPaymentError> {
        Self::require_not_paused(&env)?;
        if amount <= 0 {
            return Err(CrossAssetPaymentError::InvalidAmount);
        }
        if receiver_id.is_empty() || target_asset.is_empty() || anchor_id.is_empty() {
            return Err(CrossAssetPaymentError::EmptyRoutingFields);
        }

        from.require_auth();
        Self::require_unique_ledger(&env, &from)?;

        let token_client = token::Client::new(&env, &asset);
        token_client.transfer(&from, env.current_contract_address(), &amount);

        let payment_id = Self::increment_payment_count(&env);

        let record = PaymentRecord {
            from,
            amount,
            asset,
            receiver_id,
            target_asset,
            anchor_id,
            status: symbol_short!("pending"),
        };

        Self::store_payment(&env, payment_id, &record);
        PaymentInitiatedEvent {
            payment_id,
            from: record.from.clone(),
            amount: record.amount,
        }
        .publish(&env);

        Ok(payment_id)
    }

    /// Updates the stored status for a payment record (admin only).
    ///
    /// Enforces state machine rules:
    /// - `pending` may transition to `process`, `complete`, or `failed`.
    /// - `process` may transition to `complete` or `failed`.
    /// - `complete` and `failed` are terminal — no further transitions allowed.
    pub fn update_status(
        env: Env,
        payment_id: u64,
        new_status: Symbol,
    ) -> Result<(), CrossAssetPaymentError> {
        Self::require_not_paused(&env)?;
        Self::require_admin(&env);

        let mut record = Self::load_payment(&env, payment_id)?;
        Self::validate_status_transition(&record.status, &new_status)?;

        record.status = new_status.clone();
        Self::store_payment(&env, payment_id, &record);

        PaymentStatusUpdatedEvent {
            payment_id,
            new_status,
        }
        .publish(&env);
        Ok(())
    }

    /// Completes a pending payment and releases escrowed funds to the recipient.
    pub fn complete_payment(
        env: Env,
        admin: Address,
        payment_id: u64,
        recipient: Address,
    ) -> Result<(), CrossAssetPaymentError> {
        Self::require_not_paused(&env)?;
        Self::require_matching_admin(&env, &admin)?;

        let mut record = Self::load_payment(&env, payment_id)?;
        Self::require_pending_status(&record)?;

        let token_client = token::Client::new(&env, &record.asset);
        token_client.transfer(&env.current_contract_address(), &recipient, &record.amount);

        record.status = symbol_short!("complete");
        Self::store_payment(&env, payment_id, &record);

        PaymentStatusUpdatedEvent {
            payment_id,
            new_status: symbol_short!("complete"),
        }
        .publish(&env);
        EscrowReleasedEvent {
            payment_id,
            recipient,
            amount: record.amount,
        }
        .publish(&env);
        Ok(())
    }

    /// Marks a pending payment as failed and refunds escrowed funds to the sender.
    pub fn fail_payment(
        env: Env,
        admin: Address,
        payment_id: u64,
    ) -> Result<(), CrossAssetPaymentError> {
        Self::require_not_paused(&env)?;
        Self::require_matching_admin(&env, &admin)?;

        let mut record = Self::load_payment(&env, payment_id)?;
        Self::require_pending_status(&record)?;

        let token_client = token::Client::new(&env, &record.asset);
        token_client.transfer(
            &env.current_contract_address(),
            &record.from,
            &record.amount,
        );

        record.status = symbol_short!("failed");
        Self::store_payment(&env, payment_id, &record);

        PaymentStatusUpdatedEvent {
            payment_id,
            new_status: symbol_short!("failed"),
        }
        .publish(&env);
        EscrowRefundedEvent {
            payment_id,
            sender: record.from,
            amount: record.amount,
        }
        .publish(&env);
        Ok(())
    }

    /// Returns the stored payment details when present.
    pub fn get_payment(env: Env, payment_id: u64) -> Option<PaymentRecord> {
        let key = DataKey::Payment(payment_id);
        let record = env.storage().persistent().get(&key);
        if record.is_some() {
            env.storage().persistent().extend_ttl(
                &key,
                PAYMENT_TTL_THRESHOLD,
                PAYMENT_TTL_EXTEND_TO,
            );
        }
        record
    }

    /// Returns the total number of payments created by this contract.
    pub fn get_payment_count(env: Env) -> u64 {
        let key = DataKey::PaymentCount;
        let count = env.storage().persistent().get(&key).unwrap_or(0);
        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
        }
        count
    }

    /// Returns the last ledger in which the sender initiated a payment.
    pub fn get_last_payment_ledger(env: Env, sender: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::LastPaymentLedger(sender))
            .unwrap_or(0)
    }

    // ── Private helpers ───────────────────────────────────────────────────

    fn increment_payment_count(env: &Env) -> u64 {
        Self::bump_core_ttl(env);
        let mut count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::PaymentCount)
            .unwrap_or(0);
        count += 1;
        env.storage()
            .persistent()
            .set(&DataKey::PaymentCount, &count);
        env.storage().persistent().extend_ttl(
            &DataKey::PaymentCount,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        count
    }

    fn load_payment(env: &Env, payment_id: u64) -> Result<PaymentRecord, CrossAssetPaymentError> {
        let key = DataKey::Payment(payment_id);
        let record: Option<PaymentRecord> = env.storage().persistent().get(&key);
        let record = record.ok_or(CrossAssetPaymentError::PaymentNotFound)?;
        env.storage()
            .persistent()
            .extend_ttl(&key, PAYMENT_TTL_THRESHOLD, PAYMENT_TTL_EXTEND_TO);
        Ok(record)
    }

    fn store_payment(env: &Env, payment_id: u64, record: &PaymentRecord) {
        let key = DataKey::Payment(payment_id);
        env.storage().persistent().set(&key, record);
        env.storage()
            .persistent()
            .extend_ttl(&key, PAYMENT_TTL_THRESHOLD, PAYMENT_TTL_EXTEND_TO);
    }

    fn require_pending_status(record: &PaymentRecord) -> Result<(), CrossAssetPaymentError> {
        if record.status != symbol_short!("pending") {
            return Err(CrossAssetPaymentError::PaymentNotPending);
        }
        Ok(())
    }

    /// Validates that a status transition is allowed by the state machine.
    ///
    /// Allowed transitions:
    /// - `pending` → `process`, `complete`, `failed`
    /// - `process` → `complete`, `failed`
    /// - `complete` and `failed` are terminal (no further transitions).
    fn validate_status_transition(
        current: &Symbol,
        new: &Symbol,
    ) -> Result<(), CrossAssetPaymentError> {
        let pending = symbol_short!("pending");
        let process = symbol_short!("process");
        let complete = symbol_short!("complete");
        let failed = symbol_short!("failed");

        // Terminal states cannot transition further
        if *current == complete || *current == failed {
            return Err(CrossAssetPaymentError::InvalidStatusTransition);
        }

        // pending can go to process, complete, or failed
        if *current == pending {
            if *new == process || *new == complete || *new == failed {
                return Ok(());
            }
            return Err(CrossAssetPaymentError::InvalidStatusTransition);
        }

        // process can go to complete or failed
        if *current == process {
            if *new == complete || *new == failed {
                return Ok(());
            }
            return Err(CrossAssetPaymentError::InvalidStatusTransition);
        }

        // Unknown current status — reject
        Err(CrossAssetPaymentError::InvalidStatusTransition)
    }

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        admin.require_auth();
    }

    /// Returns `ContractPaused` if the circuit breaker is engaged.
    fn require_not_paused(env: &Env) -> Result<(), CrossAssetPaymentError> {
        if env
            .storage()
            .persistent()
            .get(&DataKey::Paused)
            .unwrap_or(false)
        {
            return Err(CrossAssetPaymentError::ContractPaused);
        }
        Ok(())
    }

    fn require_matching_admin(env: &Env, admin: &Address) -> Result<(), CrossAssetPaymentError> {
        let stored_admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(CrossAssetPaymentError::NotInitialized)?;
        if stored_admin != *admin {
            return Err(CrossAssetPaymentError::AdminMismatch);
        }
        admin.require_auth();
        Ok(())
    }

    fn require_unique_ledger(env: &Env, sender: &Address) -> Result<(), CrossAssetPaymentError> {
        let current_ledger = env.ledger().sequence();
        let key = DataKey::LastPaymentLedger(sender.clone());
        let last_ledger: u32 = env.storage().persistent().get(&key).unwrap_or(0);
        if last_ledger == current_ledger && current_ledger != 0 {
            return Err(CrossAssetPaymentError::LedgerReplayDetected);
        }
        env.storage().persistent().set(&key, &current_ledger);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        Ok(())
    }

    fn bump_core_ttl(env: &Env) {
        for key in [DataKey::Admin, DataKey::PaymentCount, DataKey::Paused] {
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

mod test;

#[cfg(test)]
mod test_escrow;
