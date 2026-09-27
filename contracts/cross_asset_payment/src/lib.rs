#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol, token};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Payment(u64),
    PaymentCount,
}

const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;
const TEMPORARY_TTL_THRESHOLD: u32 = 2_000;
const TEMPORARY_TTL_EXTEND_TO: u32 = 20_000;

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PaymentRecord {
    pub from: Address,
    pub amount: i128,
    pub asset: Address,
    pub receiver_id: String,
    pub target_asset: String,
    pub anchor_id: String,
    pub status: Symbol, // e.g. "pending", "completed", "failed"
}

#[contract]
pub struct CrossAssetPaymentContract;

#[contractimpl]
impl CrossAssetPaymentContract {
    /// Returns the contract version as (major, minor, patch).
    pub fn version() -> (u32, u32, u32) {
        (1, 0, 0)
    }

    /// Initialize the contract with an admin.
    pub fn init(env: Env, admin: Address) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::PaymentCount, &0u64);
        Self::bump_core_ttl(&env);
    }

    /// Extends TTL for critical config/counter keys.
    pub fn bump_ttl(env: Env) {
        Self::require_admin(&env);
        Self::bump_core_ttl(&env);
    }

    /// Initiate a cross-asset payment.
    pub fn initiate_payment(
        env: Env,
        from: Address,
        amount: i128,
        asset: Address,
        receiver_id: String,
        target_asset: String,
        anchor_id: String,
    ) -> u64 {
        from.require_auth();

        // Transfer funds from sender to this contract (escrow)
        let token_client = token::Client::new(&env, &asset);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        // Increment payment counter
        Self::bump_core_ttl(&env);
        let mut count: u64 = env.storage().persistent().get(&DataKey::PaymentCount).unwrap_or(0);
        count += 1;
        env.storage().persistent().set(&DataKey::PaymentCount, &count);
        env.storage().persistent().extend_ttl(
            &DataKey::PaymentCount,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        // Store the payment record
        let record = PaymentRecord {
            from,
            amount,
            asset,
            receiver_id,
            target_asset,
            anchor_id,
            status: symbol_short!("pending"),
        };

        let payment_key = DataKey::Payment(count);
        env.storage().temporary().set(&payment_key, &record);
        env.storage().temporary().extend_ttl(
            &payment_key,
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );

        // Emit an event for backend/anchor tracking
        env.events().publish(
            (symbol_short!("pay_init"), count),
            record,
        );

        count
    }

    /// Update the status of a payment (Admin or Anchor authorized).
    pub fn update_status(env: Env, payment_id: u64, new_status: Symbol) {
        Self::require_admin(&env);

        let key = DataKey::Payment(payment_id);
        let mut record: PaymentRecord = env.storage().temporary()
            .get(&DataKey::Payment(payment_id))
            .expect("Payment not found or archived");

        record.status = new_status.clone();
        env.storage().temporary().set(&key, &record);
        env.storage().temporary().extend_ttl(
            &key,
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );

        env.events().publish(
            (symbol_short!("pay_upd"), payment_id),
            new_status,
        );
    }

    /// Get details of a payment.
    pub fn get_payment(env: Env, payment_id: u64) -> Option<PaymentRecord> {
        let key = DataKey::Payment(payment_id);
        let record: Option<PaymentRecord> = env.storage().temporary().get(&key);
        if record.is_some() {
            env.storage().temporary().extend_ttl(
                &key,
                TEMPORARY_TTL_THRESHOLD,
                TEMPORARY_TTL_EXTEND_TO,
            );
        }
        record
    }

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

    fn require_admin(env: &Env) {
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).expect("Admin entry unavailable; restore and retry");
        env.storage().persistent().extend_ttl(
            &DataKey::Admin,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        admin.require_auth();
    }

    fn bump_core_ttl(env: &Env) {
        for key in [DataKey::Admin, DataKey::PaymentCount] {
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
