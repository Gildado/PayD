#![cfg(test)]

//! Unit Tests for Cross-Asset Payment Escrow Logic
//!
//! Tests escrow functionality for SEP-31 cross-asset payments including:
//! - Fund locking during payment processing
//! - Release mechanisms for completed payments
//! - Refund mechanisms for failed payments
//! - Security and edge cases

use super::*;
use soroban_sdk::{
    Address, Env, String as SorobanString,
    testutils::{Address as _, Ledger},
    token,
};

// ══════════════════════════════════════════════════════════════════════════════
// ── TEST HELPERS ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

fn setup_payment_escrow() -> (
    Env,
    Address,                                  // admin
    Address,                                  // sender
    Address,                                  // token_contract
    token::Client<'static>,                   // token_client
    token::StellarAssetClient<'static>,       // token_admin_client
    CrossAssetPaymentContractClient<'static>, // payment_client
    Address,                                  // contract_address
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);

    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    let contract_address = contract_id.clone();

    let token_admin = Address::generate(&env);
    let token_contract = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let token_client = token::Client::new(&env, &token_contract);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    // Initialize contract
    client.init(&admin);

    // Mint tokens to sender
    token_admin_client.mint(&sender, &1_000_000);

    (
        env,
        admin,
        sender,
        token_contract,
        token_client,
        token_admin_client,
        client,
        contract_address,
    )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ESCROW FUND LOCKING TESTS ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_payment_escrow_locks_funds() {
    let (env, _, sender, token_contract, token_client, _, client, contract_address) =
        setup_payment_escrow();

    let initial_balance = token_client.balance(&sender);
    let payment_amount = 10_000;

    let payment_id = client.initiate_payment(
        &sender,
        &payment_amount,
        &token_contract,
        &SorobanString::from_str(&env, "receiver-123"),
        &SorobanString::from_str(&env, "USD"),
        &SorobanString::from_str(&env, "anchor-1"),
    );

    assert_eq!(
        token_client.balance(&sender),
        initial_balance - payment_amount
    );
    assert_eq!(token_client.balance(&contract_address), payment_amount);
    assert_eq!(payment_id, 1);
}

#[test]
fn test_multiple_payments_accumulate_in_escrow() {
    let (env, _, sender, token_contract, token_client, _, client, contract_address) =
        setup_payment_escrow();

    env.ledger().set_sequence_number(10);
    client.initiate_payment(
        &sender,
        &5_000,
        &token_contract,
        &SorobanString::from_str(&env, "rec-1"),
        &SorobanString::from_str(&env, "USD"),
        &SorobanString::from_str(&env, "anc-1"),
    );

    env.ledger().set_sequence_number(11);
    client.initiate_payment(
        &sender,
        &3_000,
        &token_contract,
        &SorobanString::from_str(&env, "rec-2"),
        &SorobanString::from_str(&env, "EUR"),
        &SorobanString::from_str(&env, "anc-1"),
    );

    assert_eq!(token_client.balance(&contract_address), 8_000);
}

#[test]
fn test_escrow_holds_funds_until_completion() {
    let (env, _, sender, token_contract, token_client, _, client, contract_address) =
        setup_payment_escrow();

    let payment_id = client.initiate_payment(
        &sender,
        &15_000,
        &token_contract,
        &SorobanString::from_str(&env, "receiver"),
        &SorobanString::from_str(&env, "USD"),
        &SorobanString::from_str(&env, "anchor"),
    );

    assert_eq!(token_client.balance(&contract_address), 15_000);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, symbol_short!("pending"));
    assert_eq!(payment.amount, 15_000);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PAYMENT COMPLETION AND RELEASE TESTS ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_complete_payment_releases_funds() {
    let (env, admin, sender, token_contract, token_client, _, client, contract_address) =
        setup_payment_escrow();

    let recipient = Address::generate(&env);
    let payment_amount = 20_000;

    let payment_id = client.initiate_payment(
        &sender,
        &payment_amount,
        &token_contract,
        &SorobanString::from_str(&env, "receiver"),
        &SorobanString::from_str(&env, "USD"),
        &SorobanString::from_str(&env, "anchor"),
    );

    env.ledger().set_sequence_number(20);
    client.complete_payment(&admin, &payment_id, &recipient);

    assert_eq!(token_client.balance(&recipient), payment_amount);
    assert_eq!(token_client.balance(&contract_address), 0);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, symbol_short!("complete"));
}

#[test]
fn test_multiple_payments_released_independently() {
    let (env, admin, sender, token_contract, token_client, _, client, _) = setup_payment_escrow();

    let recipient_1 = Address::generate(&env);
    let recipient_2 = Address::generate(&env);

    env.ledger().set_sequence_number(10);
    let payment_id_1 = client.initiate_payment(
        &sender,
        &10_000,
        &token_contract,
        &SorobanString::from_str(&env, "rec-1"),
        &SorobanString::from_str(&env, "USD"),
        &SorobanString::from_str(&env, "anc"),
    );

    env.ledger().set_sequence_number(11);
    let payment_id_2 = client.initiate_payment(
        &sender,
        &15_000,
        &token_contract,
        &SorobanString::from_str(&env, "rec-2"),
        &SorobanString::from_str(&env, "EUR"),
        &SorobanString::from_str(&env, "anc"),
    );

    env.ledger().set_sequence_number(20);
    client.complete_payment(&admin, &payment_id_1, &recipient_1);
    assert_eq!(token_client.balance(&recipient_1), 10_000);

    env.ledger().set_sequence_number(21);
    client.complete_payment(&admin, &payment_id_2, &recipient_2);
    assert_eq!(token_client.balance(&recipient_2), 15_000);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PAYMENT FAILURE AND REFUND TESTS ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_fail_payment_refunds_sender() {
    let (env, admin, sender, token_contract, token_client, _, client, contract_address) =
        setup_payment_escrow();

    let initial_balance = token_client.balance(&sender);
    let payment_amount = 12_000;

    let payment_id = client.initiate_payment(
        &sender,
        &payment_amount,
        &token_contract,
        &SorobanString::from_str(&env, "receiver"),
        &SorobanString::from_str(&env, "USD"),
        &SorobanString::from_str(&env, "anchor"),
    );

    env.ledger().set_sequence_number(20);
    client.fail_payment(&admin, &payment_id);

    assert_eq!(token_client.balance(&sender), initial_balance);
    assert_eq!(token_client.balance(&contract_address), 0);

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.status, symbol_short!("failed"));
}

#[test]
fn test_partial_refund_scenario() {
    let (env, admin, sender, token_contract, token_client, _, client, _) = setup_payment_escrow();

    let recipient = Address::generate(&env);

    env.ledger().set_sequence_number(10);
    let payment_id_1 = client.initiate_payment(
        &sender,
        &8_000,
        &token_contract,
        &SorobanString::from_str(&env, "rec-1"),
        &SorobanString::from_str(&env, "USD"),
        &SorobanString::from_str(&env, "anc"),
    );

    env.ledger().set_sequence_number(11);
    let payment_id_2 = client.initiate_payment(
        &sender,
        &6_000,
        &token_contract,
        &SorobanString::from_str(&env, "rec-2"),
        &SorobanString::from_str(&env, "EUR"),
        &SorobanString::from_str(&env, "anc"),
    );

    let balance_after_escrow = token_client.balance(&sender);

    env.ledger().set_sequence_number(20);
    client.complete_payment(&admin, &payment_id_1, &recipient);

    env.ledger().set_sequence_number(21);
    client.fail_payment(&admin, &payment_id_2);

    assert_eq!(token_client.balance(&sender), balance_after_escrow + 6_000);
    assert_eq!(token_client.balance(&recipient), 8_000);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── SECURITY AND AUTHORIZATION TESTS ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_duplicate_payment_same_ledger_panics() {
    let (env, _, sender, token_contract, _, _, client, _) = setup_payment_escrow();

    env.ledger().set_sequence_number(10);

    client.initiate_payment(
        &sender,
        &5_000,
        &token_contract,
        &SorobanString::from_str(&env, "rec"),
        &SorobanString::from_str(&env, "USD"),
        &SorobanString::from_str(&env, "anc"),
    );

    let result = client.try_initiate_payment(
        &sender,
        &3_000,
        &token_contract,
        &SorobanString::from_str(&env, "rec2"),
        &SorobanString::from_str(&env, "EUR"),
        &SorobanString::from_str(&env, "anc"),
    );
    assert_eq!(
        result,
        Err(Ok(CrossAssetPaymentError::LedgerReplayDetected))
    );
}

#[test]
fn test_payments_allowed_different_ledgers() {
    let (env, _, sender, token_contract, _, _, client, _) = setup_payment_escrow();

    env.ledger().set_sequence_number(10);
    let id1 = client.initiate_payment(
        &sender,
        &5_000,
        &token_contract,
        &SorobanString::from_str(&env, "rec1"),
        &SorobanString::from_str(&env, "USD"),
        &SorobanString::from_str(&env, "anc"),
    );

    env.ledger().set_sequence_number(11);
    let id2 = client.initiate_payment(
        &sender,
        &3_000,
        &token_contract,
        &SorobanString::from_str(&env, "rec2"),
        &SorobanString::from_str(&env, "EUR"),
        &SorobanString::from_str(&env, "anc"),
    );

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── EDGE CASES AND INVARIANT TESTS ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_escrow_balance_invariant() {
    let (env, admin, sender, token_contract, token_client, _, client, contract_address) =
        setup_payment_escrow();

    let recipient = Address::generate(&env);

    env.ledger().set_sequence_number(10);
    let id1 = client.initiate_payment(
        &sender,
        &10_000,
        &token_contract,
        &SorobanString::from_str(&env, "r1"),
        &SorobanString::from_str(&env, "USD"),
        &SorobanString::from_str(&env, "a"),
    );

    env.ledger().set_sequence_number(11);
    let id2 = client.initiate_payment(
        &sender,
        &15_000,
        &token_contract,
        &SorobanString::from_str(&env, "r2"),
        &SorobanString::from_str(&env, "EUR"),
        &SorobanString::from_str(&env, "a"),
    );

    env.ledger().set_sequence_number(12);
    let id3 = client.initiate_payment(
        &sender,
        &8_000,
        &token_contract,
        &SorobanString::from_str(&env, "r3"),
        &SorobanString::from_str(&env, "GBP"),
        &SorobanString::from_str(&env, "a"),
    );

    assert_eq!(token_client.balance(&contract_address), 33_000);

    env.ledger().set_sequence_number(20);
    client.complete_payment(&admin, &id1, &recipient);
    assert_eq!(token_client.balance(&contract_address), 23_000);

    env.ledger().set_sequence_number(21);
    client.fail_payment(&admin, &id2);
    assert_eq!(token_client.balance(&contract_address), 8_000);

    env.ledger().set_sequence_number(22);
    client.complete_payment(&admin, &id3, &recipient);
    assert_eq!(token_client.balance(&contract_address), 0);
}

#[test]
fn test_large_payment_amount() {
    let (env, _, sender, token_contract, _token_client, token_admin_client, client, _) =
        setup_payment_escrow();

    let large_amount = 500_000_000;
    token_admin_client.mint(&sender, &large_amount);

    let payment_id = client.initiate_payment(
        &sender,
        &large_amount,
        &token_contract,
        &SorobanString::from_str(&env, "receiver"),
        &SorobanString::from_str(&env, "USD"),
        &SorobanString::from_str(&env, "anchor"),
    );

    let payment = client.get_payment(&payment_id).unwrap();
    assert_eq!(payment.amount, large_amount);
}

#[test]
fn test_payment_count_accuracy() {
    let (env, _, sender, token_contract, _, _, client, _) = setup_payment_escrow();

    assert_eq!(client.get_payment_count(), 0);

    for i in 1..=5 {
        env.ledger().set_sequence_number(i * 10);
        client.initiate_payment(
            &sender,
            &1_000,
            &token_contract,
            &SorobanString::from_str(&env, "rec"),
            &SorobanString::from_str(&env, "USD"),
            &SorobanString::from_str(&env, "anc"),
        );
    }

    assert_eq!(client.get_payment_count(), 5);
}

#[test]
fn test_zero_balance_after_all_payments_processed() {
    let (env, admin, sender, token_contract, token_client, _, client, contract_address) =
        setup_payment_escrow();

    let recipient = Address::generate(&env);

    for i in 1..=10 {
        env.ledger().set_sequence_number(i * 10);
        client.initiate_payment(
            &sender,
            &1_000,
            &token_contract,
            &SorobanString::from_str(&env, "rec"),
            &SorobanString::from_str(&env, "USD"),
            &SorobanString::from_str(&env, "anc"),
        );
    }

    for (idx, payment_id) in (1..=10_u64).enumerate() {
        env.ledger().set_sequence_number(100 + idx as u32);
        client.complete_payment(&admin, &payment_id, &recipient);
    }

    assert_eq!(token_client.balance(&contract_address), 0);
    assert_eq!(token_client.balance(&recipient), 10_000);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── STATE MACHINE TESTS FOR COMPLETE / FAIL ───────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_cannot_complete_already_completed() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let stellar = token::StellarAssetClient::new(&env, &token_address);
    stellar.mint(&from, &5000);

    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let payment_id = client.initiate_payment(
        &from,
        &1000,
        &token_address,
        &SorobanString::from_str(&env, "rec"),
        &SorobanString::from_str(&env, "USD"),
        &SorobanString::from_str(&env, "anc"),
    );

    client.complete_payment(&admin, &payment_id, &recipient);

    let result = client.try_complete_payment(&admin, &payment_id, &recipient);
    assert_eq!(result, Err(Ok(CrossAssetPaymentError::PaymentNotPending)));
}

#[test]
fn test_cannot_fail_already_failed() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let stellar = token::StellarAssetClient::new(&env, &token_address);
    stellar.mint(&from, &5000);

    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let payment_id = client.initiate_payment(
        &from,
        &1000,
        &token_address,
        &SorobanString::from_str(&env, "rec"),
        &SorobanString::from_str(&env, "USD"),
        &SorobanString::from_str(&env, "anc"),
    );

    client.fail_payment(&admin, &payment_id);

    let result = client.try_fail_payment(&admin, &payment_id);
    assert_eq!(result, Err(Ok(CrossAssetPaymentError::PaymentNotPending)));
}
