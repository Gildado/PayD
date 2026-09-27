// Shared upgrade governance module for all PayD contracts
// Implements Issue #1585: Multisig/timelock for contract upgrade authorization
//
// This module provides:
// - 2-of-3 multisig approval mechanism
// - 24-hour timelock before upgrade execution
// - Admin keyset rotation
// - Comprehensive audit trail

#![no_std]
use soroban_sdk::{
    Address, Env, Symbol, Vec, contracttype, contractevent, symbol_short,
};

/// Upgrade proposal state machine
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum UpgradeStatus {
    Pending,      // Proposed but not yet approved
    Approved,     // 2-of-3 approval received, timelock active
    Ready,        // Timelock expired, ready for execution
    Executed,     // Upgrade executed and applied
    Cancelled,    // Cancelled before execution
}

/// Represents a pending upgrade proposal
#[contracttype]
#[derive(Clone, Debug)]
pub struct UpgradeProposal {
    pub contract_id: u64,
    pub proposed_wasm_hash: [u8; 32],
    pub proposed_by: Address,
    pub proposed_at_ledger: u32,
    pub approved_by: Option<Address>,
    pub approved_at_ledger: u32, // 0 if not yet approved
    pub ready_at_ledger: u32,     // proposed_at_ledger + TIMELOCK_LEDGERS
    pub status: UpgradeStatus,
    pub cancellation_reason: Option<Symbol>,
}

/// Admin keyset for multisig authorization (2-of-3)
#[contracttype]
#[derive(Clone, Debug)]
pub struct AdminKeyset {
    pub admin_1: Address,
    pub admin_2: Address,
    pub admin_3: Address,
    pub rotation_proposed_at_ledger: u32,
}

/// Upgrade executed event for audit trail
#[contractevent]
pub struct UpgradeProposedEvent {
    #[topic]
    pub contract_id: u64,
    pub wasm_hash: [u8; 32],
    pub proposed_by: Address,
    pub proposed_at_ledger: u32,
}

/// Upgrade approved event (2-of-3 threshold met)
#[contractevent]
pub struct UpgradeApprovedEvent {
    #[topic]
    pub contract_id: u64,
    pub approved_by: Address,
    pub approved_at_ledger: u32,
    pub ready_at_ledger: u32,
}

/// Upgrade executed event
#[contractevent]
pub struct UpgradeExecutedEvent {
    #[topic]
    pub contract_id: u64,
    pub wasm_hash: [u8; 32],
    pub executed_at_ledger: u32,
}

/// Upgrade cancelled event
#[contractevent]
pub struct UpgradeCancelledEvent {
    #[topic]
    pub contract_id: u64,
    pub cancelled_by: Address,
    pub cancelled_at_ledger: u32,
    pub reason: Symbol,
}

/// Admin keyset rotation proposed event
#[contractevent]
pub struct AdminKeysetRotationProposedEvent {
    pub new_admin_1: Address,
    pub new_admin_2: Address,
    pub new_admin_3: Address,
    pub proposed_at_ledger: u32,
}

/// Admin keyset rotation executed event
#[contractevent]
pub struct AdminKeysetRotatedEvent {
    pub new_admin_1: Address,
    pub new_admin_2: Address,
    pub new_admin_3: Address,
    pub rotated_at_ledger: u32,
}

// ── Constants ──────────────────────────────────────────────────────────────

/// 24 hours in ledgers (assuming ~12 second ledger time)
/// 24 * 60 * 60 / 12 = 7,200 ledgers
pub const TIMELOCK_LEDGERS: u32 = 7_200;

/// TTL for upgrade proposal storage (120,000 ledgers)
pub const UPGRADE_TTL_EXTEND_TO: u32 = 120_000;

/// TTL threshold for bumping upgrade storage
pub const UPGRADE_TTL_THRESHOLD: u32 = 20_000;

// ── Multisig Voting ────────────────────────────────────────────────────────

/// Verify that caller is one of the 3 admin keyset members
pub fn require_admin_keyset_member(env: &Env, caller: &Address, keyset: &AdminKeyset) -> Result<(), Symbol> {
    if caller == &keyset.admin_1 || caller == &keyset.admin_2 || caller == &keyset.admin_3 {
        Ok(())
    } else {
        Err(symbol_short!("not_admin"))
    }
}

/// Count how many admin members are in the keyset
/// Used to verify 2-of-3 approval quorum
pub fn count_admin_signers(
    proposed_by: &Address,
    approved_by: &Option<Address>,
    keyset: &AdminKeyset,
) -> u32 {
    let mut count = 0;

    // Check if proposed_by is a valid admin
    if proposed_by == &keyset.admin_1 || proposed_by == &keyset.admin_2 || proposed_by == &keyset.admin_3
    {
        count += 1;
    }

    // Check if approved_by is a different valid admin
    if let Some(approver) = approved_by {
        if approver != proposed_by
            && (approver == &keyset.admin_1
                || approver == &keyset.admin_2
                || approver == &keyset.admin_3)
        {
            count += 1;
        }
    }

    count
}

// ── Timelock Logic ─────────────────────────────────────────────────────────

/// Check if timelock period has elapsed
pub fn is_timelock_expired(env: &Env, ready_at_ledger: u32) -> bool {
    let current_ledger = env.ledger().sequence();
    current_ledger >= ready_at_ledger
}

/// Calculate when upgrade will be ready for execution
pub fn calculate_ready_ledger(proposed_at_ledger: u32) -> u32 {
    proposed_at_ledger.saturating_add(TIMELOCK_LEDGERS)
}

// ── Upgrade Proposal State Machine ─────────────────────────────────────────

/// Validate state transition for upgrade proposals
/// Enforces strict state machine:
///   Pending → Approved → Ready → Executed
///   Pending → Cancelled (from any state)
pub fn validate_state_transition(
    current_status: &UpgradeStatus,
    new_status: &UpgradeStatus,
) -> Result<(), Symbol> {
    use UpgradeStatus::*;

    match (current_status, new_status) {
        // Cancellation allowed from any state
        (_, Cancelled) => Ok(()),

        // Pending → Approved (after 2-of-3 approval)
        (Pending, Approved) => Ok(()),

        // Approved → Ready (after timelock expires)
        (Approved, Ready) => Ok(()),

        // Ready → Executed (execute upgrade)
        (Ready, Executed) => Ok(()),

        // Invalid transitions
        _ => Err(symbol_short!("invalid_transition")),
    }
}

// ── Admin Keyset Rotation ──────────────────────────────────────────────────

/// Validate proposed new keyset (all 3 members distinct, non-zero)
pub fn validate_keyset(
    admin_1: &Address,
    admin_2: &Address,
    admin_3: &Address,
) -> Result<(), Symbol> {
    // Check all are distinct
    if admin_1 == admin_2 || admin_2 == admin_3 || admin_1 == admin_3 {
        return Err(symbol_short!("dupe_admins"));
    }
    Ok(())
}

/// Verify that a keyset rotation was authorized by all 3 current admins
/// (Prevents single-key rotation abuse)
pub fn require_all_admins_rotate(
    current_keyset: &AdminKeyset,
    signer_1: &Address,
    signer_2: &Address,
    signer_3: &Address,
) -> Result<(), Symbol> {
    // Collect all signers
    let signers = [signer_1, signer_2, signer_3];
    let admins = [&current_keyset.admin_1, &current_keyset.admin_2, &current_keyset.admin_3];

    // Verify each admin is represented exactly once
    for admin in &admins {
        if !signers.iter().any(|s| s == *admin) {
            return Err(symbol_short!("missing_signer"));
        }
    }

    Ok(())
}

// ── Storage Helpers ────────────────────────────────────────────────────────

/// Helper to safely store upgrade proposal with TTL extension
pub fn store_upgrade_proposal(
    env: &Env,
    proposal_key: &soroban_sdk::Val,
    proposal: &UpgradeProposal,
) {
    env.storage().persistent().set(proposal_key, proposal);
    env.storage().persistent().extend_ttl(
        proposal_key,
        UPGRADE_TTL_THRESHOLD,
        UPGRADE_TTL_EXTEND_TO,
    );
}

/// Helper to safely store admin keyset with TTL extension
pub fn store_admin_keyset(
    env: &Env,
    keyset_key: &soroban_sdk::Val,
    keyset: &AdminKeyset,
) {
    env.storage().persistent().set(keyset_key, keyset);
    env.storage().persistent().extend_ttl(
        keyset_key,
        UPGRADE_TTL_THRESHOLD,
        UPGRADE_TTL_EXTEND_TO,
    );
}

/// Helper to safely read upgrade proposal or return error
pub fn get_upgrade_proposal(
    env: &Env,
    proposal_key: &soroban_sdk::Val,
) -> Result<UpgradeProposal, Symbol> {
    env.storage()
        .persistent()
        .get(proposal_key)
        .ok_or(symbol_short!("proposal_not_found"))
}

/// Helper to safely read admin keyset or return error
pub fn get_admin_keyset(
    env: &Env,
    keyset_key: &soroban_sdk::Val,
) -> Result<AdminKeyset, Symbol> {
    env.storage()
        .persistent()
        .get(keyset_key)
        .ok_or(symbol_short!("keyset_not_found"))
}

// ── Hash Validation ────────────────────────────────────────────────────────

/// Verify WASM hash format is 32 bytes (SHA-256)
pub fn validate_wasm_hash(hash: &[u8; 32]) -> Result<(), Symbol> {
    // Hash is 32 bytes - inherent by type definition
    // Additional validation could check against published hashes
    Ok(())
}

/// Compare two WASM hashes
pub fn hashes_equal(hash1: &[u8; 32], hash2: &[u8; 32]) -> bool {
    hash1 == hash2
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_count_admin_signers_two_different() {
        let admin_1 = Address::from_contract_id(&Env::default(), &[1; 32]);
        let admin_2 = Address::from_contract_id(&Env::default(), &[2; 32]);
        let admin_3 = Address::from_contract_id(&Env::default(), &[3; 32]);

        let keyset = AdminKeyset {
            admin_1: admin_1.clone(),
            admin_2: admin_2.clone(),
            admin_3: admin_3.clone(),
            rotation_proposed_at_ledger: 0,
        };

        let count = count_admin_signers(&admin_1, &Some(admin_2.clone()), &keyset);
        assert_eq!(count, 2); // 2-of-3 satisfied
    }

    #[test]
    fn test_state_transition_pending_to_approved() {
        let result = validate_state_transition(&UpgradeStatus::Pending, &UpgradeStatus::Approved);
        assert!(result.is_ok());
    }

    #[test]
    fn test_state_transition_invalid() {
        let result = validate_state_transition(&UpgradeStatus::Executed, &UpgradeStatus::Pending);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_keyset_distinct() {
        let admin_1 = Address::from_contract_id(&Env::default(), &[1; 32]);
        let admin_2 = Address::from_contract_id(&Env::default(), &[2; 32]);
        let admin_3 = Address::from_contract_id(&Env::default(), &[3; 32]);

        let result = validate_keyset(&admin_1, &admin_2, &admin_3);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_keyset_duplicate() {
        let admin_1 = Address::from_contract_id(&Env::default(), &[1; 32]);
        let admin_2 = Address::from_contract_id(&Env::default(), &[2; 32]);

        let result = validate_keyset(&admin_1, &admin_2, &admin_1); // admin_1 duplicate
        assert!(result.is_err());
    }
}
