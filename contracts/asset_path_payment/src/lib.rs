#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, contractevent,
    Address, Env, String, Symbol, Vec, symbol_short, token, Bytes
};

/// Errors for path payment operations
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum PathPaymentError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InsufficientBalance = 4,
    InvalidAmount = 5,
    PathNotFound = 6,
    SlippageExceeded = 7,
    NoLiquidity = 8,
    PaymentNotFound = 9,
    PaymentNotPending = 10,
    InvalidPath = 11,
    PriceImpactTooHigh = 12,
    TransferFailed = 13,
}

/// Storage keys
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PaymentCount,
    Payment(u64),
}

/// Path hop representing intermediate asset in path payment
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PathHop {
    pub asset: Address,
    pub pool_id: Option<Bytes>,
}

/// Payment record for tracking path payments
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PathPaymentRecord {
    pub from: Address,
    pub to: Address,
    pub source_asset: Address,
    pub dest_asset: Address,
    pub source_amount: i128,
    pub dest_min_amount: i128,
    pub maximum_source_amount: i128,
    pub actual_dest_amount: Option<i128>,
    pub actual_source_amount: Option<i128>,
    pub path: Vec<Address>,
    pub status: Symbol,
    pub error_message: Option<String>,
    pub partial_failure: bool,
}

/// Event emitted when a path payment is initiated
#[contractevent]
pub struct PathPaymentInitiated {
    pub payment_id: u64,
    pub from: Address,
    pub to: Address,
    pub source_asset: Address,
    pub dest_asset: Address,
    pub source_amount: i128,
    pub dest_min_amount: i128,
}

/// Event emitted when a path payment completes
#[contractevent]
pub struct PathPaymentCompleted {
    pub payment_id: u64,
    pub actual_source_amount: i128,
    pub actual_dest_amount: i128,
}

/// Event emitted when a path payment fails
#[contractevent]
pub struct PathPaymentFailed {
    pub payment_id: u64,
    pub error_code: u32,
    pub error_message: String,
    pub partial_failure: bool,
}

const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;
const TEMPORARY_TTL_THRESHOLD: u32 = 2_000;
const TEMPORARY_TTL_EXTEND_TO: u32 = 20_000;

#[contract]
pub struct AssetPathPaymentContract;

#[contractimpl]
impl AssetPathPaymentContract {
    /// Returns the contract version as (major, minor, patch).
    pub fn version() -> (u32, u32, u32) {
        (1, 0, 0)
    }

    /// Initialize the contract with an admin address
    pub fn init(env: Env, admin: Address) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic!("{}", PathPaymentError::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::PaymentCount, &0u64);
        Self::bump_core_ttl(&env);
    }

    /// Extend TTL for core storage entries
    pub fn bump_ttl(env: Env) {
        Self::require_admin(&env);
        Self::bump_core_ttl(&env);
    }

    /// Initiate a path payment with slippage protection
    ///
    /// # Arguments
    /// * `from` - Source account initiating the payment
    /// * `to` - Destination account receiving the payment
    /// * `source_asset` - Asset to send
    /// * `dest_asset` - Asset to receive
    /// * `source_amount` - Amount of source asset to send
    /// * `dest_min_amount` - Minimum destination amount (slippage protection)
    /// * `maximum_source_amount` - Maximum source amount to protect against slippage
    /// * `path` - Intermediate assets in the path (empty for direct path)
    pub fn initiate_path_payment(
        env: Env,
        from: Address,
        to: Address,
        source_asset: Address,
        dest_asset: Address,
        source_amount: i128,
        dest_min_amount: i128,
        maximum_source_amount: i128,
        path: Vec<Address>,
    ) -> Result<u64, PathPaymentError> {
        from.require_auth();

        // Validate amounts
        if source_amount <= 0 {
            return Err(PathPaymentError::InvalidAmount);
        }
        if dest_min_amount <= 0 {
            return Err(PathPaymentError::InvalidAmount);
        }
        if maximum_source_amount < source_amount {
            return Err(PathPaymentError::SlippageExceeded);
        }

        // Transfer source tokens to contract (escrow)
        let token_client = token::Client::new(&env, &source_asset);
        let contract_addr = env.current_contract_address();
        
        token_client.transfer(&from, &contract_addr, &source_amount);

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

        // Create payment record
        let record = PathPaymentRecord {
            from: from.clone(),
            to: to.clone(),
            source_asset: source_asset.clone(),
            dest_asset: dest_asset.clone(),
            source_amount,
            dest_min_amount,
            maximum_source_amount,
            actual_dest_amount: None,
            actual_source_amount: None,
            path: path.clone(),
            status: symbol_short!("pending"),
            error_message: None,
            partial_failure: false,
        };

        // Store the payment record
        let payment_key = DataKey::Payment(count);
        env.storage().temporary().set(&payment_key, &record);
        env.storage().temporary().extend_ttl(
            &payment_key,
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );

        // Emit initiation event
        env.events().publish(
            (symbol_short!("pay_init"), count),
            PathPaymentInitiated {
                payment_id: count,
                from,
                to,
                source_asset,
                dest_asset,
                source_amount,
                dest_min_amount,
            },
        );

        Ok(count)
    }

    /// Complete a path payment after it has been processed off-chain
    ///
    /// This function is called by the backend after executing the path payment
    /// on the Stellar network
    pub fn complete_path_payment(
        env: Env,
        payment_id: u64,
        actual_source_amount: i128,
        actual_dest_amount: i128,
    ) -> Result<(), PathPaymentError> {
        Self::require_admin(&env);

        let key = DataKey::Payment(payment_id);
        let mut record: PathPaymentRecord = env.storage()
            .temporary()
            .get(&key)
            .ok_or(PathPaymentError::PaymentNotFound)?;

        if record.status != symbol_short!("pending") {
            return Err(PathPaymentError::PaymentNotPending);
        }

        // Verify slippage protection
        if actual_dest_amount < record.dest_min_amount {
            record.status = symbol_short!("failed");
            record.error_message = Some(String::from_str(&env, "Destination amount below minimum"));
            record.partial_failure = true;
            env.storage().temporary().set(&key, &record);
            
            env.events().publish(
                (symbol_short!("pay_fail"), payment_id),
                PathPaymentFailed {
                    payment_id,
                    error_code: PathPaymentError::SlippageExceeded as u32,
                    error_message: String::from_str(&env, "Slippage exceeded"),
                    partial_failure: true,
                },
            );
            
            return Err(PathPaymentError::SlippageExceeded);
        }

        // Update record
        record.actual_source_amount = Some(actual_source_amount);
        record.actual_dest_amount = Some(actual_dest_amount);
        record.status = symbol_short!("completed");

        env.storage().temporary().set(&key, &record);
        env.storage().temporary().extend_ttl(
            &key,
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );

        env.events().publish(
            (symbol_short!("pay_comp"), payment_id),
            PathPaymentCompleted {
                payment_id,
                actual_source_amount,
                actual_dest_amount,
            },
        );

        Ok(())
    }

    /// Mark a path payment as failed with error details
    pub fn fail_path_payment(
        env: Env,
        payment_id: u64,
        error_code: u32,
        error_message: String,
        partial_failure: bool,
    ) -> Result<(), PathPaymentError> {
        Self::require_admin(&env);

        let key = DataKey::Payment(payment_id);
        let mut record: PathPaymentRecord = env.storage()
            .temporary()
            .get(&key)
            .ok_or(PathPaymentError::PaymentNotFound)?;

        if record.status != symbol_short!("pending") {
            return Err(PathPaymentError::PaymentNotPending);
        }

        record.status = symbol_short!("failed");
        record.error_message = Some(error_message.clone());
        record.partial_failure = partial_failure;

        env.storage().temporary().set(&key, &record);

        env.events().publish(
            (symbol_short!("pay_fail"), payment_id),
            PathPaymentFailed {
                payment_id,
                error_code,
                error_message,
                partial_failure,
            },
        );

        Ok(())
    }

    /// Get payment details by ID
    pub fn get_payment(env: Env, payment_id: u64) -> Option<PathPaymentRecord> {
        let key = DataKey::Payment(payment_id);
        let record: Option<PathPaymentRecord> = env.storage().temporary().get(&key);
        
        if record.is_some() {
            env.storage().temporary().extend_ttl(
                &key,
                TEMPORARY_TTL_THRESHOLD,
                TEMPORARY_TTL_EXTEND_TO,
            );
        }
        record
    }

    /// Get total payment count
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

    /// Admin-only function to withdraw tokens (for refunds)
    pub fn withdraw(
        env: Env,
        asset: Address,
        amount: i128,
        to: Address,
    ) -> Result<(), PathPaymentError> {
        Self::require_admin(&env);

        if amount <= 0 {
            return Err(PathPaymentError::InvalidAmount);
        }

        let token_client = token::Client::new(&env, &asset);
        token_client.transfer(&env.current_contract_address(), &to, &amount);

        Ok(())
    }

    /// Require admin authorization
    fn require_admin(env: &Env) {
        let admin: Address = env.storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Admin not set; contract may not be initialized");
        env.storage().persistent().extend_ttl(
            &DataKey::Admin,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        admin.require_auth();
    }

    /// Extend TTL for core storage entries
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
