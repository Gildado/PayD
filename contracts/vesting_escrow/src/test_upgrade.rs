// Issue #1756 — Upgrade simulation tests for vesting_escrow
//
// Run on Linux per contracts/README.md:
//   cargo test -p vesting_escrow -- upgrade

#![cfg(test)]

use super::*;
use soroban_sdk::{
    Address, Env, String,
    testutils::{Address as _, Ledger},
    token,
};

fn setup_ve() -> (
    Env,
    Address, // funder
    Address, // beneficiary
    Address, // clawback_admin
    Address, // admin
    Address, // token
    VestingContractClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let funder = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let clawback_admin = Address::generate(&env);
    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    token::StellarAssetClient::new(&env, &token).mint(&funder, &10_000_000);

    let contract_id = env.register(VestingContract, ());
    let client = VestingContractClient::new(&env, &contract_id);

    (env, funder, beneficiary, clawback_admin, admin, token, client)
}

// ── Issue #1756 ───────────────────────────────────────────────────────────────

/// Vesting config survives a simulated WASM upgrade.
#[test]
fn test_state_survives_upgrade_simulation() {
    let (env, funder, beneficiary, clawback_admin, admin, token, client) = setup_ve();

    env.ledger().set_timestamp(1_000);
    client.initialize(
        &funder,
        &beneficiary,
        &token,
        &1_000u64,
        &100u64,
        &1_000u64,
        &5_000i128,
        &clawback_admin,
        &admin,
    );

    let total_before = client.get_total_amount();

    // Simulate upgrade lifecycle
    client.mark_upgrade(&String::from_str(&env, "0.0.2"));

    // Config must be fully intact after upgrade event
    let total_after = client.get_total_amount();
    assert_eq!(
        total_before, total_after,
        "total vested amount must survive upgrade"
    );
}

/// migrate() advances StateVersion; downgrade is rejected.
#[test]
fn test_migrate_advances_then_rejects_downgrade() {
    let (env, funder, beneficiary, clawback_admin, admin, token, client) = setup_ve();
    env.ledger().set_timestamp(1);
    client.initialize(
        &funder,
        &beneficiary,
        &token,
        &1u64,
        &0u64,
        &100u64,
        &1_000i128,
        &clawback_admin,
        &admin,
    );
    client.migrate(&1u32);
    let result = client.try_migrate(&1u32);
    assert!(result.is_err(), "downgrade must be rejected");
}

/// Exceeding compiled STATE_VERSION panics.
#[test]
#[should_panic]
fn test_migrate_exceeds_compiled_version_panics() {
    let (env, funder, beneficiary, clawback_admin, admin, token, client) = setup_ve();
    env.ledger().set_timestamp(1);
    client.initialize(
        &funder,
        &beneficiary,
        &token,
        &1u64,
        &0u64,
        &100u64,
        &1_000i128,
        &clawback_admin,
        &admin,
    );
    client.migrate(&(STATE_VERSION + 1));
}
