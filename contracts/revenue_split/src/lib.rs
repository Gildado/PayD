#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Vec, token};

#[cfg(test)]
mod test;

#[contracttype]
pub enum DataKey {
    Admin,
    Recipients,
}

const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;

#[derive(Clone)]
#[contracttype]
pub struct RecipientShare {
    pub destination: Address,
    pub basis_points: u32,
}

pub const TOTAL_BASIS_POINTS: u32 = 10000; // 100%

#[contract]
pub struct RevenueSplitContract;

#[contractimpl]
impl RevenueSplitContract {
    /// Returns the contract version as (major, minor, patch).
    pub fn version() -> (u32, u32, u32) {
        (1, 0, 0)
    }

    /// Initialize the contract with an admin and an initial set of recipients/shares.
    pub fn init(env: Env, admin: Address, shares: Vec<RecipientShare>) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        
        let mut total_bp = 0;
        for share in shares.iter() {
            total_bp += share.basis_points;
        }
        
        if total_bp != TOTAL_BASIS_POINTS {
            panic!("Shares must sum to 10000 basis points");
        }

        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::Recipients, &shares);
        Self::bump_core_ttl(&env);
    }

    /// Allows the current admin to set a new admin.
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).expect("Admin entry unavailable; restore and retry");
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &new_admin);
        Self::bump_core_ttl(&env);
    }

    /// Updates the recipient splits dynamically (admin only).
    pub fn update_recipients(env: Env, new_shares: Vec<RecipientShare>) {
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).expect("Admin entry unavailable; restore and retry");
        admin.require_auth();

        let mut total_bp = 0;
        for share in new_shares.iter() {
            total_bp += share.basis_points;
        }
        
        if total_bp != TOTAL_BASIS_POINTS {
            panic!("Shares must sum to 10000 basis points");
        }

        env.storage().persistent().set(&DataKey::Recipients, &new_shares);
        Self::bump_core_ttl(&env);
    }

    /// Extends TTL for critical organization configuration.
    pub fn bump_ttl(env: Env) {
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).expect("Admin entry unavailable; restore and retry");
        admin.require_auth();
        Self::bump_core_ttl(&env);
    }

    /// Distributes a specific token amount from a sender to the listed recipients based on their shares.
    pub fn distribute(env: Env, token: Address, from: Address, amount: i128) {
        from.require_auth();
        
        let shares: Vec<RecipientShare> = env.storage().persistent().get(&DataKey::Recipients).expect("Recipients entry unavailable; restore and retry");
        Self::bump_core_ttl(&env);
        let client = token::Client::new(&env, &token);

        let mut amount_distributed = 0;

        for (i, share) in shares.iter().enumerate() {
            // Calculate slice of the total amount using basis points
            // Formula: amount * basis_points / 10000
            let recipient_amount = (amount as i128 * share.basis_points as i128) / TOTAL_BASIS_POINTS as i128;
            
            if recipient_amount > 0 {
                // To avoid precision loss dust, the last recipient takes any minor remainders.
                if i as u32 == shares.len() - 1 {
                    let final_amount = amount - amount_distributed;
                    if final_amount > 0 {
                        client.transfer(&from, &share.destination, &final_amount);
                    }
                } else {
                    client.transfer(&from, &share.destination, &recipient_amount);
                    amount_distributed += recipient_amount;
                }
            }
        }
    }

    fn bump_core_ttl(env: &Env) {
        for key in [DataKey::Admin, DataKey::Recipients] {
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
