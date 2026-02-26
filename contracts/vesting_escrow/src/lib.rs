#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

#[contracttype]
#[derive(Clone)]
pub struct VestingConfig {
    pub funder: Address,
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

#[contract]
pub struct VestingContract;

#[contractimpl]
impl VestingContract {
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
        if e.storage().instance().has(&DataKey::Config) {
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
            funder: funder.clone(),
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

        e.storage().instance().set(&DataKey::Config, &config);
        
        // Transfer tokens from funder to contract
        let client = token::Client::new(&e, &token);
        client.transfer(&funder, &e.current_contract_address(), &amount);
    }

    pub fn claim(e: Env) {
        let mut config: VestingConfig = e.storage().instance().get(&DataKey::Config).expect("Not initialized");
        
        config.beneficiary.require_auth();
        
        let vested = Self::calc_vested(&e, &config);
        let claimable = vested - config.claimed_amount;

        if claimable <= 0 {
            // Nothing to claim, just return
            return;
        }

        // Update state
        config.claimed_amount += claimable;
        e.storage().instance().set(&DataKey::Config, &config);

        // Transfer tokens
        let client = token::Client::new(&e, &config.token);
        client.transfer(&e.current_contract_address(), &config.beneficiary, &claimable);
    }
    
    pub fn clawback(e: Env) {
        let mut config: VestingConfig = e.storage().instance().get(&DataKey::Config).expect("Not initialized");
        
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
        e.storage().instance().set(&DataKey::Config, &config);

        if unvested > 0 {
            // Return unvested tokens to admin
            let client = token::Client::new(&e, &config.token);
            client.transfer(&e.current_contract_address(), &config.clawback_admin, &unvested);
        }
    }

    pub fn cancel_stream(e: Env, sender: Address) {
        let mut config: VestingConfig = e.storage().instance().get(&DataKey::Config).expect("Not initialized");

        sender.require_auth();
        if sender != config.funder {
            panic!("Only sender can cancel stream");
        }

        if !config.is_active {
            panic!("Stream already inactive");
        }

        let vested = Self::calc_vested(&e, &config);
        let claimable = vested - config.claimed_amount;

        let client = token::Client::new(&e, &config.token);

        // Settle recipient for final claimable amount at cancellation time.
        if claimable > 0 {
            config.claimed_amount += claimable;
            client.transfer(&e.current_contract_address(), &config.beneficiary, &claimable);
        }

        // Refund all remaining deposited tokens back to the sender.
        let remaining = config.total_amount - config.claimed_amount;
        if remaining > 0 {
            client.transfer(&e.current_contract_address(), &sender, &remaining);
        }

        // Freeze future vesting and mark stream inactive.
        config.total_amount = config.claimed_amount;
        config.is_active = false;
        e.storage().instance().set(&DataKey::Config, &config);
    }

    pub fn get_vested_amount(e: Env) -> i128 {
        let config: VestingConfig = e.storage().instance().get(&DataKey::Config).expect("Not initialized");
        Self::calc_vested(&e, &config)
    }
    
    pub fn get_claimable_amount(e: Env) -> i128 {
        let config: VestingConfig = e.storage().instance().get(&DataKey::Config).expect("Not initialized");
        let vested = Self::calc_vested(&e, &config);
        vested - config.claimed_amount
    }
    
    pub fn get_config(e: Env) -> VestingConfig {
        e.storage().instance().get(&DataKey::Config).expect("Not initialized")
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
}

#[cfg(test)]
mod test;
