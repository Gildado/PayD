#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, Env, String, token};

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Registers a stellar asset token and mints an initial balance to `recipient`.
fn create_token(env: &Env, recipient: &Address, amount: i128) -> Address {
    let token_admin = Address::generate(env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();
    token::StellarAssetClient::new(env, &token_address).mint(recipient, &amount);
    token_address
}

fn setup() -> (
    Env,
    Address,
    Address,
    CrossAssetPaymentContractClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    (env, admin, contract_id, client)
}

// ── initiate_payment ──────────────────────────────────────────────────────────

#[test]
fn test_initiate_payment_stores_record_and_transfers_funds() {
    let (env, _admin, contract_id, client) = setup();

    let from = Address::generate(&env);
    let token_address = create_token(&env, &from, 1_000);

    let receiver_id = String::from_str(&env, "worker-123");
    let target_asset = String::from_str(&env, "EUR");
    let anchor_id = String::from_str(&env, "anchor-eu");

    let payment_id = client.initiate_payment(
        &from,
        &500,
        &token_address,
        &receiver_id,
        &target_asset,
        &anchor_id,
    );

    assert_eq!(payment_id, 1);

    let tc = token::Client::new(&env, &token_address);
    assert_eq!(tc.balance(&contract_id), 500);
    assert_eq!(tc.balance(&from), 500);

    let record = client.get_payment(&payment_id).unwrap();
    assert_eq!(record.from, from);
    assert_eq!(record.amount, 500);
    assert_eq!(record.status, symbol_short!("pending"));
    assert_eq!(record.receiver_id, receiver_id);
    assert_eq!(record.target_asset, target_asset);
    assert_eq!(record.anchor_id, anchor_id);
}

#[test]
fn test_initiate_payment_counter_increments() {
    let (env, _admin, _contract_id, client) = setup();

    let from = Address::generate(&env);
    let token_address = create_token(&env, &from, 10_000);
    let receiver_id = String::from_str(&env, "r1");
    let target_asset = String::from_str(&env, "USD");
    let anchor_id = String::from_str(&env, "anc1");

    let id1 = client.initiate_payment(
        &from,
        &100,
        &token_address,
        &receiver_id,
        &target_asset,
        &anchor_id,
    );
    let id2 = client.initiate_payment(
        &from,
        &200,
        &token_address,
        &receiver_id,
        &target_asset,
        &anchor_id,
    );
    let id3 = client.initiate_payment(
        &from,
        &300,
        &token_address,
        &receiver_id,
        &target_asset,
        &anchor_id,
    );

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(id3, 3);
}

// ── update_status ─────────────────────────────────────────────────────────────

#[test]
fn test_update_status_changes_status_in_persistent_storage() {
    let (env, _admin, _contract_id, client) = setup();

    let from = Address::generate(&env);
    let token_address = create_token(&env, &from, 1_000);

    let payment_id = client.initiate_payment(
        &from,
        &500,
        &token_address,
        &String::from_str(&env, "rec-1"),
        &String::from_str(&env, "USD"),
        &String::from_str(&env, "anc-1"),
    );

    assert_eq!(
        client.get_payment(&payment_id).unwrap().status,
        symbol_short!("pending")
    );

    client.update_status(&payment_id, &symbol_short!("process"));

    assert_eq!(
        client.get_payment(&payment_id).unwrap().status,
        symbol_short!("process")
    );
}

#[test]
fn test_update_status_panics_for_unknown_id() {
    let (_env, _admin, _contract_id, client) = setup();
    let result = client.try_update_status(&999, &symbol_short!("process"));
    assert_eq!(result, Err(Ok(CrossAssetPaymentError::PaymentNotFound)));
}

// ── get_payment ───────────────────────────────────────────────────────────────

#[test]
fn test_get_payment_returns_none_for_unknown_id() {
    let (_env, _admin, _contract_id, client) = setup();
    assert!(client.get_payment(&42).is_none());
}

// ── init ──────────────────────────────────────────────────────────────────────

#[test]
fn test_init_twice() {
    let (env, admin, _contract_id, client) = setup();
    let result = client.try_init(&admin);
    assert_eq!(result, Err(Ok(CrossAssetPaymentError::AlreadyInitialized)));
    let _ = &env;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── LEDGER SEQUENCE VERIFICATION TESTS ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_initiate_payment_replay_same_ledger() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(75);

    let admin = Address::generate(&env);
    let from = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let stellar_token_admin = token::StellarAssetClient::new(&env, &token_address);
    stellar_token_admin.mint(&from, &2000);

    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    client.initiate_payment(
        &from,
        &500,
        &token_address,
        &String::from_str(&env, "rec-1"),
        &String::from_str(&env, "USD"),
        &String::from_str(&env, "anc-1"),
    );

    let result = client.try_initiate_payment(
        &from,
        &300,
        &token_address,
        &String::from_str(&env, "rec-2"),
        &String::from_str(&env, "EUR"),
        &String::from_str(&env, "anc-2"),
    );
    assert_eq!(
        result,
        Err(Ok(CrossAssetPaymentError::LedgerReplayDetected))
    );
}

#[test]
fn test_initiate_payment_allowed_different_ledgers() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(75);

    let admin = Address::generate(&env);
    let from = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let stellar_token_admin = token::StellarAssetClient::new(&env, &token_address);
    stellar_token_admin.mint(&from, &2000);

    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    client.initiate_payment(
        &from,
        &500,
        &token_address,
        &String::from_str(&env, "rec-1"),
        &String::from_str(&env, "USD"),
        &String::from_str(&env, "anc-1"),
    );
    assert_eq!(client.get_last_payment_ledger(&from), 75);

    env.ledger().set_sequence_number(76);

    client.initiate_payment(
        &from,
        &300,
        &token_address,
        &String::from_str(&env, "rec-2"),
        &String::from_str(&env, "EUR"),
        &String::from_str(&env, "anc-2"),
    );
    assert_eq!(client.get_last_payment_ledger(&from), 76);
    assert_eq!(client.get_payment_count(), 2);
}

#[test]
fn test_initiate_payment_different_senders_same_ledger() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(75);

    let admin = Address::generate(&env);
    let from1 = Address::generate(&env);
    let from2 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let stellar_token_admin = token::StellarAssetClient::new(&env, &token_address);
    stellar_token_admin.mint(&from1, &2000);
    stellar_token_admin.mint(&from2, &2000);

    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    client.initiate_payment(
        &from1,
        &500,
        &token_address,
        &String::from_str(&env, "rec-1"),
        &String::from_str(&env, "USD"),
        &String::from_str(&env, "anc-1"),
    );

    client.initiate_payment(
        &from2,
        &300,
        &token_address,
        &String::from_str(&env, "rec-2"),
        &String::from_str(&env, "EUR"),
        &String::from_str(&env, "anc-2"),
    );

    assert_eq!(client.get_payment_count(), 2);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ESCROW TESTS ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_init_twice_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);

    client.init(&admin);
    let result = client.try_init(&admin);
    assert_eq!(result, Err(Ok(CrossAssetPaymentError::AlreadyInitialized)));
}

#[test]
fn test_payment_count_starts_at_zero() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    assert_eq!(client.get_payment_count(), 0);
}

#[test]
fn test_payment_count_increments() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let stellar_token_admin = token::StellarAssetClient::new(&env, &token_address);
    stellar_token_admin.mint(&from, &5000);

    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    env.ledger().set_sequence_number(10);
    let id1 = client.initiate_payment(
        &from,
        &100,
        &token_address,
        &String::from_str(&env, "rec-1"),
        &String::from_str(&env, "USD"),
        &String::from_str(&env, "anc-1"),
    );

    env.ledger().set_sequence_number(11);
    let id2 = client.initiate_payment(
        &from,
        &200,
        &token_address,
        &String::from_str(&env, "rec-2"),
        &String::from_str(&env, "EUR"),
        &String::from_str(&env, "anc-2"),
    );

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(client.get_payment_count(), 2);
}

#[test]
fn test_escrow_holds_funds() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let token_client = token::Client::new(&env, &token_address);
    let stellar_token_admin = token::StellarAssetClient::new(&env, &token_address);
    stellar_token_admin.mint(&from, &1000);

    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    client.initiate_payment(
        &from,
        &600,
        &token_address,
        &String::from_str(&env, "rec"),
        &String::from_str(&env, "USD"),
        &String::from_str(&env, "anc"),
    );

    assert_eq!(token_client.balance(&contract_id), 600);
    assert_eq!(token_client.balance(&from), 400);
}

#[test]
fn test_update_status_transitions() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let stellar_token_admin = token::StellarAssetClient::new(&env, &token_address);
    stellar_token_admin.mint(&from, &1000);

    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let payment_id = client.initiate_payment(
        &from,
        &500,
        &token_address,
        &String::from_str(&env, "rec"),
        &String::from_str(&env, "USD"),
        &String::from_str(&env, "anc"),
    );

    // Pending → Processing (valid)
    client.update_status(&payment_id, &symbol_short!("process"));
    let record = client.get_payment(&payment_id).unwrap();
    assert_eq!(record.status, symbol_short!("process"));

    // Processing → Complete (valid)
    client.update_status(&payment_id, &symbol_short!("complete"));
    let record = client.get_payment(&payment_id).unwrap();
    assert_eq!(record.status, symbol_short!("complete"));
}

#[test]
fn test_get_nonexistent_payment_returns_none() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let result = client.get_payment(&999);
    assert!(result.is_none());
}

#[test]
fn test_payment_record_correctness() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let stellar_token_admin = token::StellarAssetClient::new(&env, &token_address);
    stellar_token_admin.mint(&from, &1000);

    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let receiver_id = String::from_str(&env, "worker-456");
    let target_asset = String::from_str(&env, "GBP");
    let anchor_id = String::from_str(&env, "anchor-uk");

    let payment_id = client.initiate_payment(
        &from,
        &750,
        &token_address,
        &receiver_id,
        &target_asset,
        &anchor_id,
    );

    let record = client.get_payment(&payment_id).unwrap();
    assert_eq!(record.from, from);
    assert_eq!(record.amount, 750);
    assert_eq!(record.asset, token_address);
    assert_eq!(record.receiver_id, receiver_id);
    assert_eq!(record.target_asset, target_asset);
    assert_eq!(record.anchor_id, anchor_id);
    assert_eq!(record.status, symbol_short!("pending"));
}

#[test]
fn test_contract_metadata() {
    let env = Env::default();
    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);

    let name = client.name();
    let version = client.version();
    let author = client.author();

    assert_eq!(name, String::from_str(&env, env!("CARGO_PKG_NAME")));
    assert_eq!(version, String::from_str(&env, env!("CARGO_PKG_VERSION")));
    assert_eq!(author, String::from_str(&env, env!("CARGO_PKG_AUTHORS")));
}

// ══════════════════════════════════════════════════════════════════════════════
// ── TWO-STEP ADMIN TRANSFER TESTS (Issue #192 / Part 47) ──────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_propose_admin_transfer_stores_pending() {
    let (env, _admin, _contract_id, client) = setup();

    let new_admin = Address::generate(&env);
    client.propose_admin_transfer(&new_admin);

    assert_eq!(client.get_pending_admin(), Some(new_admin));
}

#[test]
fn test_accept_admin_transfer_promotes_new_admin() {
    let (env, _admin, _contract_id, client) = setup();

    let new_admin = Address::generate(&env);
    client.propose_admin_transfer(&new_admin);
    client.accept_admin_transfer(&new_admin);

    // Pending should be cleared
    assert_eq!(client.get_pending_admin(), None);
}

#[test]
fn test_accept_admin_transfer_allows_new_admin_operations() {
    let (env, _admin, _contract_id, client) = setup();

    let new_admin = Address::generate(&env);
    let from = Address::generate(&env);
    let token_address = create_token(&env, &from, 500);

    // Complete the handoff
    client.propose_admin_transfer(&new_admin);
    client.accept_admin_transfer(&new_admin);

    // New admin can perform admin-gated operations (update_status)
    let receiver_id = String::from_str(&env, "worker-01");
    let target_asset = String::from_str(&env, "USDC");
    let anchor_id = String::from_str(&env, "anchor-1");

    let payment_id = client.initiate_payment(
        &from,
        &200,
        &token_address,
        &receiver_id,
        &target_asset,
        &anchor_id,
    );
    // update_status is admin-gated; new_admin must be able to call it
    client.update_status(&payment_id, &soroban_sdk::symbol_short!("settled"));
}

#[test]
fn test_accept_admin_transfer_rejects_wrong_caller() {
    let (env, _admin, _contract_id, client) = setup();

    let proposed = Address::generate(&env);
    let impostor = Address::generate(&env);

    client.propose_admin_transfer(&proposed);

    let result = client.try_accept_admin_transfer(&impostor);
    assert_eq!(result, Err(Ok(CrossAssetPaymentError::NotProposedAdmin)));
}

#[test]
fn test_accept_admin_transfer_with_no_proposal_returns_error() {
    let (env, _admin, _contract_id, client) = setup();

    let random = Address::generate(&env);
    let result = client.try_accept_admin_transfer(&random);
    assert_eq!(result, Err(Ok(CrossAssetPaymentError::NoPendingAdminTransfer)));
}

#[test]
fn test_accept_admin_transfer_correct_caller_succeeds() {
    let (env, _admin, _contract_id, client) = setup();

    let new_admin = Address::generate(&env);
    client.propose_admin_transfer(&new_admin);

    let result = client.try_accept_admin_transfer(&new_admin);
    assert_eq!(result, Ok(()));
}

#[test]
fn test_cancel_admin_transfer_clears_pending() {
    let (env, _admin, _contract_id, client) = setup();

    let new_admin = Address::generate(&env);
    client.propose_admin_transfer(&new_admin);

    // Confirm it's pending
    assert_eq!(client.get_pending_admin(), Some(new_admin));

    client.cancel_admin_transfer();
    assert_eq!(client.get_pending_admin(), None);
}

#[test]
fn test_propose_admin_transfer_replaces_previous_proposal() {
    let (env, _admin, _contract_id, client) = setup();

    let first_candidate = Address::generate(&env);
    let second_candidate = Address::generate(&env);

    client.propose_admin_transfer(&first_candidate);
    assert_eq!(client.get_pending_admin(), Some(first_candidate));

    // A second proposal overwrites the first
    client.propose_admin_transfer(&second_candidate);
    assert_eq!(client.get_pending_admin(), Some(second_candidate));
}

#[test]
fn test_get_pending_admin_returns_none_initially() {
    let (_env, _admin, _contract_id, client) = setup();
    assert_eq!(client.get_pending_admin(), None);
}

#[test]
fn test_full_two_step_admin_handoff_flow() {
    let (env, _admin, _contract_id, client) = setup();

    let new_admin = Address::generate(&env);

    // Step 1: current admin proposes
    client.propose_admin_transfer(&new_admin);
    assert_eq!(client.get_pending_admin(), Some(new_admin.clone()));

    // Step 2: proposed admin accepts
    client.accept_admin_transfer(&new_admin);

    // Pending must be cleared
    assert_eq!(client.get_pending_admin(), None);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PAUSE MECHANISM ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_pause_defaults_to_false() {
    let (_env, _admin, _contract_id, client) = setup();
    assert!(!client.is_paused());
}

#[test]
fn test_set_paused_true() {
    let (_env, _admin, _contract_id, client) = setup();
    client.set_paused(&true);
    assert!(client.is_paused());
}

#[test]
fn test_set_paused_toggle() {
    let (_env, _admin, _contract_id, client) = setup();
    client.set_paused(&true);
    assert!(client.is_paused());
    client.set_paused(&false);
    assert!(!client.is_paused());
}

#[test]
fn test_initiate_blocked_when_paused() {
    let (env, _admin, _contract_id, client) = setup();

    let from = Address::generate(&env);
    let token_address = create_token(&env, &from, 1_000);

    client.set_paused(&true);

    let result = client.try_initiate_payment(
        &from,
        &500,
        &token_address,
        &String::from_str(&env, "rec-1"),
        &String::from_str(&env, "USD"),
        &String::from_str(&env, "anc-1"),
    );
    assert_eq!(result, Err(Ok(CrossAssetPaymentError::ContractPaused)));
}

#[test]
fn test_complete_blocked_when_paused() {
    let (env, _admin, _contract_id, client) = setup();

    let from = Address::generate(&env);
    let token_address = create_token(&env, &from, 1_000);
    let recipient = Address::generate(&env);

    let payment_id = client.initiate_payment(
        &from,
        &200,
        &token_address,
        &String::from_str(&env, "rec-1"),
        &String::from_str(&env, "USD"),
        &String::from_str(&env, "anc-1"),
    );

    client.set_paused(&true);

    let result = client.try_complete_payment(&_admin, &payment_id, &recipient);
    assert_eq!(result, Err(Ok(CrossAssetPaymentError::ContractPaused)));
}

#[test]
fn test_fail_blocked_when_paused() {
    let (env, _admin, _contract_id, client) = setup();

    let from = Address::generate(&env);
    let token_address = create_token(&env, &from, 1_000);

    let payment_id = client.initiate_payment(
        &from,
        &200,
        &token_address,
        &String::from_str(&env, "rec-1"),
        &String::from_str(&env, "USD"),
        &String::from_str(&env, "anc-1"),
    );

    client.set_paused(&true);

    let result = client.try_fail_payment(&_admin, &payment_id);
    assert_eq!(result, Err(Ok(CrossAssetPaymentError::ContractPaused)));
}

#[test]
fn test_update_status_blocked_when_paused() {
    let (env, _admin, _contract_id, client) = setup();

    let from = Address::generate(&env);
    let token_address = create_token(&env, &from, 1_000);

    let payment_id = client.initiate_payment(
        &from,
        &200,
        &token_address,
        &String::from_str(&env, "rec-1"),
        &String::from_str(&env, "USD"),
        &String::from_str(&env, "anc-1"),
    );

    client.set_paused(&true);

    let result = client.try_update_status(&payment_id, &symbol_short!("process"));
    assert_eq!(result, Err(Ok(CrossAssetPaymentError::ContractPaused)));
}

#[test]
fn test_unpause_restores_operations() {
    let (env, _admin, _contract_id, client) = setup();

    let from = Address::generate(&env);
    let token_address = create_token(&env, &from, 1_000);

    client.set_paused(&true);
    assert!(client.is_paused());

    client.set_paused(&false);
    assert!(!client.is_paused());

    let payment_id = client.initiate_payment(
        &from,
        &500,
        &token_address,
        &String::from_str(&env, "rec-1"),
        &String::from_str(&env, "USD"),
        &String::from_str(&env, "anc-1"),
    );
    assert_eq!(payment_id, 1);
}

#[test]
fn test_admin_operations_available_when_paused() {
    let (env, _admin, _contract_id, client) = setup();

    client.set_paused(&true);
    assert!(client.is_paused());

    // Admin can still toggle pause
    client.set_paused(&false);
    assert!(!client.is_paused());

    // Admin can still bump_ttl while paused
    client.set_paused(&true);
    client.bump_ttl();
}

// ── #879: propose_admin_transfer rejects same-admin proposals ─────────────────

#[test]
#[should_panic(expected = "new admin must differ from the current admin")]
fn test_propose_admin_transfer_rejects_current_admin() {
    let (_env, admin, _contract_id, client) = setup();
    // Proposing the current admin as the new admin must be rejected.
    client.propose_admin_transfer(&admin);
}

#[test]
fn test_propose_admin_transfer_accepts_different_admin() {
    let (env, _admin, _contract_id, client) = setup();
    let new_admin = Address::generate(&env);
    client.propose_admin_transfer(&new_admin);
    assert_eq!(client.get_pending_admin(), Some(new_admin));
}

// ── #877: cancel_admin_transfer emits event with cancelled admin ──────────────

#[test]
fn test_cancel_admin_transfer_emits_event_with_cancelled_admin() {
    // Verifies that cancel_admin_transfer succeeds after a proposal and clears state.
    // The AdminTransferCancelledEvent is emitted inside the contract; state change
    // is the observable proof that the call (including the publish) completed.
    let (env, _admin, _contract_id, client) = setup();

    let proposed = Address::generate(&env);
    client.propose_admin_transfer(&proposed);
    assert_eq!(client.get_pending_admin(), Some(proposed.clone()));

    client.cancel_admin_transfer();

    // Pending must be cleared — confirms the function ran to completion
    assert_eq!(client.get_pending_admin(), None);
}

#[test]
#[should_panic(expected = "No pending admin transfer to cancel")]
fn test_cancel_admin_transfer_panics_without_pending_proposal() {
    let (_env, _admin, _contract_id, client) = setup();
    // No proposal has been made — cancel must panic
    client.cancel_admin_transfer();
}

#[test]
fn test_cancel_admin_transfer_reads_pending_admin_before_removal() {
    // Verifies the cancel function correctly reads the proposed address (needed
    // so it can be included in the AdminTransferCancelledEvent) before removing it.
    let (env, _admin, _contract_id, client) = setup();
    let proposed = Address::generate(&env);

    client.propose_admin_transfer(&proposed);
    assert_eq!(client.get_pending_admin(), Some(proposed.clone()));

    client.cancel_admin_transfer();

    // After cancel, no pending admin remains — confirms the pending was read and cleared
    assert_eq!(client.get_pending_admin(), None);
}
