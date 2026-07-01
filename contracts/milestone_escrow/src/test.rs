#![cfg(test)]
use super::*;
use soroban_sdk::{
    Address, Env, String, Vec,
    testutils::{Address as _, Ledger},
    token,
};

fn setup() -> (
    Env,
    Address,
    Address,
    Address,
    Address,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
    MilestoneEscrowContractClient<'static>,
) {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let beneficiary = Address::generate(&e);
    let verifier = Address::generate(&e);

    let token_admin = Address::generate(&e);
    let token_id = e
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let token_client = token::Client::new(&e, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&e, &token_id);
    token_admin_client.mint(&sender, &1_000_000);

    let contract_id = e.register(MilestoneEscrowContract, ());
    let client = MilestoneEscrowContractClient::new(&e, &contract_id);
    client.initialize(&admin);

    (
        e,
        sender,
        beneficiary,
        verifier,
        token_id,
        token_client,
        token_admin_client,
        client,
    )
}

fn make_milestones(e: &Env, amounts: &[i128]) -> Vec<Milestone> {
    let mut milestones: Vec<Milestone> = Vec::new(e);
    for (i, &amount) in amounts.iter().enumerate() {
        let desc = match i {
            0 => String::from_str(e, "M1"),
            1 => String::from_str(e, "M2"),
            2 => String::from_str(e, "M3"),
            3 => String::from_str(e, "M4"),
            _ => String::from_str(e, "MN"),
        };
        milestones.push_back(Milestone {
            description: desc,
            amount,
            status: MilestoneStatus::Pending,
        });
    }
    milestones
}

fn create_default_escrow(
    client: &MilestoneEscrowContractClient,
    env: &Env,
    sender: &Address,
    beneficiary: &Address,
    verifier: &Address,
    token: &Address,
) -> u64 {
    let milestones = make_milestones(env, &[1000, 2000, 3000]);
    client.create_escrow(sender, beneficiary, verifier, token, &milestones)
}

// ==============================================================================
// -- ERROR MAP -----------------------------------------------------------------
// ==============================================================================
// AlreadyInitialized       = 1  -> Error(Contract, #1)
// NotInitialized           = 2  -> Error(Contract, #2)
// Unauthorized             = 3  -> Error(Contract, #3)
// InvalidAmount            = 4  -> Error(Contract, #4)
// EscrowNotFound           = 5  -> Error(Contract, #5)
// EscrowInactive           = 6  -> Error(Contract, #6)
// MilestoneNotFound        = 7  -> Error(Contract, #7)
// MilestoneAlreadyApproved = 8  -> Error(Contract, #8)
// MilestoneNotApproved     = 9  -> Error(Contract, #9)
// InvalidMilestones        = 10 -> Error(Contract, #10)
// ContractPaused           = 11 -> Error(Contract, #11)
// LedgerReplayDetected     = 12 -> Error(Contract, #12)
// SameAdmin                = 13 -> Error(Contract, #13)
// NotVerifier              = 14 -> Error(Contract, #14)
// InsufficientFunds        = 15 -> Error(Contract, #15)
// InsufficientEscrowBalance = 16 -> Error(Contract, #16)

// ==============================================================================
// -- INITIALIZATION TESTS ------------------------------------------------------
// ==============================================================================

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_initialize_twice_panics() {
    let (e, _, _, _, _, _, _, client) = setup();
    client.initialize(&Address::generate(&e));
}

#[test]
fn test_initialize_sets_admin_and_count() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let contract_id = e.register(MilestoneEscrowContract, ());
    let client2 = MilestoneEscrowContractClient::new(&e, &contract_id);
    client2.initialize(&admin);

    assert_eq!(client2.get_admin(), admin);
    assert_eq!(client2.get_escrow_count(), 0);
}

// ==============================================================================
// -- METADATA TESTS ------------------------------------------------------------
// ==============================================================================

#[test]
fn test_metadata_name_is_set() {
    let (_e, _, _, _, _, _, _, client) = setup();
    let name = client.name();
    assert!(name.len() > 0);
}

#[test]
fn test_metadata_version_is_set() {
    let (_e, _, _, _, _, _, _, client) = setup();
    let version = client.version();
    assert!(version.len() > 0);
}

#[test]
fn test_metadata_author_is_set() {
    let (_e, _, _, _, _, _, _, client) = setup();
    let author = client.author();
    assert!(author.len() > 0);
}

// ==============================================================================
// -- ADMIN TESTS ---------------------------------------------------------------
// ==============================================================================

#[test]
fn test_set_admin_success() {
    let e2 = Env::default();
    e2.mock_all_auths();
    let admin = Address::generate(&e2);
    let contract_id = e2.register(MilestoneEscrowContract, ());
    let client2 = MilestoneEscrowContractClient::new(&e2, &contract_id);
    client2.initialize(&admin);
    let new_admin = Address::generate(&e2);

    assert_eq!(client2.get_admin(), admin);
    client2.set_admin(&new_admin);
    assert_eq!(client2.get_admin(), new_admin);
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn test_set_admin_same_admin_panics() {
    let e2 = Env::default();
    e2.mock_all_auths();
    let admin = Address::generate(&e2);
    let contract_id = e2.register(MilestoneEscrowContract, ());
    let client2 = MilestoneEscrowContractClient::new(&e2, &contract_id);
    client2.initialize(&admin);
    client2.set_admin(&admin);
}

// ==============================================================================
// -- CIRCUIT BREAKER TESTS -----------------------------------------------------
// ==============================================================================

#[test]
fn test_pause_unpause() {
    let (_e, _, _, _, _, _, _, client) = setup();
    assert!(!client.is_paused());
    client.set_paused(&true);
    assert!(client.is_paused());
    client.set_paused(&false);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn test_create_escrow_when_paused_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    client.set_paused(&true);
    let milestones = make_milestones(&e, &[1000]);
    client.create_escrow(&sender, &beneficiary, &verifier, &token, &milestones);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn test_approve_milestone_when_paused_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);
    client.set_paused(&true);
    client.approve_milestone(&escrow_id, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn test_release_milestone_when_paused_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);
    client.approve_milestone(&escrow_id, &0);
    client.set_paused(&true);
    client.release_milestone(&escrow_id, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn test_cancel_escrow_when_paused_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);
    client.set_paused(&true);
    client.cancel_escrow(&escrow_id);
}

// ==============================================================================
// -- ESCROW CREATION TESTS -----------------------------------------------------
// ==============================================================================

#[test]
fn test_create_escrow_success() {
    let (e, sender, beneficiary, verifier, token, token_client, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    let record = client.get_escrow(&escrow_id);
    assert_eq!(record.sender, sender);
    assert_eq!(record.beneficiary, beneficiary);
    assert_eq!(record.verifier, verifier);
    assert_eq!(record.token, token);
    assert_eq!(record.total_amount, 6000);
    assert_eq!(record.released_amount, 0);
    assert!(record.is_active);
    assert_eq!(record.milestones.len(), 3);

    assert_eq!(token_client.balance(&sender), 1_000_000 - 6000);
}

#[test]
fn test_create_multiple_escrows() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();

    let id1 = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);
    let milestones2 = make_milestones(&e, &[500, 1500]);
    let id2 = client.create_escrow(&sender, &beneficiary, &verifier, &token, &milestones2);

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(client.get_escrow_count(), 2);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_create_escrow_empty_milestones_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let milestones: Vec<Milestone> = Vec::new(&e);
    client.create_escrow(&sender, &beneficiary, &verifier, &token, &milestones);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_create_escrow_too_many_milestones_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let mut milestones: Vec<Milestone> = Vec::new(&e);
    for _i in 0..51 {
        milestones.push_back(Milestone {
            description: String::from_str(&e, "M"),
            amount: 10,
            status: MilestoneStatus::Pending,
        });
    }
    client.create_escrow(&sender, &beneficiary, &verifier, &token, &milestones);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_create_escrow_zero_amount_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let milestones = make_milestones(&e, &[1000, 0, 3000]);
    client.create_escrow(&sender, &beneficiary, &verifier, &token, &milestones);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_create_escrow_negative_amount_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let milestones = make_milestones(&e, &[-500]);
    client.create_escrow(&sender, &beneficiary, &verifier, &token, &milestones);
}

// ==============================================================================
// -- MILESTONE APPROVAL TESTS --------------------------------------------------
// ==============================================================================

#[test]
fn test_approve_milestone_success() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    client.approve_milestone(&escrow_id, &0);

    let record = client.get_escrow(&escrow_id);
    let m = record.milestones.get(0).unwrap();
    assert!(matches!(m.status, MilestoneStatus::Approved));
}

#[test]
fn test_approve_multiple_milestones() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    e.ledger().set_sequence_number(1);
    client.approve_milestone(&escrow_id, &0);
    e.ledger().set_sequence_number(2);
    client.approve_milestone(&escrow_id, &1);
    e.ledger().set_sequence_number(3);
    client.approve_milestone(&escrow_id, &2);

    let record = client.get_escrow(&escrow_id);
    for i in 0..3 {
        let m = record.milestones.get(i).unwrap();
        assert!(matches!(m.status, MilestoneStatus::Approved));
    }
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_approve_already_approved_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    client.approve_milestone(&escrow_id, &0);
    client.approve_milestone(&escrow_id, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_approve_released_milestone_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    client.approve_milestone(&escrow_id, &0);
    client.release_milestone(&escrow_id, &0);
    client.approve_milestone(&escrow_id, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_approve_nonexistent_escrow_panics() {
    let (_e, _, _, _verifier, _, _, _, client) = setup();
    client.approve_milestone(&999, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_approve_nonexistent_milestone_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);
    client.approve_milestone(&escrow_id, &5);
}

// ==============================================================================
// -- MILESTONE RELEASE TESTS ---------------------------------------------------
// ==============================================================================

#[test]
fn test_release_milestone_success() {
    let (e, sender, beneficiary, verifier, token, token_client, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    client.approve_milestone(&escrow_id, &0);
    client.release_milestone(&escrow_id, &0);

    let record = client.get_escrow(&escrow_id);
    let m = record.milestones.get(0).unwrap();
    assert!(matches!(m.status, MilestoneStatus::Released));
    assert_eq!(record.released_amount, 1000);

    assert_eq!(token_client.balance(&beneficiary), 1000);
}

#[test]
fn test_release_all_milestones() {
    let (e, sender, beneficiary, verifier, token, token_client, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    client.approve_milestone(&escrow_id, &0);
    client.approve_milestone(&escrow_id, &1);
    client.approve_milestone(&escrow_id, &2);

    client.release_milestone(&escrow_id, &0);
    client.release_milestone(&escrow_id, &1);
    client.release_milestone(&escrow_id, &2);

    let record = client.get_escrow(&escrow_id);
    assert_eq!(record.released_amount, 6000);
    assert!(!record.is_active);

    assert_eq!(token_client.balance(&beneficiary), 6000);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_release_not_approved_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);
    client.release_milestone(&escrow_id, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_release_already_released_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    client.approve_milestone(&escrow_id, &0);
    client.release_milestone(&escrow_id, &0);
    client.release_milestone(&escrow_id, &0);
}

// ==============================================================================
// -- ESCROW CANCELLATION TESTS -------------------------------------------------
// ==============================================================================

#[test]
fn test_cancel_escrow_no_releases() {
    let (e, sender, beneficiary, verifier, token, token_client, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    client.cancel_escrow(&escrow_id);

    let record = client.get_escrow(&escrow_id);
    assert!(!record.is_active);
    assert_eq!(record.released_amount, 0);

    assert_eq!(token_client.balance(&sender), 1_000_000);
}

#[test]
fn test_cancel_escrow_partial_release() {
    let (e, sender, beneficiary, verifier, token, token_client, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    client.approve_milestone(&escrow_id, &0);
    client.release_milestone(&escrow_id, &0);

    client.cancel_escrow(&escrow_id);

    let record = client.get_escrow(&escrow_id);
    assert!(!record.is_active);
    assert_eq!(record.released_amount, 1000);

    assert_eq!(token_client.balance(&beneficiary), 1000);
    assert_eq!(token_client.balance(&sender), 1_000_000 - 1000);
}

#[test]
fn test_cancel_escrow_with_approved_but_not_released() {
    let (e, sender, beneficiary, verifier, token, token_client, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    client.approve_milestone(&escrow_id, &0);
    client.approve_milestone(&escrow_id, &1);

    client.cancel_escrow(&escrow_id);

    let record = client.get_escrow(&escrow_id);
    assert!(!record.is_active);
    assert_eq!(record.released_amount, 0);

    assert_eq!(token_client.balance(&beneficiary), 0);
    assert_eq!(token_client.balance(&sender), 1_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_cancel_already_cancelled_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);
    client.cancel_escrow(&escrow_id);
    client.cancel_escrow(&escrow_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_cancel_fully_released_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    client.approve_milestone(&escrow_id, &0);
    client.approve_milestone(&escrow_id, &1);
    client.approve_milestone(&escrow_id, &2);

    client.release_milestone(&escrow_id, &0);
    client.release_milestone(&escrow_id, &1);
    client.release_milestone(&escrow_id, &2);

    client.cancel_escrow(&escrow_id);
}

// ==============================================================================
// -- QUERY TESTS ---------------------------------------------------------------
// ==============================================================================

#[test]
fn test_get_escrow_count() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    assert_eq!(client.get_escrow_count(), 0);

    create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);
    assert_eq!(client.get_escrow_count(), 1);

    create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);
    assert_eq!(client.get_escrow_count(), 2);
}

#[test]
fn test_get_releasable_amount() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    assert_eq!(client.get_releasable_amount(&escrow_id), 0);

    client.approve_milestone(&escrow_id, &0);
    assert_eq!(client.get_releasable_amount(&escrow_id), 1000);

    client.approve_milestone(&escrow_id, &1);
    assert_eq!(client.get_releasable_amount(&escrow_id), 3000);

    client.release_milestone(&escrow_id, &0);
    assert_eq!(client.get_releasable_amount(&escrow_id), 2000);

    client.release_milestone(&escrow_id, &1);
    assert_eq!(client.get_releasable_amount(&escrow_id), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_get_escrow_nonexistent_panics() {
    let (_e, _, _, _, _, _, _, client) = setup();
    client.get_escrow(&999);
}

// ==============================================================================
// -- REPLAY PROTECTION TESTS ---------------------------------------------------
// ==============================================================================

#[test]
#[should_panic(expected = "Error(Contract, #12)")]
fn test_approve_same_ledger_replay_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    e.ledger().set_sequence_number(1);
    client.approve_milestone(&escrow_id, &0);
    client.approve_milestone(&escrow_id, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")]
fn test_release_same_ledger_replay_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    e.ledger().set_sequence_number(1);
    client.approve_milestone(&escrow_id, &0);
    client.release_milestone(&escrow_id, &0);
    client.release_milestone(&escrow_id, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_cancel_same_ledger_replay_panics() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    e.ledger().set_sequence_number(1);
    client.cancel_escrow(&escrow_id);
    client.cancel_escrow(&escrow_id);
}

// ==============================================================================
// -- EDGE CASE TESTS -----------------------------------------------------------
// ==============================================================================

#[test]
fn test_approve_across_ledgers_succeeds() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    e.ledger().set_sequence_number(1);
    client.approve_milestone(&escrow_id, &0);
    e.ledger().set_sequence_number(2);
    client.approve_milestone(&escrow_id, &1);

    let record = client.get_escrow(&escrow_id);
    assert!(matches!(
        record.milestones.get(0).unwrap().status,
        MilestoneStatus::Approved
    ));
    assert!(matches!(
        record.milestones.get(1).unwrap().status,
        MilestoneStatus::Approved
    ));
}

#[test]
fn test_single_milestone_escrow() {
    let (e, sender, beneficiary, verifier, token, token_client, _, client) = setup();
    let milestones = make_milestones(&e, &[5000]);
    let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token, &milestones);

    let record = client.get_escrow(&escrow_id);
    assert_eq!(record.total_amount, 5000);
    assert_eq!(record.milestones.len(), 1);

    client.approve_milestone(&escrow_id, &0);
    client.release_milestone(&escrow_id, &0);

    assert_eq!(token_client.balance(&beneficiary), 5000);
    assert!(!client.get_escrow(&escrow_id).is_active);
}

#[test]
fn test_escrow_created_at_timestamp() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let ts = e.ledger().timestamp();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    let record = client.get_escrow(&escrow_id);
    assert_eq!(record.created_at, ts);
}

#[test]
fn test_bump_ttl_succeeds() {
    let (_e, _, _, _, _, _, _, client) = setup();
    client.bump_ttl();
}

// ==============================================================================
// -- Issue #884: per-escrow rate-limit across different milestones --------------
// ==============================================================================

/// Two approve_milestone calls for *different* milestones in the same ledger
/// must both fail with LedgerReplayDetected (#12) because the throttle is
/// per-escrow, not per-milestone.
#[test]
#[should_panic(expected = "Error(Contract, #12)")]
fn test_approve_two_milestones_same_ledger_fails() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    e.ledger().set_sequence_number(5);
    client.approve_milestone(&escrow_id, &0);
    // Same ledger, different milestone index — must be rejected.
    client.approve_milestone(&escrow_id, &1);
}

/// Two release_milestone calls for *different* milestones in the same ledger
/// are blocked by the per-escrow throttle on LastReleaseLedger.
#[test]
#[should_panic(expected = "Error(Contract, #12)")]
fn test_release_two_milestones_same_ledger_fails() {
    let (e, sender, beneficiary, verifier, token, _, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    // Approve both milestones on separate ledgers first.
    e.ledger().set_sequence_number(1);
    client.approve_milestone(&escrow_id, &0);
    e.ledger().set_sequence_number(2);
    client.approve_milestone(&escrow_id, &1);

    // Try to release both on the same ledger — second call must fail.
    e.ledger().set_sequence_number(3);
    client.release_milestone(&escrow_id, &0);
    client.release_milestone(&escrow_id, &1);
}

// ==============================================================================
// -- Issue #882: released_amount == total_amount deactivates escrow ------------
// ==============================================================================

/// When the final release brings released_amount up to total_amount the escrow
/// must be marked inactive, even if the release order was non-sequential.
#[test]
fn test_final_release_deactivates_escrow_when_released_equals_total() {
    let (e, sender, beneficiary, verifier, token, token_client, _, client) = setup();
    // Two milestones: [2000, 4000], total = 6000.
    let milestones = make_milestones(&e, &[2000, 4000]);
    let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token, &milestones);

    // Approve and release milestone 0 — escrow still active (2000 < 6000).
    e.ledger().set_sequence_number(1);
    client.approve_milestone(&escrow_id, &0);
    e.ledger().set_sequence_number(2);
    client.release_milestone(&escrow_id, &0);
    let record = client.get_escrow(&escrow_id);
    assert!(record.is_active);
    assert_eq!(record.released_amount, 2000);

    // Approve and release milestone 1 — released_amount reaches total_amount.
    e.ledger().set_sequence_number(3);
    client.approve_milestone(&escrow_id, &1);
    e.ledger().set_sequence_number(4);
    client.release_milestone(&escrow_id, &1);

    let record = client.get_escrow(&escrow_id);
    assert_eq!(record.released_amount, 6000);
    assert_eq!(record.released_amount, record.total_amount);
    // Escrow must be inactive now that all funds are released.
    assert!(!record.is_active);
    assert_eq!(token_client.balance(&beneficiary), 6000);
}

// ==============================================================================
// -- Issue #885: cancel_escrow accounting invariant ----------------------------
// ==============================================================================

/// cancel_escrow() must compute unreleased_amount by summing non-released
/// milestones (NOT via saturating subtraction), so the recovered amount is
/// exact and never silently rounds to zero on an inconsistency.
#[test]
fn test_cancel_partial_release_unreleased_amount_is_exact() {
    let (e, sender, beneficiary, verifier, token, token_client, _, client) = setup();
    // Three milestones: [1000, 2000, 3000], total = 6000.
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    // Release only the first milestone (1000).
    client.approve_milestone(&escrow_id, &0);
    client.release_milestone(&escrow_id, &0);

    // Cancel: unreleased = 2000 + 3000 = 5000.
    client.cancel_escrow(&escrow_id);

    let record = client.get_escrow(&escrow_id);
    assert!(!record.is_active);
    // Sender recovers the exact unreleased sum, not total - released.
    assert_eq!(token_client.balance(&sender), 1_000_000 - 1000);
    assert_eq!(token_client.balance(&beneficiary), 1000);
}

/// cancel_escrow() with multiple approved (but not released) milestones returns
/// all approved-but-unreleased funds to the sender.
#[test]
fn test_cancel_with_approved_milestones_recovers_full_unreleased() {
    let (e, sender, beneficiary, verifier, token, token_client, _, client) = setup();
    let escrow_id = create_default_escrow(&client, &e, &sender, &beneficiary, &verifier, &token);

    // Approve milestones 0 and 1 but do not release either.
    client.approve_milestone(&escrow_id, &0);
    e.ledger().set_sequence_number(1);
    client.approve_milestone(&escrow_id, &1);

    client.cancel_escrow(&escrow_id);

    // All 6000 must return to sender; beneficiary gets nothing.
    assert_eq!(token_client.balance(&sender), 1_000_000);
    assert_eq!(token_client.balance(&beneficiary), 0);
}
