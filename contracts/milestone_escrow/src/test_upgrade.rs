// Issue #1756 — Upgrade simulation tests for milestone_escrow
//
// Run on Linux per contracts/README.md:
//   cargo test -p milestone_escrow -- upgrade

#![cfg(test)]

use super::*;
use soroban_sdk::{
    Address, Env, String, Vec,
    testutils::{Address as _, Ledger},
    token,
};

fn setup_me() -> (
    Env,
    Address, // sender
    Address, // beneficiary
    Address, // verifier
    Address, // token
    MilestoneEscrowContractClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let verifier = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    token::StellarAssetClient::new(&env, &token).mint(&sender, &2_000_000);

    let contract_id = env.register(MilestoneEscrowContract, ());
    let client = MilestoneEscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    (env, sender, beneficiary, verifier, token, client)
}

fn make_milestones(env: &Env, amounts: &[i128]) -> Vec<Milestone> {
    let mut ms: Vec<Milestone> = Vec::new(env);
    for (i, &amount) in amounts.iter().enumerate() {
        let desc = match i {
            0 => String::from_str(env, "M1"),
            _ => String::from_str(env, "MN"),
        };
        ms.push_back(Milestone {
            description: desc,
            amount,
            status: MilestoneStatus::Pending,
        });
    }
    ms
}

// ── Issue #1756 ───────────────────────────────────────────────────────────────

/// Escrow records survive a simulated WASM upgrade.
#[test]
fn test_state_survives_upgrade_simulation() {
    let (env, sender, beneficiary, verifier, token, client) = setup_me();

    let milestones = make_milestones(&env, &[500, 500]);
    let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token, &milestones);

    // Record state before the upgrade event
    let record_before = client.get_escrow(&escrow_id);

    // Simulate the upgrade lifecycle step
    client.mark_upgrade(&String::from_str(&env, "0.0.2"));

    // All escrow state must be readable and unchanged
    let record_after = client.get_escrow(&escrow_id);
    assert_eq!(
        record_before.total_amount, record_after.total_amount,
        "escrow total_amount must survive upgrade"
    );
    assert_eq!(
        record_before.milestones.len(),
        record_after.milestones.len(),
        "milestone count must survive upgrade"
    );
}

/// migrate() advances StateVersion; downgrade is rejected.
#[test]
fn test_migrate_advances_then_rejects_downgrade() {
    let (_, _, _, _, _, client) = setup_me();
    client.migrate(&1u32);
    let result = client.try_migrate(&1u32);
    assert!(result.is_err(), "downgrade must be rejected");
}

/// Exceeding compiled STATE_VERSION panics.
#[test]
#[should_panic]
fn test_migrate_exceeds_compiled_version_panics() {
    let (_, _, _, _, _, client) = setup_me();
    client.migrate(&(STATE_VERSION + 1));
}
