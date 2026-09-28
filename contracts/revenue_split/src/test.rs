#![cfg(test)]

use crate::{
    DEFAULT_MAX_DISTRIBUTION_AMOUNT, RecipientShare, RevenueSplitContract,
    RevenueSplitContractClient, RevenueSplitError, TOTAL_BASIS_POINTS,
};
use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::token::StellarAssetClient;
use soroban_sdk::{
    Address, Env, Vec,
    testutils::{Address as _, Ledger},
};

fn create_token_contract<'a>(
    e: &Env,
    admin: &Address,
) -> (Address, StellarAssetClient<'a>, TokenClient<'a>) {
    e.mock_all_auths();
    let contract_id = e
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let stellar_asset_client = StellarAssetClient::new(e, &contract_id);
    let token_client = TokenClient::new(e, &contract_id);
    (contract_id, stellar_asset_client, token_client)
}

// ══════════════════════════════════════════════════════════════════════════════
// ── INITIALIZATION ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_initialization() {
    let env = Env::default();
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 6000,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 4000,
            },
        ],
    );

    let result = client.try_init(&admin, &shares);
    assert_eq!(result, Ok(Ok(())));
}

#[test]
fn test_init_invalid_shares_sum() {
    let env = Env::default();
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient1.clone(),
            basis_points: 5000,
        }],
    );

    let result = client.try_init(&admin, &shares);
    assert_eq!(result, Err(Ok(RevenueSplitError::BasisPointsSumMismatch)));
}

#[test]
fn test_init_duplicate_recipient() {
    let env = Env::default();
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: recipient,
                basis_points: 5000,
            },
        ],
    );

    let result = client.try_init(&admin, &shares);
    assert_eq!(result, Err(Ok(RevenueSplitError::DuplicateRecipient)));
}

#[test]
fn test_double_init() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10000,
        }],
    );

    client.init(&admin, &shares);
    let result = client.try_init(&admin, &shares);
    assert_eq!(result, Err(Ok(RevenueSplitError::AlreadyInitialized)));
}

// ══════════════════════════════════════════════════════════════════════════════
// ── DISTRIBUTION ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_distribution() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let contract_client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);
    let recipient3 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 3000,
            },
            RecipientShare {
                destination: recipient3.clone(),
                basis_points: 2000,
            },
        ],
    );

    contract_client.init(&admin, &shares);

    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &1000);

    contract_client.distribute(&token_id, &sender, &1000);

    assert_eq!(token_client.balance(&sender), 0);
    assert_eq!(token_client.balance(&recipient1), 500);
    assert_eq!(token_client.balance(&recipient2), 300);
    assert_eq!(token_client.balance(&recipient3), 200);
}

#[test]
fn test_distribution_rounding_never_over_distributes() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let contract_client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);
    let recipient3 = Address::generate(&env);

    // Three shares that sum to 10000 bp but produce a remainder for
    // amounts that are not exact multiples of 3.
    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 3333,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 3333,
            },
            RecipientShare {
                destination: recipient3.clone(),
                basis_points: 3334,
            },
        ],
    );

    contract_client.init(&admin, &shares);

    let amount: i128 = 10;
    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &amount);

    contract_client.distribute(&token_id, &sender, &amount);

    let bal1 = token_client.balance(&recipient1);
    let bal2 = token_client.balance(&recipient2);
    let bal3 = token_client.balance(&recipient3);

    assert_eq!(
        bal1 + bal2 + bal3,
        9,
        "floor rounding must never distribute more than the input amount"
    );
    assert!(bal1 + bal2 + bal3 <= amount);

    // One stroop of dust remains with the sender rather than overpaying recipients.
    assert_eq!(token_client.balance(&sender), 1);

    // recipient3 (last) holds the remainder: 10 - 3 - 3 = 4.
    assert_eq!(
        bal1, 3,
        "recipient1 should receive floor(10 * 3333 / 10000) = 3"
    );
    assert_eq!(
        bal2, 3,
        "recipient2 should receive floor(10 * 3333 / 10000) = 3"
    );
    assert_eq!(
        bal3, 3,
        "recipient3 should receive floor(10 * 3334 / 10000) = 3"
    );
}

#[test]
fn test_update_recipients() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient1.clone(),
            basis_points: 10000,
        }],
    );
    client.init(&admin, &shares);

    let recipient2 = Address::generate(&env);
    let new_shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 5000,
            },
        ],
    );

    client.update_recipients(&new_shares);
}


// ══════════════════════════════════════════════════════════════════════════════
// ── VERSION METADATA TEST (Issue #1606) ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_version_metadata() {
    let version = RevenueSplitContract::version();
    assert_eq!(version, (1, 0, 0));
}
