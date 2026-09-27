#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger, LedgerInfo};
use soroban_sdk::{vec, Env, String};

fn create_contract() -> (Env, AssetPathPaymentContract) {
    let env = Env::default();
    let contract_id = env.register(AssetPathPaymentContract, ());
    env.as_contract(&contract_id, || {
        let admin = Address::generate(&env);
        AssetPathPaymentContract::init(env.clone(), admin);
    });
    (env, contract_id)
}

#[test]
fn test_init() {
    let env = Env::default();
    let contract_id = env.register(AssetPathPaymentContract, ());

    env.as_contract(&contract_id, || {
        let admin = Address::generate(&env);
        AssetPathPaymentContract::init(env.clone(), admin.clone());

        // Verify admin is set
        let stored_admin: Address = env.storage().persistent().get(&DataKey::Admin).unwrap();
        assert_eq!(stored_admin, admin);

        // Verify payment count is 0
        let count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::PaymentCount)
            .unwrap();
        assert_eq!(count, 0);
    });
}

#[test]
#[should_panic(expected = "AlreadyInitialized")]
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

    env.as_contract(&contract_id, || {
        let admin = Address::generate(&env);
        AssetPathPaymentContract::init(env.clone(), admin.clone());

        // This should work since admin is authorized
        env.mock_all_auths(&admin);
        AssetPathPaymentContract::bump_ttl(env.clone());
    });
}


// ══════════════════════════════════════════════════════════════════════════════
// ── VERSION METADATA TEST (Issue #1606) ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════────════════════

#[test]
fn test_version_metadata() {
    let version = AssetPathPaymentContract::version();
    assert_eq!(version, (1, 0, 0));
}
