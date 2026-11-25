// Issue #1756 — Upgrade simulation tests for smart_wallet
//
// Run on Linux per contracts/README.md:
//   cargo test -p smart_wallet -- upgrade

#![cfg(test)]

use crate::{SignerKey, SmartWalletContract, SmartWalletContractClient, WalletError};
use soroban_sdk::{Address, BytesN, Env, Vec, testutils::Address as _};

fn make_signer(env: &Env, seed: u8) -> SignerKey {
    let bytes: [u8; 32] = [seed; 32];
    SignerKey::Ed25519(BytesN::from_array(env, &bytes))
}

fn setup_wallet() -> (Env, Address, SmartWalletContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(SmartWalletContract, ());
    let client = SmartWalletContractClient::new(&env, &contract_id);

    let signer = make_signer(&env, 1);
    let signers = Vec::from_array(&env, [signer]);
    client.init(&signers, &1u32);

    (env, contract_id, client)
}

// ── Issue #1756 ───────────────────────────────────────────────────────────────

/// Signer set and threshold survive a simulated WASM upgrade.
///
/// smart_wallet has no `mark_upgrade`; the upgrade lifecycle here is modelled
/// as simply reading all state back after `migrate()` succeeds, verifying that
/// the instance storage layout is compatible.
#[test]
fn test_state_survives_upgrade_simulation() {
    let (_, _, client) = setup_wallet();

    let threshold_before = client.threshold().unwrap();
    let count_before = client.signer_count().unwrap();

    // The closest proxy to a live WASM upgrade in the test harness:
    // migrate() is the first call a new WASM version would make.
    client.migrate(&1u32);

    let threshold_after = client.threshold().unwrap();
    let count_after = client.signer_count().unwrap();

    assert_eq!(
        threshold_before, threshold_after,
        "threshold must survive upgrade"
    );
    assert_eq!(
        count_before, count_after,
        "signer count must survive upgrade"
    );
}

/// migrate() advances StateVersion; downgrade is rejected with StateVersionDowngrade.
#[test]
fn test_migrate_advances_then_rejects_downgrade() {
    let (_, _, client) = setup_wallet();
    client.migrate(&1u32);
    let result = client.try_migrate(&1u32);
    assert!(
        result.is_err(),
        "migrating to same version must return StateVersionDowngrade"
    );
}

/// Exceeding compiled STATE_VERSION panics.
#[test]
#[should_panic]
fn test_migrate_exceeds_compiled_version_panics() {
    let (_, _, client) = setup_wallet();
    client.migrate(&(crate::STATE_VERSION + 1));
}
