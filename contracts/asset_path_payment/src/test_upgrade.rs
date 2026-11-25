// Issue #1756 — Upgrade simulation tests for asset_path_payment
//
// Run on Linux per contracts/README.md:
//   cargo test -p asset_path_payment -- upgrade

#![cfg(test)]

use super::*;
use soroban_sdk::{
    Address, Env, String, Vec,
    testutils::{Address as _, Ledger as _},
    token,
};

fn setup_app() -> (Env, Address, Address, AssetPathPaymentContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(AssetPathPaymentContract, ());
    let client = AssetPathPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    (env, admin, contract_id, client)
}

// ── Issue #1756 ───────────────────────────────────────────────────────────────

/// Payment records and counters survive a simulated WASM upgrade.
#[test]
fn test_state_survives_upgrade_simulation() {
    let (env, _admin, _cid, client) = setup_app();

    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let source = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let dest = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();

    token::StellarAssetClient::new(&env, &source).mint(&from, &500_000);
    env.ledger().set_sequence_number(10);

    let payment_id = client.initiate_path_payment(
        &from,
        &to,
        &source,
        &dest,
        &100_000i128,
        &90_000i128,
        &100_000i128,
        &Vec::new(&env),
    );

    let record_before = client.get_payment(&payment_id).unwrap();

    // Simulate upgrade lifecycle
    client.mark_upgrade(&String::from_str(&env, "0.0.2"));

    let record_after = client.get_payment(&payment_id).unwrap();
    assert_eq!(
        record_before.amount, record_after.amount,
        "payment amount must survive upgrade"
    );
    assert_eq!(
        record_before.status, record_after.status,
        "payment status must survive upgrade"
    );
}

/// migrate() advances StateVersion; downgrade is rejected.
#[test]
fn test_migrate_advances_then_rejects_downgrade() {
    let (_, _, _, client) = setup_app();
    client.migrate(&1u32);
    let result = client.try_migrate(&1u32);
    assert!(result.is_err(), "downgrade must be rejected");
}

/// Exceeding compiled STATE_VERSION panics.
#[test]
#[should_panic]
fn test_migrate_exceeds_compiled_version_panics() {
    let (_, _, _, client) = setup_app();
    client.migrate(&(STATE_VERSION + 1));
}
