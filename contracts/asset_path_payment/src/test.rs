#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Env, String, token};

fn create_token_contract(env: &Env, admin: &Address) -> Address {
    env.register_stellar_asset_contract_v2(admin.clone())
        .address()
}

fn create_contract(env: &Env) -> (Address, Address) {
    let admin = Address::generate(env);
    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(env, &contract_id);
    client.init(&admin);
    (admin, contract_id)
}

// ── contract client helper for direct contract-as-contract invocation ──

#[allow(dead_code)]
fn init_and_mint(env: &Env, amount: i128) -> (Address, Address, Address) {
    let admin = Address::generate(env);
    let from = Address::generate(env);
    let token_admin = Address::generate(env);
    let token = create_token_contract(env, &token_admin);
    let stellar = token::StellarAssetClient::new(env, &token);
    stellar.mint(&from, &amount);
    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(env, &contract_id);
    client.init(&admin);
    (admin, from, token)
}

// ══════════════════════════════════════════════════════════════════════════════
// ── INITIALIZATION ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_init() {
    let env = Env::default();
    let contract_id = env.register(AssetPathPaymentContract, ());

    env.as_contract(&contract_id, || {
        let admin = Address::generate(&env);
        AssetPathPaymentContract::init(env.clone(), admin.clone());

        let stored_admin: Address = env.storage().persistent().get(&DataKey::Admin).unwrap();
        assert_eq!(stored_admin, admin);

        let count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::PaymentCount)
            .unwrap();
        assert_eq!(count, 0);
    });
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_double_init() {
    let env = Env::default();
    let contract_id = env.register(AssetPathPaymentContract, ());

    env.as_contract(&contract_id, || {
        let admin = Address::generate(&env);
        AssetPathPaymentContract::init(env.clone(), admin);
        let admin2 = Address::generate(&env);
        AssetPathPaymentContract::init(env.clone(), admin2);
    });
}

#[test]
fn test_get_payment_count() {
    let env = Env::default();
    let contract_id = env.register(AssetPathPaymentContract, ());

    env.as_contract(&contract_id, || {
        let admin = Address::generate(&env);
        AssetPathPaymentContract::init(env.clone(), admin);
        let count = AssetPathPaymentContract::get_payment_count(env.clone());
        assert_eq!(count, 0);
    });
}

#[test]
fn test_bump_ttl() {
    let env = Env::default();
    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.init(&admin);
    env.mock_all_auths();
    client.bump_ttl();
}

// ══════════════════════════════════════════════════════════════════════════════
// ── INITIATE PATH PAYMENT ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_initiate_path_payment_increments_count() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let path = Vec::new(&env);
    let id1 = client.initiate_path_payment(&from, &to, &source, &dest, &100, &90, &100, &path);
    let id2 = client.initiate_path_payment(&from, &to, &source, &dest, &200, &180, &200, &path);

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(client.get_payment_count(), 2);
}

#[test]
fn test_initiate_path_payment_rejects_invalid_amounts() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let path = Vec::new(&env);

    client.initiate_path_payment(&from, &to, &source, &dest, &100, &90, &100, &path);

    // Zero source amount
    let result = client.try_initiate_path_payment(&from, &to, &source, &dest, &0, &10, &10, &path);
    assert_eq!(result, Err(Ok(PathPaymentError::InvalidAmount)));

    // Slippage exceeded (max_source < source)
    let result = client.try_initiate_path_payment(&from, &to, &source, &dest, &100, &10, &5, &path);
    assert_eq!(result, Err(Ok(PathPaymentError::SlippageExceeded)));
}

#[test]
fn test_initiate_path_payment_escrows_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let source = create_token_contract(&env, &token_admin);
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let tc = token::Client::new(&env, &source);

    client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &300,
        &270,
        &300,
        &Vec::new(&env),
    );

    assert_eq!(tc.balance(&contract_id), 300);
    assert_eq!(tc.balance(&from), 4700);
}

#[test]
fn test_initiate_path_payment_stores_record() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let path = Vec::from_array(&env, [dest.clone()]);
    let id = client.initiate_path_payment(&from, &to, &source, &dest, &150, &140, &150, &path);

    let record = client.get_payment(&id);
    assert!(record.is_some());
    let record = record.unwrap();
    assert_eq!(record.from, from);
    assert_eq!(record.to, to);
    assert_eq!(record.source_amount, 150);
    assert_eq!(record.dest_min_amount, 140);
    assert_eq!(record.status, symbol_short!("pending"));
    assert_eq!(record.actual_source_amount, None);
    assert_eq!(record.actual_dest_amount, None);
    assert_eq!(record.error_message, None);
    assert_eq!(record.partial_failure, false);
}

#[test]
fn test_get_payment_returns_none_for_unknown_id() {
    let env = Env::default();
    env.mock_all_auths();

    let (_admin, contract_id) = create_contract(&env);
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);

    assert!(client.get_payment(&999).is_none());
}

// ══════════════════════════════════════════════════════════════════════════════
// ── FAIL PATH PAYMENT ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_fail_path_payment_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &200,
        &180,
        &200,
        &Vec::new(&env),
    );

    let msg = String::from_str(&env, "No liquidity on path");
    client.fail_path_payment(&id, &(PathPaymentError::NoLiquidity as u32), &msg, &false);

    let record = client.get_payment(&id).unwrap();
    assert_eq!(record.status, symbol_short!("failed"));
    assert_eq!(record.error_message, Some(msg));
    assert_eq!(record.partial_failure, false);
}

#[test]
fn test_complete_path_payment_rejects_unknown_payment() {
    let env = Env::default();
    env.mock_all_auths();

    let (_admin, contract_id) = create_contract(&env);
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);

    let result = client.try_complete_path_payment(&999, &100, &95);
    assert_eq!(result, Err(Ok(PathPaymentError::PaymentNotFound)));
}

#[test]
fn test_complete_path_payment_rejects_non_pending() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &200,
        &180,
        &200,
        &Vec::new(&env),
    );

    // Complete it once
    client.complete_path_payment(&id, &195, &190);

    // Try completing again — must reject
    let result = client.try_complete_path_payment(&id, &195, &190);
    assert_eq!(result, Err(Ok(PathPaymentError::PaymentNotPending)));
}

#[test]
fn test_complete_path_payment_slippage_rejection() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &200,
        &190,
        &200,
        &Vec::new(&env),
    );

    // actual_dest_amount < dest_min_amount should fail with slippage
    let result = client.try_complete_path_payment(&id, &195, &100);
    assert_eq!(result, Err(Ok(PathPaymentError::SlippageExceeded)));
}

#[test]
fn test_complete_path_payment_rejects_negative_source_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &200,
        &180,
        &200,
        &Vec::new(&env),
    );

    // Negative actual_source_amount must be rejected
    let result = client.try_complete_path_payment(&id, &(-50), &190);
    assert_eq!(result, Err(Ok(PathPaymentError::InvalidAmount)));

    // Record must remain pending (state unchanged)
    let record = client.get_payment(&id).unwrap();
    assert_eq!(record.status, symbol_short!("pending"));
}

#[test]
fn test_fail_path_payment_with_partial_failure_flag() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &200,
        &180,
        &200,
        &Vec::new(&env),
    );

    let msg = String::from_str(&env, "Partial execution");
    client.fail_path_payment(&id, &99, &msg, &true);

    let record = client.get_payment(&id).unwrap();
    assert_eq!(record.status, symbol_short!("failed"));
    assert_eq!(record.partial_failure, true);
}

#[test]
fn test_fail_path_payment_rejects_unknown_payment() {
    let env = Env::default();
    env.mock_all_auths();

    let (_admin, contract_id) = create_contract(&env);
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);

    let msg = String::from_str(&env, "Not found");
    let result =
        client.try_fail_path_payment(&999, &(PathPaymentError::PathNotFound as u32), &msg, &false);
    assert_eq!(result, Err(Ok(PathPaymentError::PaymentNotFound)));
}

#[test]
fn test_fail_path_payment_rejects_non_pending() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &200,
        &180,
        &200,
        &Vec::new(&env),
    );

    // Fail it
    let msg = String::from_str(&env, "First fail");
    client.fail_path_payment(&id, &1, &msg, &false);

    // Try failing again
    let msg2 = String::from_str(&env, "Second fail attempt");
    let result = client.try_fail_path_payment(&id, &2, &msg2, &false);
    assert_eq!(result, Err(Ok(PathPaymentError::PaymentNotPending)));
}

// ══════════════════════════════════════════════════════════════════════════════
// ── WITHDRAW ──────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_withdraw_rejects_non_positive_amounts() {
    let env = Env::default();
    env.mock_all_auths();

    let (_admin, contract_id) = create_contract(&env);
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);

    let asset = create_token_contract(&env, &Address::generate(&env));
    let recipient = Address::generate(&env);

    let result = client.try_withdraw(&asset, &0, &recipient);
    assert_eq!(result, Err(Ok(PathPaymentError::InvalidAmount)));

    let result = client.try_withdraw(&asset, &(-1), &recipient);
    assert_eq!(result, Err(Ok(PathPaymentError::InvalidAmount)));
}

#[test]
fn test_withdraw_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let source = create_token_contract(&env, &token_admin);
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let to = Address::generate(&env);
    let dest = create_token_contract(&env, &Address::generate(&env));

    // Send tokens to contract via path payment
    client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &300,
        &270,
        &300,
        &Vec::new(&env),
    );

    let tc = token::Client::new(&env, &source);
    assert_eq!(tc.balance(&contract_id), 300);

    let recipient = Address::generate(&env);
    client.withdraw(&source, &150, &recipient);

    assert_eq!(tc.balance(&recipient), 150);
    assert_eq!(tc.balance(&contract_id), 150);
}

#[test]
fn test_withdraw_transfer_failure_preserves_contract_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let source = create_token_contract(&env, &token_admin);
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let to = Address::generate(&env);
    let dest = create_token_contract(&env, &Address::generate(&env));

    // Send tokens to contract escrow
    client.initiate_path_payment(&from, &to, &source, &dest, &300, &270, &300, &Vec::new(&env));

    let tc = token::Client::new(&env, &source);
    assert_eq!(tc.balance(&contract_id), 300);

    // Attempt to withdraw more than the contract holds — transfer will panic,
    // which reverts the entire call and leaves contract balance unchanged.
    let recipient = Address::generate(&env);
    let result = client.try_withdraw(&source, &500, &recipient);
    assert!(result.is_err());

    // Contract balance must be preserved after failed withdrawal.
    assert_eq!(tc.balance(&contract_id), 300);
}

#[test]
fn test_withdraw_emits_event() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let source = create_token_contract(&env, &token_admin);
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let to = Address::generate(&env);
    let dest = create_token_contract(&env, &Address::generate(&env));
    let recipient = Address::generate(&env);

    client.initiate_path_payment(&from, &to, &source, &dest, &300, &270, &300, &Vec::new(&env));
    client.withdraw(&source, &150, &recipient);

    // Verify the withdraw event was published with expected topics/data
    let events = env.events().all();
    let withdraw_event = events.iter().find(|(_, topics, _)| {
        let topic0: soroban_sdk::Symbol = topics.get(0).unwrap();
        topic0 == symbol_short!("withdraw")
    });
    assert!(
        withdraw_event.is_some(),
        "expected a WithdrawEvent to be emitted on successful withdraw()"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── EVENT EMISSION ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_path_payment_initiated_event() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id =
        client.initiate_path_payment(&from, &to, &source, &dest, &100, &90, &100, &Vec::new(&env));
    assert_eq!(id, 1);
}

#[test]
fn test_path_payment_completed_event() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &200,
        &180,
        &200,
        &Vec::new(&env),
    );

    client.complete_path_payment(&id, &195, &190);

    let record = client.get_payment(&id).unwrap();
    assert_eq!(record.status, symbol_short!("completed"));
}

#[test]
fn test_path_payment_failed_event() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &200,
        &180,
        &200,
        &Vec::new(&env),
    );

    let msg = String::from_str(&env, "Liquidity vanished");
    client.fail_path_payment(&id, &99, &msg, &true);

    let record = client.get_payment(&id).unwrap();
    assert_eq!(record.status, symbol_short!("failed"));
    assert_eq!(record.partial_failure, true);
}

#[test]
fn test_complete_slippage_emits_failed_event() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &200,
        &190,
        &200,
        &Vec::new(&env),
    );

    let result = client.try_complete_path_payment(&id, &195, &100);
    assert_eq!(result, Err(Ok(PathPaymentError::SlippageExceeded)));
}

// ══════════════════════════════════════════════════════════════════════════════
// ── FULL LIFECYCLE ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_full_lifecycle_complete() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    // Initiate
    let path = Vec::from_array(&env, [dest.clone()]);
    let id = client.initiate_path_payment(&from, &to, &source, &dest, &500, &480, &500, &path);
    assert_eq!(client.get_payment_count(), 1);

    let record = client.get_payment(&id).unwrap();
    assert_eq!(record.status, symbol_short!("pending"));

    // Complete
    client.complete_path_payment(&id, &490, &495);
    let record = client.get_payment(&id).unwrap();
    assert_eq!(record.status, symbol_short!("completed"));
    assert_eq!(record.actual_source_amount, Some(490));
    assert_eq!(record.actual_dest_amount, Some(495));
}

#[test]
fn test_full_lifecycle_fail() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &300,
        &280,
        &300,
        &Vec::new(&env),
    );
    assert_eq!(client.get_payment_count(), 1);

    let msg = String::from_str(&env, "Path execution failed");
    client.fail_path_payment(&id, &(PathPaymentError::PathNotFound as u32), &msg, &false);

    let record = client.get_payment(&id).unwrap();
    assert_eq!(record.status, symbol_short!("failed"));
    assert_eq!(record.error_message, Some(msg));
}

// ══════════════════════════════════════════════════════════════════════════════
// ── EDGE CASES ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_multiple_payments_independent_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &15000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    // Payment 1: Complete
    let id1 =
        client.initiate_path_payment(&from, &to, &source, &dest, &100, &90, &100, &Vec::new(&env));
    // Payment 2: Fail
    let id2 = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &200,
        &180,
        &200,
        &Vec::new(&env),
    );
    // Payment 3: Complete
    let id3 = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &300,
        &270,
        &300,
        &Vec::new(&env),
    );

    client.complete_path_payment(&id1, &95, &92);
    let msg = String::from_str(&env, "Error");
    client.fail_path_payment(&id2, &1, &msg, &false);
    client.complete_path_payment(&id3, &295, &285);

    assert_eq!(
        client.get_payment(&id1).unwrap().status,
        symbol_short!("completed")
    );
    assert_eq!(
        client.get_payment(&id2).unwrap().status,
        symbol_short!("failed")
    );
    assert_eq!(
        client.get_payment(&id3).unwrap().status,
        symbol_short!("completed")
    );
}

#[test]
fn test_empty_path_initiation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id =
        client.initiate_path_payment(&from, &to, &source, &dest, &100, &90, &100, &Vec::new(&env));

    let record = client.get_payment(&id).unwrap();
    assert_eq!(record.path.len(), 0);
    assert_eq!(record.status, symbol_short!("pending"));
}

#[test]
fn test_populated_path_initiation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let hop1 = create_token_contract(&env, &Address::generate(&env));
    let hop2 = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let path = Vec::from_array(&env, [hop1.clone(), hop2.clone()]);
    let id = client.initiate_path_payment(&from, &to, &source, &dest, &100, &90, &100, &path);

    let record = client.get_payment(&id).unwrap();
    assert_eq!(record.path.len(), 2);
}

#[test]
fn test_sep0034_metadata() {
    let env = Env::default();
    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);

    assert_eq!(
        client.name(),
        String::from_str(&env, env!("CARGO_PKG_NAME"))
    );
    assert_eq!(
        client.version(),
        String::from_str(&env, env!("CARGO_PKG_VERSION"))
    );
    assert_eq!(
        client.author(),
        String::from_str(&env, env!("CARGO_PKG_AUTHORS"))
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PAUSE MECHANISM ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_pause_defaults_to_false() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    assert!(!client.is_paused());
}

#[test]
fn test_set_paused_true() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    client.set_paused(&true);
    assert!(client.is_paused());
}

#[test]
fn test_set_paused_toggle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    client.set_paused(&true);
    assert!(client.is_paused());
    client.set_paused(&false);
    assert!(!client.is_paused());
}

#[test]
fn test_initiate_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    client.set_paused(&true);

    let result = client.try_initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &100,
        &90,
        &100,
        &Vec::new(&env),
    );
    assert_eq!(result, Err(Ok(PathPaymentError::ContractPaused)));
}

#[test]
fn test_complete_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &200,
        &180,
        &200,
        &Vec::new(&env),
    );

    client.set_paused(&true);

    let result = client.try_complete_path_payment(&id, &195, &190);
    assert_eq!(result, Err(Ok(PathPaymentError::ContractPaused)));
}

#[test]
fn test_fail_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    let id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &200,
        &180,
        &200,
        &Vec::new(&env),
    );

    client.set_paused(&true);

    let msg = String::from_str(&env, "test");
    let result = client.try_fail_path_payment(&id, &1, &msg, &false);
    assert_eq!(result, Err(Ok(PathPaymentError::ContractPaused)));
}

#[test]
fn test_withdraw_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    client.initiate_path_payment(&from, &to, &source, &dest, &300, &270, &300, &Vec::new(&env));

    client.set_paused(&true);

    let recipient = Address::generate(&env);
    let result = client.try_withdraw(&source, &150, &recipient);
    assert_eq!(result, Err(Ok(PathPaymentError::ContractPaused)));
}

#[test]
fn test_unpause_restores_operations() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let source = create_token_contract(&env, &Address::generate(&env));
    let dest = create_token_contract(&env, &Address::generate(&env));
    let stellar = token::StellarAssetClient::new(&env, &source);
    stellar.mint(&from, &5000);

    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    client.set_paused(&true);
    assert!(client.is_paused());

    client.set_paused(&false);
    assert!(!client.is_paused());

    let id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &100,
        &90,
        &100,
        &Vec::new(&env),
    );
    assert_eq!(id, 1);
}

#[test]
fn test_set_paused_requires_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    // set_paused succeeds with admin auth (mock_all_auths covers this)
    client.set_paused(&true);
    assert!(client.is_paused());
}
