#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env, token};

#[test]
fn test_vesting_flow() {
    let e = Env::default();
    e.mock_all_auths();
    
    // Setup
    let funder = Address::generate(&e);
    let beneficiary = Address::generate(&e);
    let clawback_admin = Address::generate(&e);
    let contract_id = e.register(VestingContract, ());
    let client = VestingContractClient::new(&e, &contract_id);
    
    // Setup Token
    let token_admin = Address::generate(&e);
    let token_contract = e.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = token::Client::new(&e, &token_contract);
    let token_admin_client = token::StellarAssetClient::new(&e, &token_contract);
    
    // Mint tokens to funder
    token_admin_client.mint(&funder, &10000);
    
    let start_time = e.ledger().timestamp();
    let cliff_seconds = 100;
    let duration_seconds = 1000;
    let amount = 10000;
    
    // Initialize
    client.initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &cliff_seconds,
        &duration_seconds,
        &amount,
        &clawback_admin,
    );
    
    // Verify init state
    let config = client.get_config();
    assert_eq!(config.total_amount, amount);
    assert_eq!(config.is_active, true);
    assert_eq!(config.funder, funder);
    
    // Check contract balance
    assert_eq!(token_client.balance(&contract_id), 10000);
    assert_eq!(token_client.balance(&funder), 0);
    
    // 1. Check before cliff (time = start)
    assert_eq!(client.get_vested_amount(), 0);
    assert_eq!(client.get_claimable_amount(), 0);
    
    // 2. Advance time past cliff (time = start + 200)
    // 200 / 1000 = 20% vested
    e.ledger().set_timestamp(start_time + 200);
    
    let vested = client.get_vested_amount();
    let expected_vested = 10000 * 200 / 1000; // 2000
    assert_eq!(vested, expected_vested);
    assert_eq!(client.get_claimable_amount(), expected_vested);
    
    // 3. Claim
    client.claim();
    
    // Verify claim
    assert_eq!(token_client.balance(&beneficiary), expected_vested);
    assert_eq!(client.get_claimable_amount(), 0);
    let config_after_claim = client.get_config();
    assert_eq!(config_after_claim.claimed_amount, expected_vested);
    
    // 4. Advance time more (time = start + 500)
    // 500 / 1000 = 50% vested (total 5000)
    e.ledger().set_timestamp(start_time + 500);
    
    let vested_2 = client.get_vested_amount();
    assert_eq!(vested_2, 5000);
    // Claimable = 5000 - 2000 (already claimed) = 3000
    assert_eq!(client.get_claimable_amount(), 3000);
    
    // 5. Clawback
    // Admin revokes remaining
    // Vested so far = 5000. Unvested = 5000.
    // Contract balance = 10000 - 2000 (claimed) = 8000.
    // Clawback should send 5000 to admin.
    // Contract should keep 3000 (claimable).
    
    client.clawback();
    
    // Check admin balance
    assert_eq!(token_client.balance(&clawback_admin), 5000);
    
    // Check contract balance: 8000 - 5000 = 3000
    assert_eq!(token_client.balance(&contract_id), 3000);
    
    // Verify config update
    let config_revoked = client.get_config();
    assert_eq!(config_revoked.is_active, false);
    assert_eq!(config_revoked.total_amount, 5000); // Capped at vested amount
    
    // 6. Advance time to end
    e.ledger().set_timestamp(start_time + 2000);
    
    // Vested should still be 5000 (capped)
    assert_eq!(client.get_vested_amount(), 5000);
    
    // Beneficiary can claim the rest of vested tokens (3000)
    client.claim();
    assert_eq!(token_client.balance(&beneficiary), 2000 + 3000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn test_cancel_stream_pays_recipient_and_refunds_sender() {
    let e = Env::default();
    e.mock_all_auths();

    let funder = Address::generate(&e);
    let beneficiary = Address::generate(&e);
    let clawback_admin = Address::generate(&e);
    let contract_id = e.register(VestingContract, ());
    let client = VestingContractClient::new(&e, &contract_id);

    let token_admin = Address::generate(&e);
    let token_contract = e.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = token::Client::new(&e, &token_contract);
    let token_admin_client = token::StellarAssetClient::new(&e, &token_contract);

    token_admin_client.mint(&funder, &10_000);

    let start_time = e.ledger().timestamp();
    client.initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &100,
        &1_000,
        &10_000,
        &clawback_admin,
    );

    // 40% vested at this point => 4,000 claimable
    e.ledger().set_timestamp(start_time + 400);
    client.cancel_stream(&funder);

    // Beneficiary receives claimable portion and sender is refunded the rest.
    assert_eq!(token_client.balance(&beneficiary), 4_000);
    assert_eq!(token_client.balance(&funder), 6_000);
    assert_eq!(token_client.balance(&contract_id), 0);

    let config = client.get_config();
    assert_eq!(config.is_active, false);
    assert_eq!(config.claimed_amount, 4_000);
    assert_eq!(config.total_amount, 4_000);
}

#[test]
#[should_panic(expected = "Only sender can cancel stream")]
fn test_cancel_stream_rejects_non_sender() {
    let e = Env::default();
    e.mock_all_auths();

    let funder = Address::generate(&e);
    let beneficiary = Address::generate(&e);
    let non_sender = Address::generate(&e);
    let clawback_admin = Address::generate(&e);
    let contract_id = e.register(VestingContract, ());
    let client = VestingContractClient::new(&e, &contract_id);

    let token_admin = Address::generate(&e);
    let token_contract = e.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_admin_client = token::StellarAssetClient::new(&e, &token_contract);
    token_admin_client.mint(&funder, &1_000);

    let start_time = e.ledger().timestamp();
    client.initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &0,
        &1_000,
        &1_000,
        &clawback_admin,
    );

    client.cancel_stream(&non_sender);
}
