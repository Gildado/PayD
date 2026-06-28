#![no_std]
#![allow(clippy::too_many_arguments)]
use soroban_sdk::{
    Address, Env, String, Vec, contract, contracterror, contractevent, contractimpl, contracttype,
    token,
};
const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    EscrowNotFound = 5,
    EscrowInactive = 6,
    MilestoneNotFound = 7,
    MilestoneAlreadyApproved = 8,
    MilestoneNotApproved = 9,
    InvalidMilestones = 10,
    ContractPaused = 11,
    LedgerReplayDetected = 12,
    SameAdmin = 13,
    NotVerifier = 14,
    InsufficientFunds = 15,
    InsufficientEscrowBalance = 16,
}

#[contracttype]
#[derive(Clone)]
pub enum MilestoneStatus {
    Pending,
    Approved,
    Released,
}

#[contracttype]
#[derive(Clone)]
pub struct Milestone {
    pub description: String,
    pub amount: i128,
    pub status: MilestoneStatus,
}

#[contracttype]
#[derive(Clone)]
pub struct EscrowRecord {
    pub sender: Address,
    pub beneficiary: Address,
    pub verifier: Address,
    pub token: Address,
    pub milestones: Vec<Milestone>,
    pub total_amount: i128,
    pub released_amount: i128,
    pub is_active: bool,
    pub created_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Escrow(u64),
    EscrowCount,
    LastReleaseLedger(u64),
    LastCancelLedger(u64),
    LastApproveLedger(u64),
    Paused,
}

#[contractevent]
pub struct EscrowCreatedEvent {
    pub escrow_id: u64,
    pub sender: Address,
    pub beneficiary: Address,
    pub verifier: Address,
    pub token: Address,
    pub total_amount: i128,
    pub milestone_count: u32,
}

#[contractevent]
pub struct MilestoneApprovedEvent {
    pub escrow_id: u64,
    pub milestone_index: u32,
    pub amount: i128,
    pub verifier: Address,
}

#[contractevent]
pub struct MilestoneReleasedEvent {
    pub escrow_id: u64,
    pub milestone_index: u32,
    pub amount: i128,
    pub beneficiary: Address,
}

#[contractevent]
pub struct EscrowCancelledEvent {
    pub escrow_id: u64,
    pub sender: Address,
    pub recovered_amount: i128,
    pub released_amount: i128,
}

#[contractevent]
pub struct ContractStatusChangedEvent {
    pub paused: bool,
    pub admin: Address,
}

#[contract]
pub struct MilestoneEscrowContract;

#[contractimpl]
impl MilestoneEscrowContract {
    pub fn name(env: Env) -> String {
        String::from_str(&env, env!("CARGO_PKG_NAME"))
    }

    pub fn version(env: Env) -> String {
        String::from_str(&env, env!("CARGO_PKG_VERSION"))
    }

    pub fn author(env: Env) -> String {
        String::from_str(&env, env!("CARGO_PKG_AUTHORS"))
    }

    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }

        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::EscrowCount, &0u64);
        env.storage().persistent().extend_ttl(
            &DataKey::Admin,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        env.storage().persistent().extend_ttl(
            &DataKey::EscrowCount,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        Ok(())
    }

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
        Self::bump_core_ttl(&env);
        Ok(())
    }

    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

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

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    pub fn bump_ttl(env: Env) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        admin.require_auth();
        Self::bump_core_ttl(&env);
        Ok(())
    }

    pub fn create_escrow(
        e: Env,
        sender: Address,
        beneficiary: Address,
        verifier: Address,
        token: Address,
        milestones: Vec<Milestone>,
    ) -> Result<u64, ContractError> {
        Self::require_not_paused(&e)?;

        sender.require_auth();

        if milestones.is_empty() || milestones.len() > 50 {
            return Err(ContractError::InvalidMilestones);
        }

        let mut total_amount: i128 = 0;
        for i in 0..milestones.len() {
            let m = milestones.get(i).ok_or(ContractError::MilestoneNotFound)?;
            if m.amount <= 0 {
                return Err(ContractError::InvalidAmount);
            }
            total_amount = total_amount
                .checked_add(m.amount)
                .ok_or(ContractError::InvalidAmount)?;
        }

        let mut escrow_count: u64 = e
            .storage()
            .persistent()
            .get(&DataKey::EscrowCount)
            .unwrap_or(0);
        escrow_count = escrow_count
            .checked_add(1)
            .ok_or(ContractError::InvalidAmount)?;

        let escrow_id = escrow_count;
        e.storage()
            .persistent()
            .set(&DataKey::EscrowCount, &escrow_count);
        e.storage().persistent().extend_ttl(
            &DataKey::EscrowCount,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        let token_client = token::Client::new(&e, &token);
        token_client.transfer(&sender, e.current_contract_address(), &total_amount);

        let record = EscrowRecord {
            sender: sender.clone(),
            beneficiary: beneficiary.clone(),
            verifier: verifier.clone(),
            token: token.clone(),
            milestones: milestones.clone(),
            total_amount,
            released_amount: 0,
            is_active: true,
            created_at: e.ledger().timestamp(),
        };

        e.storage()
            .persistent()
            .set(&DataKey::Escrow(escrow_id), &record);
        Self::bump_escrow_ttl(&e, escrow_id);

        EscrowCreatedEvent {
            escrow_id,
            sender,
            beneficiary,
            verifier,
            token,
            total_amount,
            milestone_count: milestones.len(),
        }
        .publish(&e);

        Ok(escrow_id)
    }

    pub fn approve_milestone(
        e: Env,
        escrow_id: u64,
        milestone_index: u32,
    ) -> Result<(), ContractError> {
        Self::require_not_paused(&e)?;

        let mut record: EscrowRecord = e
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(ContractError::EscrowNotFound)?;

        record.verifier.require_auth();

        if !record.is_active {
            return Err(ContractError::EscrowInactive);
        }

        Self::require_unique_ledger(&e, &DataKey::LastApproveLedger(escrow_id))?;

        let mut milestone = record
            .milestones
            .get(milestone_index)
            .ok_or(ContractError::MilestoneNotFound)?;

        match milestone.status {
            MilestoneStatus::Pending => {}
            MilestoneStatus::Approved | MilestoneStatus::Released => {
                return Err(ContractError::MilestoneAlreadyApproved);
            }
        }

        milestone.status = MilestoneStatus::Approved;
        record.milestones.set(milestone_index, milestone.clone());

        e.storage()
            .persistent()
            .set(&DataKey::Escrow(escrow_id), &record);
        Self::bump_escrow_ttl(&e, escrow_id);

        MilestoneApprovedEvent {
            escrow_id,
            milestone_index,
            amount: milestone.amount,
            verifier: record.verifier,
        }
        .publish(&e);

        Ok(())
    }

    pub fn release_milestone(
        e: Env,
        escrow_id: u64,
        milestone_index: u32,
    ) -> Result<(), ContractError> {
        Self::require_not_paused(&e)?;

        let mut record: EscrowRecord = e
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(ContractError::EscrowNotFound)?;

        record.beneficiary.require_auth();

        if !record.is_active {
            return Err(ContractError::EscrowInactive);
        }

        Self::require_unique_ledger(&e, &DataKey::LastReleaseLedger(escrow_id))?;

        let mut milestone = record
            .milestones
            .get(milestone_index)
            .ok_or(ContractError::MilestoneNotFound)?;

        match milestone.status {
            MilestoneStatus::Approved => {}
            MilestoneStatus::Pending => {
                return Err(ContractError::MilestoneNotApproved);
            }
            MilestoneStatus::Released => {
                return Err(ContractError::MilestoneAlreadyApproved);
            }
        }

        let contract_balance =
            token::Client::new(&e, &record.token).balance(&e.current_contract_address());
        if contract_balance < milestone.amount {
            return Err(ContractError::InsufficientEscrowBalance);
        }

        milestone.status = MilestoneStatus::Released;
        record.milestones.set(milestone_index, milestone.clone());

        record.released_amount = record
            .released_amount
            .checked_add(milestone.amount)
            .ok_or(ContractError::InvalidAmount)?;

        if record.released_amount >= record.total_amount {
            record.is_active = false;
        }

        e.storage()
            .persistent()
            .set(&DataKey::Escrow(escrow_id), &record);
        Self::bump_escrow_ttl(&e, escrow_id);

        token::Client::new(&e, &record.token).transfer(
            &e.current_contract_address(),
            &record.beneficiary,
            &milestone.amount,
        );

        MilestoneReleasedEvent {
            escrow_id,
            milestone_index,
            amount: milestone.amount,
            beneficiary: record.beneficiary,
        }
        .publish(&e);

        Ok(())
    }

    pub fn cancel_escrow(e: Env, escrow_id: u64) -> Result<(), ContractError> {
        Self::require_not_paused(&e)?;

        let mut record: EscrowRecord = e
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(ContractError::EscrowNotFound)?;

        record.sender.require_auth();

        if !record.is_active {
            return Err(ContractError::EscrowInactive);
        }

        Self::require_unique_ledger(&e, &DataKey::LastCancelLedger(escrow_id))?;

        let mut unreleased_amount: i128 = 0;
        for i in 0..record.milestones.len() {
            let m = record
                .milestones
                .get(i)
                .ok_or(ContractError::MilestoneNotFound)?;
            match m.status {
                MilestoneStatus::Released => {}
                MilestoneStatus::Pending | MilestoneStatus::Approved => {
                    unreleased_amount = unreleased_amount
                        .checked_add(m.amount)
                        .ok_or(ContractError::InvalidAmount)?;
                }
            }
        }

        record.is_active = false;
        e.storage()
            .persistent()
            .set(&DataKey::Escrow(escrow_id), &record);
        Self::bump_escrow_ttl(&e, escrow_id);

        if unreleased_amount > 0 {
            let contract_balance =
                token::Client::new(&e, &record.token).balance(&e.current_contract_address());
            let recoverable = if unreleased_amount < contract_balance {
                unreleased_amount
            } else {
                contract_balance
            };
            if recoverable > 0 {
                token::Client::new(&e, &record.token).transfer(
                    &e.current_contract_address(),
                    &record.sender,
                    &recoverable,
                );
            }
        }

        EscrowCancelledEvent {
            escrow_id,
            sender: record.sender,
            recovered_amount: unreleased_amount,
            released_amount: record.released_amount,
        }
        .publish(&e);

        Ok(())
    }

    pub fn get_escrow(e: Env, escrow_id: u64) -> Result<EscrowRecord, ContractError> {
        e.storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(ContractError::EscrowNotFound)
    }

    pub fn get_escrow_count(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::EscrowCount)
            .unwrap_or(0)
    }

    pub fn get_releasable_amount(e: Env, escrow_id: u64) -> Result<i128, ContractError> {
        let record: EscrowRecord = e
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(ContractError::EscrowNotFound)?;

        let mut total_approved: i128 = 0;
        for i in 0..record.milestones.len() {
            let m = record
                .milestones
                .get(i)
                .ok_or(ContractError::MilestoneNotFound)?;
            if matches!(m.status, MilestoneStatus::Approved) {
                total_approved = total_approved
                    .checked_add(m.amount)
                    .ok_or(ContractError::InvalidAmount)?;
            }
        }
        Ok(total_approved)
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

    fn bump_core_ttl(e: &Env) {
        for key in [&DataKey::Admin, &DataKey::EscrowCount] {
            if e.storage().persistent().has(key) {
                e.storage().persistent().extend_ttl(
                    key,
                    PERSISTENT_TTL_THRESHOLD,
                    PERSISTENT_TTL_EXTEND_TO,
                );
            }
        }
    }

    fn bump_escrow_ttl(e: &Env, escrow_id: u64) {
        let key = DataKey::Escrow(escrow_id);
        if e.storage().persistent().has(&key) {
            e.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
        }
    }
}

#[cfg(test)]
mod test;
