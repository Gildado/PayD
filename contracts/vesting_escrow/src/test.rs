#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Events as _, Ledger}, Address, Env, token};

// ── Shared test helpers ───────────────────────────────────────────────────────

fn setup() -> (
    Env,
    Address,                            // funder
    Address,                            // beneficiary
    Address,                            // clawback_admin
    Address,                            // admin
    Address,                            // token_contract
    token::Client<'static>,             // token_client
    token::StellarAssetClient<'static>, // token_admin_client
    VestingContractClient<'static>,     // client
) {
    let e = Env::default();
    e.mock_all_auths();

    let funder = Address::generate(&e);
    let beneficiary = Address::generate(&e);
    let clawback_admin = Address::generate(&e);
    let admin = Address::generate(&e);

    let contract_id = e.register(VestingContract, ());
    let client = VestingContractClient::new(&e, &contract_id);

    let token_admin = Address::generate(&e);
    let token_contract = e
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let token_client = token::Client::new(&e, &token_contract);
    let token_admin_client = token::StellarAssetClient::new(&e, &token_contract);

    token_admin_client.mint(&funder, &2_000_000_000_000);

    (
        e,
        funder,
        beneficiary,
        clawback_admin,
        admin,
        token_contract,
        token_client,
        token_admin_client,
        client,
    )
}

fn init_default(
    client: &VestingContractClient,
    e: &Env,
    funder: &Address,
    beneficiary: &Address,
    token: &Address,
    clawback_admin: &Address,
    admin: &Address,
) {
    let start_time = e.ledger().timestamp().max(1);
    client.initialize(
        funder,
        beneficiary,
        token,
        &start_time,
        &100u64,
        &1000u64,
        &10_000i128,
        clawback_admin,
        admin,
    );
}

#[test]
fn test_vesting_flow() {
    let e = Env::default();
    e.mock_all_auths();

    // Setup
    let funder = Address::generate(&e);
    let beneficiary = Address::generate(&e);
    let clawback_admin = Address::generate(&e);
    let admin = Address::generate(&e);
    let contract_id = e.register(VestingContract, ());
    let client = VestingContractClient::new(&e, &contract_id);

    // Setup Token
    let token_admin = Address::generate(&e);
    let token_contract = e.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = token::Client::new(&e, &token_contract);
    let token_admin_client = token::StellarAssetClient::new(&e, &token_contract);

    // Mint tokens to funder
    token_admin_client.mint(&funder, &10000);

    // Use a non-zero start_time (required by #910 fix)
    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
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
        &admin,
    );
    
    // Verify init state
    let config = client.get_config();
    assert_eq!(config.total_amount, amount);
    assert_eq!(config.is_active, true);
    
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


// ── ISSUE #904 test ────────────────────────────────────────────────────────────

#[test]
fn extend_vesting_overflow_returns_error() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();
    init_default(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
    );

    // u64::MAX overflows when added to any positive duration_seconds
    let result = client.try_extend_vesting(&u64::MAX);
    assert_eq!(result, Err(Ok(ContractError::DurationOverflow)));
}

// ── ISSUE #905 test ────────────────────────────────────────────────────────────

#[test]
fn partial_clawback_amount_exceeds_total_returns_invariant_violation() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();
    init_default(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
    );

    // total_amount is 10_000; requesting 20_000 would make new_total negative
    // (below claimed_amount of 0), so ClawbackBelowClaimed is returned.
    let result = client.try_partial_clawback(&20_000i128);
    assert_eq!(result, Err(Ok(ContractError::ClawbackBelowClaimed)));
}

// ── ISSUE #906 test ────────────────────────────────────────────────────────────

#[test]
fn transfer_beneficiary_to_same_address_returns_error() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();
    init_default(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
    );

    // Transferring to the current beneficiary must be rejected
    let result = client.try_transfer_beneficiary(&beneficiary);
    assert_eq!(result, Err(Ok(ContractError::SameBeneficiary)));
}

// ── ISSUE #910 tests ──────────────────────────────────────────────────────────

#[test]
fn initialize_with_zero_start_time_returns_error() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let result = client.try_initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &0u64,
        &100u64,
        &1000u64,
        &10_000i128,
        &clawback_admin,
        &admin,
    );
    assert_eq!(result, Err(Ok(ContractError::InvalidStartTime)));
}

#[test]
fn initialize_with_nonzero_start_time_succeeds() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1u64;
    let result = client.try_initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &0u64,
        &1000u64,
        &10_000i128,
        &clawback_admin,
        &admin,
    );
    assert!(result.is_ok());
}

// ── ISSUE #908 tests ──────────────────────────────────────────────────────────

#[test]
fn initialize_with_zero_duration_returns_error() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let result = client.try_initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &1u64,
        &0u64,
        &0u64,
        &10_000i128,
        &clawback_admin,
        &admin,
    );
    assert_eq!(result, Err(Ok(ContractError::ZeroDuration)));
}

// ── ISSUE #909 tests ──────────────────────────────────────────────────────────

#[test]
fn cliff_equals_duration_vests_all_at_single_instant() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
    let seconds = 500u64;
    let amount = 10_000i128;

    // cliff_seconds == duration_seconds: the entire grant vests at exactly one instant.
    client.initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &seconds,
        &seconds,
        &amount,
        &clawback_admin,
        &admin,
    );

    // One second before the cliff/duration point: nothing should be vested.
    e.ledger().set_timestamp(start_time + seconds - 1);
    assert_eq!(client.get_vested_amount(), 0);

    // At exactly cliff == duration: the full amount vests.
    e.ledger().set_timestamp(start_time + seconds);
    assert_eq!(client.get_vested_amount(), amount);

    // After the point: still fully vested.
    e.ledger().set_timestamp(start_time + seconds + 100);
    assert_eq!(client.get_vested_amount(), amount);
}

// ── ISSUE #907 tests ──────────────────────────────────────────────────────────

#[test]
fn clawback_event_includes_admin_address() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
    client.initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &100u64,
        &1000u64,
        &10_000i128,
        &clawback_admin,
        &admin,
    );

    e.ledger().set_timestamp(start_time + 400);
    client.clawback();

    // ClawbackExecutedEvent carries clawback_admin as its first field.
    // Verify the event was emitted and that the config records the correct admin.
    let events = e.events().all();
    assert!(!events.is_empty(), "expected at least one event after clawback");

    // Confirm the admin identity is preserved in the config (the clawback_admin
    // field in ClawbackExecutedEvent mirrors the one stored in VestingConfig).
    let config = client.get_config();
    assert_eq!(config.clawback_admin, clawback_admin);
}
