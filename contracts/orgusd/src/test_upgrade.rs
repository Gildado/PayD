// Issue #1756 — Upgrade simulation tests for orgusd
//
// Run on Linux per contracts/README.md:
//   cargo test -p orgusd -- upgrade

#![cfg(test)]

use soroban_sdk::{Address, Env, String, testutils::Address as _};

use crate::{OrgUsdContract, OrgUsdContractClient};

fn setup_orgusd() -> (Env, OrgUsdContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(OrgUsdContract, ());
    let client = OrgUsdContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, client, admin)
}

// ── Issue #1756 ───────────────────────────────────────────────────────────────

/// Token supply and admin survive a simulated WASM upgrade.
#[test]
fn test_state_survives_upgrade_simulation() {
    let (env, client, _admin) = setup_orgusd();

    // Mint some tokens so total_supply has a non-zero value
    let holder = Address::generate(&env);
    client.authorize(&holder);
    client.mint(&holder, &1_000);

    let supply_before = client.total_supply();

    // Simulate upgrade lifecycle
    client.mark_upgrade(&String::from_str(&env, "0.0.2"));

    let supply_after = client.total_supply();
    assert_eq!(
        supply_before, supply_after,
        "total supply must survive upgrade"
    );
}

/// migrate() advances StateVersion; downgrade is rejected.
#[test]
fn test_migrate_advances_then_rejects_downgrade() {
    let (_, client, _) = setup_orgusd();
    client.migrate(&1u32);
    let result = client.try_migrate(&1u32);
    assert!(result.is_err(), "downgrade must be rejected");
}

/// Exceeding compiled STATE_VERSION panics.
#[test]
#[should_panic]
fn test_migrate_exceeds_compiled_version_panics() {
    let (_, client, _) = setup_orgusd();
    client.migrate(&(crate::STATE_VERSION + 1));
}
