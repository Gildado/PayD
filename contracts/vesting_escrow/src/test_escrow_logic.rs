//! Comprehensive Unit Tests for Escrow Logic
//!
//! This test suite covers:
//! - Escrow fund locking and holding
//! - Vesting calculations and time-based releases
//! - Clawback mechanisms and partial releases
//! - Edge cases and security scenarios
//! - Token balance invariants
//! - Admin governance and circuit breaker tests
//! - Vesting schedule extension tests

use super::*;
use soroban_sdk::{
    Address, Env,
    testutils::{Address as _, Ledger},
    token,
};

// ══════════════════════════════════════════════════════════════════════════════
// ── TEST HELPERS ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

fn setup_escrow() -> (
    Env,
    Address,                            // funder
    Address,                            // beneficiary
    Address,                            // clawback_admin
    Address,                            // admin
    Address,                            // token_contract
    token::Client<'static>,             // token_client
    token::StellarAssetClient<'static>, // token_admin_client
    VestingContractClient<'static>,     // vesting_client
    Address,                            // contract_address
) {
    let e = Env::default();
    e.mock_all_auths();

    let funder = Address::generate(&e);
    let beneficiary = Address::generate(&e);
    let clawback_admin = Address::generate(&e);
    let admin = Address::generate(&e);

    let contract_id = e.register(VestingContract, ());
    let client = VestingContractClient::new(&e, &contract_id);
    let contract_address = contract_id.clone();

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
        contract_address,
    )
}

fn init_escrow(
    client: &VestingContractClient,
    e: &Env,
    funder: &Address,
    beneficiary: &Address,
    token: &Address,
    clawback_admin: &Address,
    admin: &Address,
    amount: i128,
    cliff_seconds: u64,
    duration_seconds: u64,
) {
    let start_time = e.ledger().timestamp().max(1);
    // Align the ledger timestamp with start_time so callers can use
    // e.ledger().timestamp() as the reference point for elapsed-time assertions.
    e.ledger().set_timestamp(start_time);
    client.initialize(
        funder,
        beneficiary,
        token,
        &start_time,
        &cliff_seconds,
        &duration_seconds,
        &amount,
        clawback_admin,
        admin,
    );
}

fn init_escrow_at(
    client: &VestingContractClient,
    funder: &Address,
    beneficiary: &Address,
    token: &Address,
    clawback_admin: &Address,
    admin: &Address,
    start_time: u64,
    amount: i128,
    cliff_seconds: u64,
    duration_seconds: u64,
) {
    client.initialize(
        funder,
        beneficiary,
        token,
        &start_time,
        &cliff_seconds,
        &duration_seconds,
        &amount,
        clawback_admin,
        admin,
    );
}

fn assert_snapshot_matches_config(
    e: &Env,
    client: &VestingContractClient,
    token_client: &token::Client<'static>,
    contract_address: &Address,
) {
    let config = client.get_config();
    let snapshot = client.get_vesting_snapshot();
    let vested = client.get_vested_amount();
    let claimable = client.get_claimable_amount();
    let locked = client.get_locked_amount();

    assert_eq!(snapshot.timestamp, e.ledger().timestamp());
    assert_eq!(snapshot.vested_amount, vested);
    assert_eq!(snapshot.claimable_amount, claimable);
    assert_eq!(snapshot.locked_amount, locked);
    assert_eq!(snapshot.claimed_amount, config.claimed_amount);
    assert_eq!(snapshot.total_amount, config.total_amount);
    assert_eq!(snapshot.is_active, config.is_active);
    assert!(snapshot.progress_bps <= 10_000);
    assert_eq!(token_client.balance(contract_address), locked);
    assert!(config.claimed_amount <= config.total_amount);
    assert!(claimable <= locked);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ESCROW FUND LOCKING TESTS ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_escrow_locks_funds_on_initialization() {
    let (
        e,
        funder,
        beneficiary,
        clawback_admin,
        admin,
        token_contract,
        token_client,
        _,
        client,
        contract_address,
    ) = setup_escrow();

    let initial_funder_balance = token_client.balance(&funder);
    let escrow_amount = 50_000;

    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        escrow_amount,
        100,
        1000,
    );

    assert_eq!(
        token_client.balance(&funder),
        initial_funder_balance - escrow_amount
    );
    assert_eq!(token_client.balance(&contract_address), escrow_amount);
    assert_eq!(token_client.balance(&beneficiary), 0);
}

#[test]
fn test_escrow_holds_funds_during_cliff_period() {
    let (
        e,
        funder,
        beneficiary,
        clawback_admin,
        admin,
        token_contract,
        token_client,
        _,
        client,
        contract_address,
    ) = setup_escrow();

    let escrow_amount = 100_000;
    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        escrow_amount,
        500,
        2000,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + 250);
    assert_eq!(client.get_vested_amount(), 0);
    assert_eq!(client.get_claimable_amount(), 0);
    assert_eq!(token_client.balance(&contract_address), escrow_amount);

    e.ledger().set_timestamp(start + 499);
    assert_eq!(client.get_vested_amount(), 0);
    assert_eq!(token_client.balance(&contract_address), escrow_amount);
}

#[test]
fn test_escrow_prevents_unauthorized_withdrawal() {
    let (
        e,
        funder,
        beneficiary,
        clawback_admin,
        admin,
        token_contract,
        token_client,
        _,
        client,
        contract_address,
    ) = setup_escrow();

    let escrow_amount = 75_000;
    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        escrow_amount,
        100,
        1000,
    );

    let start = e.ledger().timestamp();
    e.ledger().set_timestamp(start + 500);

    assert_eq!(token_client.balance(&contract_address), escrow_amount);
}

#[test]
fn test_escrow_multiple_schedules_independent() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, _, _) =
        setup_escrow();

    let contract_id_1 = e.register(VestingContract, ());
    let client_1 = VestingContractClient::new(&e, &contract_id_1);
    init_escrow(
        &client_1,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        10_000,
        100,
        1000,
    );

    let contract_id_2 = e.register(VestingContract, ());
    let client_2 = VestingContractClient::new(&e, &contract_id_2);
    init_escrow(
        &client_2,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        20_000,
        200,
        2000,
    );

    assert_eq!(token_client.balance(&contract_id_1), 10_000);
    assert_eq!(token_client.balance(&contract_id_2), 20_000);

    let start = e.ledger().timestamp();
    e.ledger().set_timestamp(start + 500);
    e.ledger().set_sequence_number(10);
    client_1.claim();

    assert_eq!(token_client.balance(&contract_id_1), 5_000);
    assert_eq!(token_client.balance(&contract_id_2), 20_000);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── VESTING CALCULATION TESTS ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_linear_vesting_calculation() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) =
        setup_escrow();

    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        10_000,
        0,
        1000,
    );

    let start = e.ledger().timestamp();

    let test_cases: [(u64, i128); 7] = [
        (0, 0),
        (100, 1_000),
        (250, 2_500),
        (500, 5_000),
        (750, 7_500),
        (1000, 10_000),
        (1500, 10_000),
    ];

    for (elapsed, expected_vested) in test_cases {
        e.ledger().set_timestamp(start + elapsed);
        assert_eq!(
            client.get_vested_amount(),
            expected_vested,
            "Failed at elapsed={}, expected={}",
            elapsed,
            expected_vested
        );
    }
}

#[test]
fn test_vesting_with_cliff_calculation() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) =
        setup_escrow();

    let cliff = 300;
    let duration = 1200;
    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        12_000,
        cliff,
        duration,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + 299);
    assert_eq!(client.get_vested_amount(), 0);

    e.ledger().set_timestamp(start + 300);
    assert_eq!(client.get_vested_amount(), 3_000);

    e.ledger().set_timestamp(start + 600);
    assert_eq!(client.get_vested_amount(), 6_000);

    e.ledger().set_timestamp(start + 1200);
    assert_eq!(client.get_vested_amount(), 12_000);
}

#[test]
fn test_claimable_amount_calculation() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) =
        setup_escrow();

    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        10_000,
        100,
        1000,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + 300);
    assert_eq!(client.get_claimable_amount(), 3_000);

    e.ledger().set_sequence_number(10);
    client.claim();

    assert_eq!(client.get_claimable_amount(), 0);

    e.ledger().set_timestamp(start + 600);
    assert_eq!(client.get_claimable_amount(), 3_000);
}

#[test]
fn test_vesting_precision_no_rounding_errors() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) =
        setup_escrow();

    let amount = 999_997;
    let duration = 997;
    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        amount,
        0,
        duration,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + 500);
    let vested = client.get_vested_amount();

    let expected = (amount * 500) / duration as i128;
    assert_eq!(vested, expected);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PARTIAL RELEASE TESTS ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_partial_claim_releases_correct_amount() {
    let (
        e,
        funder,
        beneficiary,
        clawback_admin,
        admin,
        token_contract,
        token_client,
        _,
        client,
        contract_address,
    ) = setup_escrow();

    let escrow_amount = 20_000;
    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        escrow_amount,
        100,
        1000,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + 250);
    e.ledger().set_sequence_number(10);
    client.claim();

    assert_eq!(token_client.balance(&beneficiary), 5_000);
    assert_eq!(token_client.balance(&contract_address), 15_000);

    e.ledger().set_timestamp(start + 750);
    e.ledger().set_sequence_number(20);
    client.claim();

    assert_eq!(token_client.balance(&beneficiary), 15_000);
    assert_eq!(token_client.balance(&contract_address), 5_000);
}

#[test]
fn test_multiple_small_claims() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client, _) =
        setup_escrow();

    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        10_000,
        0,
        1000,
    );

    let start = e.ledger().timestamp();
    let mut total_claimed: i128 = 0;

    for i in 1u64..=10 {
        e.ledger().set_timestamp(start + (i * 100));
        e.ledger().set_sequence_number(i as u32 * 10);
        client.claim();

        let expected_total: i128 = (i as i128) * 1_000;
        assert_eq!(token_client.balance(&beneficiary), expected_total);
        total_claimed = expected_total;
    }

    assert_eq!(total_claimed, 10_000);
}

#[test]
fn test_claim_after_full_vesting_releases_all() {
    let (
        e,
        funder,
        beneficiary,
        clawback_admin,
        admin,
        token_contract,
        token_client,
        _,
        client,
        contract_address,
    ) = setup_escrow();

    let escrow_amount = 50_000;
    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        escrow_amount,
        200,
        1000,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + 5000);
    client.claim();

    assert_eq!(token_client.balance(&beneficiary), escrow_amount);
    assert_eq!(token_client.balance(&contract_address), 0);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── CLAWBACK MECHANISM TESTS ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_clawback_returns_unvested_to_admin() {
    let (
        e,
        funder,
        beneficiary,
        clawback_admin,
        admin,
        token_contract,
        token_client,
        _,
        client,
        contract_address,
    ) = setup_escrow();

    let escrow_amount = 10_000;
    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        escrow_amount,
        100,
        1000,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + 400);
    client.clawback();

    assert_eq!(token_client.balance(&clawback_admin), 6_000);
    assert_eq!(token_client.balance(&contract_address), 4_000);
}

#[test]
fn test_clawback_before_cliff_returns_all() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client, _) =
        setup_escrow();

    let escrow_amount = 25_000;
    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        escrow_amount,
        500,
        2000,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + 250);
    client.clawback();

    assert_eq!(token_client.balance(&clawback_admin), escrow_amount);
}

#[test]
fn test_clawback_after_partial_claim() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client, _) =
        setup_escrow();

    let escrow_amount = 10_000;
    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        escrow_amount,
        100,
        1000,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + 300);
    e.ledger().set_sequence_number(10);
    client.claim();
    assert_eq!(token_client.balance(&beneficiary), 3_000);

    e.ledger().set_timestamp(start + 600);
    e.ledger().set_sequence_number(20);
    client.clawback();

    assert_eq!(token_client.balance(&clawback_admin), 4_000);

    e.ledger().set_timestamp(start + 2000);
    e.ledger().set_sequence_number(30);
    client.claim();
    assert_eq!(token_client.balance(&beneficiary), 6_000);
}

#[test]
fn test_clawback_deactivates_future_vesting() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) =
        setup_escrow();

    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        10_000,
        100,
        1000,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + 500);
    client.clawback();

    let config = client.get_config();
    assert!(!config.is_active);
    assert_eq!(config.total_amount, 5_000);

    e.ledger().set_timestamp(start + 2000);
    assert_eq!(client.get_vested_amount(), 5_000);
}

#[test]
fn test_clawback_twice_fails() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) =
        setup_escrow();

    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        10_000,
        100,
        1000,
    );

    let start = e.ledger().timestamp();
    e.ledger().set_timestamp(start + 500);

    client.clawback();
    let result = client.try_clawback();
    assert_eq!(result, Err(Ok(ContractError::AlreadyRevoked)));
}

// ══════════════════════════════════════════════════════════════════════════════
// ── TOKEN BALANCE INVARIANT TESTS ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_total_supply_conservation() {
    let (
        e,
        funder,
        beneficiary,
        clawback_admin,
        admin,
        token_contract,
        token_client,
        _,
        client,
        contract_address,
    ) = setup_escrow();

    let initial_supply = token_client.balance(&funder);
    let escrow_amount = 30_000;

    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        escrow_amount,
        100,
        1000,
    );

    let total = token_client.balance(&funder)
        + token_client.balance(&contract_address)
        + token_client.balance(&beneficiary);
    assert_eq!(total, initial_supply);

    let start = e.ledger().timestamp();
    e.ledger().set_timestamp(start + 500);
    e.ledger().set_sequence_number(10);
    client.claim();

    let total_after_claim = token_client.balance(&funder)
        + token_client.balance(&contract_address)
        + token_client.balance(&beneficiary);
    assert_eq!(total_after_claim, initial_supply);
}

#[test]
fn test_escrow_balance_equals_unclaimed_vested() {
    let (
        e,
        funder,
        beneficiary,
        clawback_admin,
        admin,
        token_contract,
        token_client,
        _,
        client,
        contract_address,
    ) = setup_escrow();

    let escrow_amount = 10_000;
    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        escrow_amount,
        0,
        1000,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + 300);
    e.ledger().set_sequence_number(5);
    client.claim();

    e.ledger().set_timestamp(start + 700);

    let config = client.get_config();
    let vested = client.get_vested_amount();
    let contract_balance = token_client.balance(&contract_address);

    assert_eq!(
        contract_balance,
        config.total_amount - config.claimed_amount
    );
    let claimable = vested - config.claimed_amount;
    assert_eq!(claimable, 4_000);
}

#[test]
fn test_no_token_loss_after_clawback_and_full_claim() {
    let (
        e,
        funder,
        beneficiary,
        clawback_admin,
        admin,
        token_contract,
        token_client,
        _,
        client,
        contract_address,
    ) = setup_escrow();

    let initial_funder_balance = token_client.balance(&funder);
    let escrow_amount = 10_000;

    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        escrow_amount,
        100,
        1000,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + 400);
    e.ledger().set_sequence_number(10);
    client.clawback();

    e.ledger().set_timestamp(start + 2000);
    e.ledger().set_sequence_number(20);
    client.claim();

    let final_total = token_client.balance(&funder)
        + token_client.balance(&contract_address)
        + token_client.balance(&beneficiary)
        + token_client.balance(&clawback_admin);

    assert_eq!(final_total, initial_funder_balance);
    assert_eq!(token_client.balance(&contract_address), 0);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── EDGE CASES AND SECURITY TESTS ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_zero_amount_escrow_fails() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) =
        setup_escrow();

    let start_time = e.ledger().timestamp().max(1);
    let result = client.try_initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &100,
        &1000,
        &0,
        &clawback_admin,
        &admin,
    );
    assert_eq!(result, Err(Ok(ContractError::InvalidAmount)));
}

#[test]
fn test_negative_amount_escrow_fails() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) =
        setup_escrow();

    let start_time = e.ledger().timestamp().max(1);
    let result = client.try_initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &100,
        &1000,
        &-1000,
        &clawback_admin,
        &admin,
    );
    assert_eq!(result, Err(Ok(ContractError::InvalidAmount)));
}

#[test]
fn test_very_large_escrow_amount() {
    let (
        e,
        funder,
        beneficiary,
        clawback_admin,
        admin,
        token_contract,
        token_client,
        token_admin_client,
        client,
        _,
    ) = setup_escrow();

    let large_amount = i128::MAX / 2;
    token_admin_client.mint(&funder, &large_amount);

    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        large_amount,
        100,
        1000,
    );

    let start = e.ledger().timestamp();
    e.ledger().set_timestamp(start + 500);
    e.ledger().set_sequence_number(10);
    client.claim();

    assert_eq!(token_client.balance(&beneficiary), large_amount / 2);
}

#[test]
fn test_very_long_vesting_duration() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) =
        setup_escrow();

    let ten_years = 10 * 365 * 24 * 60 * 60;
    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        10_000,
        0,
        ten_years,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + (ten_years / 10));
    assert_eq!(client.get_vested_amount(), 1_000);
}

#[test]
fn test_claim_with_no_vested_amount_is_noop() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client, _) =
        setup_escrow();

    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        10_000,
        500,
        1000,
    );

    let start = e.ledger().timestamp();

    e.ledger().set_timestamp(start + 100);
    client.claim();

    assert_eq!(token_client.balance(&beneficiary), 0);

    let config = client.get_config();
    assert_eq!(config.claimed_amount, 0);
}

#[test]
fn test_concurrent_escrows_same_beneficiary() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, _, _) =
        setup_escrow();

    let contract_1 = e.register(VestingContract, ());
    let client_1 = VestingContractClient::new(&e, &contract_1);
    init_escrow(
        &client_1,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        5_000,
        0,
        1000,
    );

    let contract_2 = e.register(VestingContract, ());
    let client_2 = VestingContractClient::new(&e, &contract_2);
    init_escrow(
        &client_2,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        8_000,
        0,
        2000,
    );

    let start = e.ledger().timestamp();
    e.ledger().set_timestamp(start + 1000);

    e.ledger().set_sequence_number(10);
    client_1.claim();

    e.ledger().set_sequence_number(11);
    client_2.claim();

    assert_eq!(token_client.balance(&beneficiary), 9_000);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PROPERTY-STYLE ESCROW INVARIANT TESTS ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn property_vested_preview_is_monotonic_capped_and_query_consistent() {
    let cases: [(i128, u64, u64); 5] = [
        (1, 0, 1),
        (10_000, 0, 1_000),
        (12_345, 25, 250),
        (999_997, 13, 997),
        (1_000_000_000_000, 37, 7_777),
    ];

    for (amount, cliff, duration) in cases {
        let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) =
            setup_escrow();
        init_escrow(
            &client,
            &e,
            &funder,
            &beneficiary,
            &token_contract,
            &clawback_admin,
            &admin,
            amount,
            cliff,
            duration,
        );

        let start = e.ledger().timestamp();
        let last_elapsed = duration.saturating_add(duration / 2).saturating_add(cliff);
        let mut previous_vested = 0;

        for step in 0u64..=24 {
            let elapsed = if last_elapsed == 0 {
                0
            } else {
                last_elapsed.saturating_mul(step) / 24
            };
            let timestamp = start.saturating_add(elapsed);
            e.ledger().set_timestamp(timestamp);

            let vested = client.get_vested_amount();
            let preview = client.preview_vested_amount(&timestamp);

            assert_eq!(vested, preview);
            assert!(vested >= previous_vested);
            assert!(vested >= 0);
            assert!(vested <= amount);

            if elapsed < cliff {
                assert_eq!(vested, 0);
            }
            if elapsed >= duration {
                assert_eq!(vested, amount);
            }

            previous_vested = vested;
        }
    }
}

#[test]
fn property_claiming_preserves_supply_and_locks_only_unclaimed_tokens() {
    let cases: [(i128, u64, u64, [u64; 5]); 3] = [
        (10_000, 0, 1_000, [0, 125, 500, 750, 1_000]),
        (99_999, 50, 999, [25, 50, 333, 777, 1_500]),
        (1_000_000, 100, 10_000, [99, 100, 1_000, 5_000, 10_000]),
    ];

    for (amount, cliff, duration, claim_offsets) in cases {
        let (
            e,
            funder,
            beneficiary,
            clawback_admin,
            admin,
            token_contract,
            token_client,
            _,
            client,
            contract_address,
        ) = setup_escrow();

        let initial_supply = token_client.balance(&funder);
        init_escrow(
            &client,
            &e,
            &funder,
            &beneficiary,
            &token_contract,
            &clawback_admin,
            &admin,
            amount,
            cliff,
            duration,
        );

        let start = e.ledger().timestamp();

        for (index, elapsed) in claim_offsets.iter().enumerate() {
            e.ledger().set_timestamp(start.saturating_add(*elapsed));
            e.ledger().set_sequence_number(100 + index as u32);
            client.claim();

            let config = client.get_config();
            let beneficiary_balance = token_client.balance(&beneficiary);
            let contract_balance = token_client.balance(&contract_address);
            let funder_balance = token_client.balance(&funder);

            assert_eq!(config.claimed_amount, beneficiary_balance);
            assert_eq!(contract_balance, client.get_locked_amount());
            assert_eq!(contract_balance, amount - config.claimed_amount);
            assert_eq!(
                funder_balance + beneficiary_balance + contract_balance,
                initial_supply
            );
            assert_snapshot_matches_config(&e, &client, &token_client, &contract_address);
        }
    }
}

#[test]
fn property_clawback_caps_future_vesting_and_preserves_accounting() {
    let cases: [(i128, u64, u64, u64, u64); 3] = [
        (10_000, 0, 1_000, 250, 400),
        (20_000, 100, 2_000, 500, 1_000),
        (999_997, 13, 997, 300, 700),
    ];

    for (amount, cliff, duration, claim_elapsed, clawback_elapsed) in cases {
        let (
            e,
            funder,
            beneficiary,
            clawback_admin,
            admin,
            token_contract,
            token_client,
            _,
            client,
            contract_address,
        ) = setup_escrow();

        let initial_supply = token_client.balance(&funder);
        init_escrow(
            &client,
            &e,
            &funder,
            &beneficiary,
            &token_contract,
            &clawback_admin,
            &admin,
            amount,
            cliff,
            duration,
        );

        let start = e.ledger().timestamp();
        e.ledger()
            .set_timestamp(start.saturating_add(claim_elapsed));
        e.ledger().set_sequence_number(10);
        client.claim();
        let claimed_before_clawback = client.get_config().claimed_amount;

        e.ledger()
            .set_timestamp(start.saturating_add(clawback_elapsed));
        let vested_at_clawback = client.get_vested_amount();
        e.ledger().set_sequence_number(20);
        client.clawback();

        let config_after_clawback = client.get_config();
        let capped_total = if vested_at_clawback > claimed_before_clawback {
            vested_at_clawback
        } else {
            claimed_before_clawback
        };

        assert!(!config_after_clawback.is_active);
        assert_eq!(config_after_clawback.total_amount, capped_total);
        assert_eq!(token_client.balance(&clawback_admin), amount - capped_total);
        assert_eq!(
            token_client.balance(&contract_address),
            capped_total - claimed_before_clawback
        );
        assert_snapshot_matches_config(&e, &client, &token_client, &contract_address);

        e.ledger()
            .set_timestamp(start.saturating_add(duration).saturating_add(10_000));
        assert_eq!(client.get_vested_amount(), capped_total);
        e.ledger().set_sequence_number(30);
        client.claim();

        assert_eq!(token_client.balance(&beneficiary), capped_total);
        assert_eq!(token_client.balance(&contract_address), 0);
        assert_eq!(
            token_client.balance(&funder)
                + token_client.balance(&beneficiary)
                + token_client.balance(&clawback_admin)
                + token_client.balance(&contract_address),
            initial_supply
        );
    }
}

#[test]
fn property_saturating_schedule_boundaries_do_not_overflow() {
    let (
        e,
        funder,
        beneficiary,
        clawback_admin,
        admin,
        token_contract,
        token_client,
        _,
        client,
        contract_address,
    ) = setup_escrow();

    let start_time = u64::MAX - 10;
    init_escrow_at(
        &client,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        start_time,
        10_000,
        5,
        10,
    );

    assert_eq!(client.preview_vested_amount(&(start_time + 4)), 0);
    assert_eq!(client.preview_vested_amount(&(start_time + 5)), 5_000);
    assert_eq!(client.preview_vested_amount(&u64::MAX), 10_000);

    e.ledger().set_timestamp(u64::MAX);
    e.ledger().set_sequence_number(50);
    client.claim();

    assert_eq!(token_client.balance(&beneficiary), 10_000);
    assert_eq!(token_client.balance(&contract_address), 0);
    assert_eq!(client.get_vesting_progress_bps(), 10_000);
    assert_eq!(client.get_locked_amount(), 0);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ADMIN GOVERNANCE PROPERTY TESTS ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn property_admin_can_pause_unpause_multiple_times() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) =
        setup_escrow();

    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        10_000,
        100,
        1000,
    );

    for i in 0..5 {
        client.set_paused(&true);
        assert!(client.is_paused());

        let result = client.try_claim();
        assert_eq!(result, Err(Ok(ContractError::ContractPaused)));

        client.set_paused(&false);
        assert!(!client.is_paused());

        let claim_result = client.try_claim();
        assert!(
            claim_result.is_ok(),
            "Claim should succeed after unpause (iteration {})",
            i
        );
    }
}

#[test]
fn property_admin_transfer_preserves_pause_state() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) =
        setup_escrow();

    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        10_000,
        100,
        1000,
    );

    client.set_paused(&true);
    assert!(client.is_paused());

    let new_admin = Address::generate(&e);
    client.set_admin(&new_admin);

    assert!(client.is_paused());
    assert_eq!(client.get_admin(), new_admin);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PARTIAL CLAWBACK PROPERTY TESTS ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn property_partial_clawback_maintains_supply_conservation() {
    let (
        e,
        funder,
        beneficiary,
        clawback_admin,
        admin,
        token_contract,
        token_client,
        _,
        client,
        contract_address,
    ) = setup_escrow();

    let initial_supply = token_client.balance(&funder);
    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        20_000,
        100,
        1000,
    );

    let start = e.ledger().timestamp();
    e.ledger().set_timestamp(start + 300);
    client.partial_clawback(&5000);

    let total = token_client.balance(&funder)
        + token_client.balance(&contract_address)
        + token_client.balance(&beneficiary)
        + token_client.balance(&clawback_admin);

    assert_eq!(total, initial_supply);
}

#[test]
fn property_extend_vesting_and_partial_clawback_compose() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client, _) =
        setup_escrow();

    init_escrow(
        &client,
        &e,
        &funder,
        &beneficiary,
        &token_contract,
        &clawback_admin,
        &admin,
        20_000,
        100,
        1000,
    );

    let start = e.ledger().timestamp();
    e.ledger().set_timestamp(start + 300);

    client.extend_vesting(&500);
    assert_eq!(client.get_config().duration_seconds, 1500);

    client.partial_clawback(&5000);
    let config = client.get_config();
    assert_eq!(config.total_amount, 15000);
    assert!(config.is_active);

    e.ledger().set_timestamp(start + 1000);
    e.ledger().set_sequence_number(20);
    client.claim();
    assert!(token_client.balance(&beneficiary) > 0);
}
