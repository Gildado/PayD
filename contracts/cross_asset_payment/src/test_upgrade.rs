// Issue #1756 — Upgrade simulation tests for cross_asset_payment
//
// Run on Linux per contracts/README.md:
//   cargo test -p cross_asset_payment -- upgrade

#![cfg(test)]

use super::*;
use soroban_sdk::{
    Address, Env, String,
    testutils::{Address as _, Ledger},
    token,
};

fn setup_cap() -> (
    Env,
    Address, // admin
    CrossAssetPaymentContractClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(CrossAssetPaymentContract, ());
    let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
    client.init(&admin);

    (env, admin, client)
}

// ── Issue #1756 ───────────────────────────────────────────────────────────────

/// Payment records survive a simulated WASM upgrade.
#[test]
fn test_state_survives_upgrade_simulation() {
    let (env, _admin, client) = setup_cap();

    let from = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    token::StellarAssetClient::new(&env, &token).mint(&from, &1_000);

    env.ledger().with_mut(|li| li.sequence_number = 1);

    let payment_id = client.initiate_payment(
        &from,
        &500i128,
        &token,
        &String::from_str(&env, "worker-1"),
        &String::from_str(&env, "USDC"),
        &String::from_str(&env, "anchor-eu"),
    );

    let record_before = client.get_payment(&payment_id).unwrap();

    // Simulate upgrade lifecycle
    client.mark_upgrade(&String::from_str(&env, "0.0.2"));

    let record_after = client.get_payment(&payment_id).unwrap();
    assert_eq!(
        record_before.amount, record_after.amount,
        "payment amount must survive upgrade"
    );
}

/// migrate() advances StateVersion; downgrade is rejected.
#[test]
fn test_migrate_advances_then_rejects_downgrade() {
    let (_, _, client) = setup_cap();
    client.migrate(&1u32);
    let result = client.try_migrate(&1u32);
    assert!(result.is_err(), "downgrade must be rejected");
}

/// Exceeding compiled STATE_VERSION panics.
#[test]
#[should_panic]
fn test_migrate_exceeds_compiled_version_panics() {
    let (_, _, client) = setup_cap();
    client.migrate(&(STATE_VERSION + 1));
}
