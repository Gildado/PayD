#![cfg(test)]

use crate::{RevenueSplitContract, RevenueSplitContractClient, RecipientShare};
use soroban_sdk::{testutils::{Address as _}, Address, Env, Vec};
use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::token::StellarAssetClient;

fn create_token_contract<'a>(e: &Env, admin: &Address) -> (Address, StellarAssetClient<'a>, TokenClient<'a>) {
    e.mock_all_auths();
    let contract_id = e.register_stellar_asset_contract(admin.clone());
    let stellar_asset_client = StellarAssetClient::new(e, &contract_id);
    let token_client = TokenClient::new(e, &contract_id);
    (contract_id, stellar_asset_client, token_client)
}

#[test]
fn test_initialization() {
    let env = Env::default();
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    let shares = Vec::from_array(&env, [
        RecipientShare { destination: recipient1.clone(), basis_points: 6000 },
        RecipientShare { destination: recipient2.clone(), basis_points: 4000 },
    ]);

    client.init(&admin, &shares);

    // Initialized correctly without panic
}

#[test]
#[should_panic(expected = "Shares must sum to 10000 basis points")]
fn test_init_invalid_shares() {
    let env = Env::default();
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);

    let shares = Vec::from_array(&env, [
        RecipientShare { destination: recipient1.clone(), basis_points: 5000 },
    ]);

    client.init(&admin, &shares);
}

#[test]
fn test_distribution() {
    let env = Env::default();
    env.mock_all_auths();

    // Create token
    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    // Setup revenue split contract
    let contract_id = env.register(RevenueSplitContract, ());
    let contract_client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);
    let recipient3 = Address::generate(&env);

    // 50%, 30%, 20%
    let shares = Vec::from_array(&env, [
        RecipientShare { destination: recipient1.clone(), basis_points: 5000 },
        RecipientShare { destination: recipient2.clone(), basis_points: 3000 },
        RecipientShare { destination: recipient3.clone(), basis_points: 2000 },
    ]);

    contract_client.init(&admin, &shares);

    // Fund a sender
    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &1000);

    // Distribute 1000 tokens
    contract_client.distribute(&token_id, &sender, &1000);

    // Verify balances
    assert_eq!(token_client.balance(&sender), 0);
    assert_eq!(token_client.balance(&recipient1), 500);
    assert_eq!(token_client.balance(&recipient2), 300);
    assert_eq!(token_client.balance(&recipient3), 200);
}

/// Verifies that when an amount does not divide evenly across basis-point
/// shares the sum of all distributed amounts still equals the input amount
/// exactly — i.e. no tokens are lost to rounding.
///
/// Remainder absorption rule: the **last** recipient in the shares list
/// receives any leftover stroop(s) that arise from integer division, so the
/// total always equals the input amount.
///
/// Example used here:
///   amount = 10, shares = [3333 bp, 3333 bp, 3334 bp] (≈ 33.33 / 33.33 / 33.34 %)
///   Integer division per recipient:
///     recipient1: 10 * 3333 / 10000 = 3  (exact)
///     recipient2: 10 * 3333 / 10000 = 3  (exact)
///     recipient3 (last): remainder = 10 - 3 - 3 = 4
///   Sum: 3 + 3 + 4 = 10  ✓
#[test]
fn test_distribution_rounding_remainder_absorbed_by_last_recipient() {
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
    let shares = Vec::from_array(&env, [
        RecipientShare { destination: recipient1.clone(), basis_points: 3333 },
        RecipientShare { destination: recipient2.clone(), basis_points: 3333 },
        RecipientShare { destination: recipient3.clone(), basis_points: 3334 },
    ]);

    contract_client.init(&admin, &shares);

    let amount: i128 = 10;
    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &amount);

    contract_client.distribute(&token_id, &sender, &amount);

    let bal1 = token_client.balance(&recipient1);
    let bal2 = token_client.balance(&recipient2);
    let bal3 = token_client.balance(&recipient3);

    // The last recipient absorbs the remainder so the total is exact.
    assert_eq!(
        bal1 + bal2 + bal3,
        amount,
        "sum of all shares must equal the input amount exactly"
    );

    // Sender's account must be empty — nothing is lost or stranded.
    assert_eq!(token_client.balance(&sender), 0);

    // recipient3 (last) holds the remainder: 10 - 3 - 3 = 4.
    assert_eq!(bal1, 3, "recipient1 should receive floor(10 * 3333 / 10000) = 3");
    assert_eq!(bal2, 3, "recipient2 should receive floor(10 * 3333 / 10000) = 3");
    assert_eq!(bal3, 4, "recipient3 (last) absorbs the rounding remainder: 10 - 3 - 3 = 4");
}

#[test]
fn test_update_recipients() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    
    // Initial 100% to recipient1
    let shares = Vec::from_array(&env, [
        RecipientShare { destination: recipient1.clone(), basis_points: 10000 },
    ]);
    client.init(&admin, &shares);

    // Update to 2 recipients perfectly
    let recipient2 = Address::generate(&env);
    let new_shares = Vec::from_array(&env, [
        RecipientShare { destination: recipient1.clone(), basis_points: 5000 },
        RecipientShare { destination: recipient2.clone(), basis_points: 5000 },
    ]);

    client.update_recipients(&new_shares);
}
