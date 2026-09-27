#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

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
pub enum DataKey {
    Config,
}

const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;

#[contract]
pub struct VestingContract;

#[contractimpl]
impl VestingContract {
    /// Returns the contract version as (major, minor, patch).
    pub fn version() -> (u32, u32, u32) {
        (1, 0, 0)
    }

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
    ) {
        if e.storage().persistent().has(&DataKey::Config) {
            panic!("Already initialized");
        }
        
        funder.require_auth();

        if duration_seconds < cliff_seconds {
            panic!("Duration must be greater than or equal to cliff");
        }
        
        if amount <= 0 {
             panic!("Amount must be positive");
        }

        let config = VestingConfig {
            beneficiary: beneficiary.clone(),
            token: token.clone(),
            start_time,
            cliff_seconds,
            duration_seconds,
            total_amount: amount,
            claimed_amount: 0,
            clawback_admin,
            is_active: true,
        };

        e.storage().persistent().set(&DataKey::Config, &config);
        Self::bump_config_ttl(&e);
        
        // Transfer tokens from funder to contract
        let client = token::Client::new(&e, &token);
        client.transfer(&funder, &e.current_contract_address(), &amount);
    }

    pub fn claim(e: Env) {
        let mut config: VestingConfig = e.storage().persistent().get(&DataKey::Config).expect("Config entry unavailable; restore and retry");
        
        config.beneficiary.require_auth();
        
        let vested = Self::calc_vested(&e, &config);
        let claimable = vested - config.claimed_amount;

        if claimable <= 0 {
            // Nothing to claim, just return
            return;
        }

        // Update state
        config.claimed_amount += claimable;
        e.storage().persistent().set(&DataKey::Config, &config);
        Self::bump_config_ttl(&e);

        // Transfer tokens
        let client = token::Client::new(&e, &config.token);
        client.transfer(&e.current_contract_address(), &config.beneficiary, &claimable);
    }
    
    pub fn clawback(e: Env) {
        let mut config: VestingConfig = e.storage().persistent().get(&DataKey::Config).expect("Config entry unavailable; restore and retry");
        
        config.clawback_admin.require_auth();
        
        if !config.is_active {
            panic!("Already revoked/inactive");
        }

        // Calculate what has vested so far
        let vested = Self::calc_vested(&e, &config);
        
        // The unvested amount is the total scheduled minus what has vested
        let unvested = config.total_amount - vested;
        
        // Update config to stop future vesting
        // We set total_amount to vested, so effectively the grant is capped at what was vested at this moment
        config.total_amount = vested;
        config.is_active = false;
        e.storage().persistent().set(&DataKey::Config, &config);
        Self::bump_config_ttl(&e);

        if unvested > 0 {
            // Return unvested tokens to admin
            let client = token::Client::new(&e, &config.token);
            client.transfer(&e.current_contract_address(), &config.clawback_admin, &unvested);
        }
    }

    pub fn get_vested_amount(e: Env) -> i128 {
        let config: VestingConfig = e.storage().persistent().get(&DataKey::Config).expect("Config entry unavailable; restore and retry");
        Self::bump_config_ttl(&e);
        Self::calc_vested(&e, &config)
    }
    
    pub fn get_claimable_amount(e: Env) -> i128 {
        let config: VestingConfig = e.storage().persistent().get(&DataKey::Config).expect("Config entry unavailable; restore and retry");
        Self::bump_config_ttl(&e);
        let vested = Self::calc_vested(&e, &config);
        vested - config.claimed_amount
    }
    
    pub fn get_config(e: Env) -> VestingConfig {
        let config: VestingConfig = e.storage().persistent().get(&DataKey::Config).expect("Config entry unavailable; restore and retry");
        Self::bump_config_ttl(&e);
        config
    }

    /// Extends TTL for the vesting configuration entry.
    pub fn bump_ttl(e: Env) {
        let config: VestingConfig = e.storage().persistent().get(&DataKey::Config).expect("Config entry unavailable; restore and retry");
        config.clawback_admin.require_auth();
        Self::bump_config_ttl(&e);
    }

    fn calc_vested(e: &Env, config: &VestingConfig) -> i128 {
        let now = e.ledger().timestamp();
        
        if now < config.start_time + config.cliff_seconds {
            return 0;
        }
        
        if now >= config.start_time + config.duration_seconds || !config.is_active {
            return config.total_amount;
        }
        
        // Linear vesting
        let time_elapsed = now - config.start_time;
        
        // vested = total * elapsed / duration
        // We use i128 for calculation to avoid overflow
        let total = config.total_amount;
        let elapsed = time_elapsed as i128;
        let duration = config.duration_seconds as i128;
        
        total.checked_mul(elapsed).unwrap().checked_div(duration).unwrap()
    }

    fn bump_config_ttl(e: &Env) {
        if e.storage().persistent().has(&DataKey::Config) {
            e.storage().persistent().extend_ttl(
                &DataKey::Config,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
        }
    }
}

#[cfg(test)]
mod test;
