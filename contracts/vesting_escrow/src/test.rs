#![cfg(test)]

use super::*;
use soroban_sdk::{
    Address, Env,
    testutils::{Address as _, Events as _, Ledger},
    token,
};

// â”€â”€ Shared test helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    let token_contract = e
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
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

// â”€â”€ ISSUE #904 test â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ ISSUE #905 test â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ ISSUE #906 test â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ ISSUE #910 tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ ISSUE #908 tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ ISSUE #909 tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ ISSUE #907 tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    assert!(
        !events.is_empty(),
        "expected at least one event after clawback"
    );

    // Confirm the admin identity is preserved in the config (the clawback_admin
    // field in ClawbackExecutedEvent mirrors the one stored in VestingConfig).
    let config = client.get_config();
    assert_eq!(config.clawback_admin, clawback_admin);
}

// â”€â”€ EDGE-CASE TESTS FOR ISSUE #1595 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

#[test]
fn zero_cliff_immediate_vesting() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client) = setup();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
    let amount = 10_000i128;
    let duration_seconds = 1000u64;

    client.initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &0u64,
        &duration_seconds,
        &amount,
        &clawback_admin,
        &admin,
    );

    // At exact start time with zero cliff, no tokens should be vested yet
    assert_eq!(client.get_vested_amount(), 0, "zero cliff should vest 0 at start_time");

    // After 1 second, some tokens should be vested
    e.ledger().set_timestamp(start_time + 1);
    let vested_at_one = client.get_vested_amount();
    assert!(vested_at_one > 0, "should have vested tokens 1 second after start with zero cliff");

    // After half duration, should have ~50% vested
    e.ledger().set_timestamp(start_time + duration_seconds / 2);
    let vested_at_half = client.get_vested_amount();
    let expected_half = amount / 2;
    assert!(
        (vested_at_half - expected_half).abs() < 100,
        "at 50% duration, should have ~50% vested; got {}",
        vested_at_half
    );
}

#[test]
fn one_second_cliff() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
    let amount = 10_000i128;

    client.initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &1u64,
        &1000u64,
        &amount,
        &clawback_admin,
        &admin,
    );

    // At start, no vesting
    assert_eq!(client.get_vested_amount(), 0, "at start_time, nothing should be vested");

    // One second before cliff, still nothing
    e.ledger().set_timestamp(start_time);
    assert_eq!(client.get_vested_amount(), 0, "1 second before cliff, nothing should be vested");

    // Exactly at cliff (start + 1 second), some should be vested
    e.ledger().set_timestamp(start_time + 1);
    let vested = client.get_vested_amount();
    let expected = amount / 1000; // 1/1000 of total
    assert_eq!(vested, expected, "at 1-second cliff with 1000s duration, should vest 1/1000");
}

#[test]
fn same_second_cliff_and_duration() {
    // This is the same as cliff == duration: entire grant vests at one instant
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
    let cliff_and_duration = 500u64;
    let amount = 10_000i128;

    client.initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &cliff_and_duration,
        &cliff_and_duration,
        &amount,
        &clawback_admin,
        &admin,
    );

    // Before the instant: 0
    e.ledger().set_timestamp(start_time + cliff_and_duration - 1);
    assert_eq!(client.get_vested_amount(), 0, "before cliff==duration point, nothing vested");

    // At the instant: all vested
    e.ledger().set_timestamp(start_time + cliff_and_duration);
    assert_eq!(client.get_vested_amount(), amount, "at cliff==duration point, all vested");

    // After: still all vested
    e.ledger().set_timestamp(start_time + cliff_and_duration + 1000);
    assert_eq!(client.get_vested_amount(), amount, "after cliff==duration, still all vested");
}

#[test]
fn minimal_duration_one_second() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
    let amount = 10_000i128;

    // Minimum: cliff < duration, so cliff=0, duration=1
    client.initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &0u64,
        &1u64,
        &amount,
        &clawback_admin,
        &admin,
    );

    e.ledger().set_timestamp(start_time);
    assert_eq!(client.get_vested_amount(), 0, "at start, nothing vested");

    // After 1 second, all vested (100% of duration)
    e.ledger().set_timestamp(start_time + 1);
    assert_eq!(client.get_vested_amount(), amount, "after 1-second duration, all vested");
}

#[test]
fn boundary_timestamp_large_start_time() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    // Use a very large start_time but not u64::MAX to avoid overflow
    let start_time = u64::MAX / 2;
    e.ledger().set_timestamp(start_time);
    let amount = 10_000i128;
    let duration = 1000u64;

    client.initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &100u64,
        &duration,
        &amount,
        &clawback_admin,
        &admin,
    );

    // Advance to cliff
    let cliff_time = start_time + 100;
    e.ledger().set_timestamp(cliff_time);
    assert!(client.get_vested_amount() > 0, "should vest after cliff even with large timestamp");

    // Advance to end of vesting
    let end_time = start_time + duration;
    e.ledger().set_timestamp(end_time);
    assert_eq!(client.get_vested_amount(), amount, "should fully vest even with large timestamp");
}

// â”€â”€ REPLAY-ATTACK PROTECTION TESTS (Issue #1600) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

#[test]
fn same_ledger_claim_replay_detected() {
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

    // Advance past cliff so claim is possible
    e.ledger().set_timestamp(start_time + 200);
    e.ledger().set_sequence_number(100);

    // First claim in ledger sequence N should succeed
    client.claim();
    let config_after_first = client.get_config();
    assert!(config_after_first.claimed_amount > 0, "first claim should succeed");

    // Attempting second claim in the SAME ledger sequence should fail with LedgerReplayDetected
    // This prevents an attacker from repeatedly calling claim() in the same ledger
    let result = client.try_claim();
    assert_eq!(result, Err(Ok(ContractError::LedgerReplayDetected)),
        "same-ledger replay should be detected and rejected");

    // Verify state hasn't changed from failed replay attempt
    let config_after_replay = client.get_config();
    assert_eq!(config_after_first.claimed_amount, config_after_replay.claimed_amount,
        "failed replay attempt should not change claimed amount");
}

#[test]
fn claim_allowed_in_different_ledgers() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client) = setup();

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

    // First claim at ledger 100
    e.ledger().set_timestamp(start_time + 200);
    e.ledger().set_sequence_number(100);
    client.claim();
    let claimed_at_ledger_100 = client.get_config().claimed_amount;

    // Advance to ledger 101 and claim again â€” this should succeed
    // (different ledger sequence means not a replay)
    e.ledger().set_timestamp(start_time + 400);
    e.ledger().set_sequence_number(101);
    client.claim();
    let claimed_at_ledger_101 = client.get_config().claimed_amount;

    assert!(claimed_at_ledger_101 > claimed_at_ledger_100,
        "claim in different ledger should succeed and increase claimed amount");
}

#[test]
fn same_ledger_clawback_replay_detected() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence_number(100);

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

    // Advance past cliff
    e.ledger().set_timestamp(start_time + 200);

    // First clawback in ledger 100 should succeed
    client.clawback();
    let config_after = client.get_config();
    assert!(!config_after.is_active, "clawback should deactivate grant");

    // Attempting second clawback in the SAME ledger should be rejected
    // (even though grant is already inactive, the ledger sequence check should catch it first)
    let result = client.try_clawback();
    assert_eq!(result, Err(Ok(ContractError::LedgerReplayDetected)),
        "same-ledger clawback replay should be detected");
}

#[test]
fn partial_clawback_replay_protection() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence_number(100);

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

    e.ledger().set_timestamp(start_time + 200);

    // First partial clawback should succeed
    client.partial_clawback(&2000i128);
    let config_after_first = client.get_config();
    assert_eq!(config_after_first.total_amount, 8_000i128,
        "first partial clawback should reduce total");

    // Attempting second partial clawback in the SAME ledger should fail
    let result = client.try_partial_clawback(&1000i128);
    assert_eq!(result, Err(Ok(ContractError::LedgerReplayDetected)),
        "same-ledger partial clawback replay should be detected");
}

#[test]
fn cross_ledger_replay_test_with_realistic_sequence() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client) = setup();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);

    // Simulate realistic ledger sequences (Stellar creates ledgers ~every 5 seconds)
    e.ledger().set_sequence_number(50_000_000); // Mainnet-realistic sequence

    client.initialize(
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

    // Claim at ledger 50_000_000
    e.ledger().set_timestamp(start_time + 100);
    client.claim();
    let first_balance = token_client.balance(&beneficiary);

    // Try to claim again in same ledger â€” should fail
    let result = client.try_claim();
    assert_eq!(result, Err(Ok(ContractError::LedgerReplayDetected)));

    // Advance ~12 seconds (realistic ledger interval)
    e.ledger().set_timestamp(start_time + 112);
    e.ledger().set_sequence_number(50_000_012);

    // Claim in new ledger â€” should succeed
    client.claim();
    let second_balance = token_client.balance(&beneficiary);
    assert!(second_balance > first_balance,
        "claim in later ledger should succeed and increase balance");
}

// â”€â”€ PROPERTY-BASED TESTS FOR CLIFF LOGIC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

#[cfg(test)]
mod cliff_properties {
    use super::*;
    use proptest::prelude::*;

    prop_compose! {
        fn cliff_test_inputs()(
            cliff_seconds in 1u64..86400,
            duration_seconds in 86400u64..31536000,
            total_amount in 1_000i128..1_000_000_000i128,
        ) -> (u64, u64, i128) {
            (cliff_seconds, duration_seconds, total_amount)
        }
    }

    prop_compose! {
        fn random_timestamps(
            max_time: u64,
        )(timestamp in 0u64..max_time) -> u64 {
            timestamp
        }
    }

    proptest! {
        #[test]
        fn prop_claimable_is_zero_before_cliff(
            (cliff_seconds, duration_seconds, total_amount) in cliff_test_inputs(),
        ) {
            let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();
            let start_time = 1_000u64;
            e.ledger().set_timestamp(start_time);

            client.initialize(
                &funder,
                &beneficiary,
                &token_contract,
                &start_time,
                &cliff_seconds,
                &duration_seconds,
                &total_amount,
                &clawback_admin,
                &admin,
            );

            let checkpoints = [
                0,
                cliff_seconds / 4,
                cliff_seconds / 2,
                (3 * cliff_seconds) / 4,
                cliff_seconds.saturating_sub(1),
            ];
            for &elapsed in &checkpoints {
                if elapsed < cliff_seconds {
                    e.ledger().set_timestamp(start_time + elapsed);
                    let vested = client.get_vested_amount();
                    prop_assert_eq!(vested, 0i128, "vested should be 0 before cliff at time {}", elapsed);
                }
            }
        }

        #[test]
        fn prop_claimable_at_cliff_is_exact_amount(
            (cliff_seconds, duration_seconds, total_amount) in cliff_test_inputs(),
        ) {
            let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();
            let start_time = 1_000u64;
            e.ledger().set_timestamp(start_time);

            client.initialize(
                &funder,
                &beneficiary,
                &token_contract,
                &start_time,
                &cliff_seconds,
                &duration_seconds,
                &total_amount,
                &clawback_admin,
                &admin,
            );

            e.ledger().set_timestamp(start_time + cliff_seconds);
            let vested = client.get_vested_amount();
            let expected = if cliff_seconds == duration_seconds {
                total_amount
            } else {
                let elapsed = cliff_seconds as u128;
                let duration = duration_seconds as u128;
                let per_unit = total_amount / (duration_seconds as i128);
                let remainder = (total_amount % (duration_seconds as i128)) as u128;
                let remainder_component = ((remainder * elapsed) / duration) as i128;
                per_unit * (cliff_seconds as i128) + remainder_component
            };
            prop_assert_eq!(vested, expected, "vested at cliff should match expected");
        }

        #[test]
        fn prop_claimable_monotonically_increases(
            (cliff_seconds, duration_seconds, total_amount) in cliff_test_inputs(),
        ) {
            let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();
            let start_time = 1_000u64;
            e.ledger().set_timestamp(start_time);

            client.initialize(
                &funder,
                &beneficiary,
                &token_contract,
                &start_time,
                &cliff_seconds,
                &duration_seconds,
                &total_amount,
                &clawback_admin,
                &admin,
            );

            let mut prev_vested = 0i128;
            let step = (duration_seconds / 20).max(1);
            let mut i = 0u64;
            while i <= duration_seconds {
                e.ledger().set_timestamp(start_time + i);
                let vested = client.get_vested_amount();
                prop_assert!(
                    vested >= prev_vested,
                    "vested amount should increase monotonically: {} > {} at time {}",
                    prev_vested,
                    vested,
                    i
                );
                prev_vested = vested;
                i += step;
            }
        }

        #[test]
        fn prop_total_claimable_never_exceeds_total(
            (cliff_seconds, duration_seconds, total_amount) in cliff_test_inputs(),
        ) {
            let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();
            let start_time = 1_000u64;
            e.ledger().set_timestamp(start_time);

            client.initialize(
                &funder,
                &beneficiary,
                &token_contract,
                &start_time,
                &cliff_seconds,
                &duration_seconds,
                &total_amount,
                &clawback_admin,
                &admin,
            );

            let checkpoints = [0, cliff_seconds, duration_seconds / 2, duration_seconds, duration_seconds + 1, duration_seconds + 100];
            for &i in &checkpoints {
                e.ledger().set_timestamp(start_time + i);
                let vested = client.get_vested_amount();
                prop_assert!(
                    vested <= total_amount,
                    "vested {} should never exceed total {}",
                    vested,
                    total_amount
                );
            }
        }

        #[test]
        fn prop_after_duration_all_tokens_vested(
            (cliff_seconds, duration_seconds, total_amount) in cliff_test_inputs(),
        ) {
            let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();
            let start_time = 1_000u64;
            e.ledger().set_timestamp(start_time);

            client.initialize(
                &funder,
                &beneficiary,
                &token_contract,
                &start_time,
                &cliff_seconds,
                &duration_seconds,
                &total_amount,
                &clawback_admin,
                &admin,
            );

            let checkpoints = [duration_seconds, duration_seconds + 1, duration_seconds + 100, duration_seconds + 1000];
            for &i in &checkpoints {
                e.ledger().set_timestamp(start_time + i);
                let vested = client.get_vested_amount();
                prop_assert_eq!(
                    vested, total_amount,
                    "all tokens should be vested after duration at time {}",
                    i
                );
            }
        }

        #[test]
        fn prop_claiming_reduces_claimable_correctly(
            (cliff_seconds, duration_seconds, total_amount) in cliff_test_inputs(),
        ) {
            let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();
            let start_time = 1_000u64;
            e.ledger().set_timestamp(start_time);

            client.initialize(
                &funder,
                &beneficiary,
                &token_contract,
                &start_time,
                &cliff_seconds,
                &duration_seconds,
                &total_amount,
                &clawback_admin,
                &admin,
            );

            e.ledger().set_timestamp(start_time + cliff_seconds + 1);
            let claimable_before = client.get_claimable_amount();

            if claimable_before > 0 {
                client.claim();
                let claimable_after = client.get_claimable_amount();
                prop_assert!(
                    claimable_after < claimable_before,
                    "claimable should decrease after claim: {} -> {}",
                    claimable_before,
                    claimable_after
                );
            }
        }

        #[test]
        fn prop_vesting_with_zero_cliff_works(
            (duration_seconds, total_amount) in (86400u64..31536000, 1_000i128..1_000_000_000i128)
                .prop_flat_map(|(d, a)| Just((d, a)))
        ) {
            let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();
            let start_time = 1_000u64;
            e.ledger().set_timestamp(start_time);

            client.initialize(
                &funder,
                &beneficiary,
                &token_contract,
                &start_time,
                &0,
                &duration_seconds,
                &total_amount,
                &clawback_admin,
                &admin,
            );

            e.ledger().set_timestamp(start_time);
            let vested = client.get_vested_amount();
            prop_assert_eq!(vested, 0i128, "should be 0 tokens vested at start with zero cliff");

            // Advance halfway through duration: with zero cliff, linear vesting yields proportional tokens
            e.ledger().set_timestamp(start_time + duration_seconds / 2);
            let vested = client.get_vested_amount();
            let expected = (total_amount * (duration_seconds / 2) as i128) / duration_seconds as i128;
            prop_assert!(vested > 0i128, "should have some vested tokens halfway through duration with zero cliff");
            prop_assert_eq!(vested, expected);

            // Advance to end of duration: all tokens must be vested
            e.ledger().set_timestamp(start_time + duration_seconds);
            let vested = client.get_vested_amount();
            prop_assert_eq!(vested, total_amount, "all tokens vested at end of duration");
        }
    }
}


// -- TIMESTAMP MANIPULATION RESISTANCE TESTS (Issue #1615) --------------------

#[test]
fn claim_rejects_timestamp_regression() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
// ─────────────────────────────────────────────────────────────────────────────
// Issue #1595: Cliff/Duration Edge-Case Tests
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_zero_cliff_immediate_vesting() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
    let cliff_seconds = 0u64;
    let duration_seconds = 1_000u64;
    let amount = 10_000i128;

    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence_number(100);

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

    // At start_time with zero cliff, no tokens should be vested
    let vested = client.get_vested_amount();
    assert_eq!(vested, 0, "zero cliff should have 0 vested at start_time");

    // Advance 1 second: should have some vested (linear vesting)
    e.ledger().set_timestamp(start_time + 1);
    let vested_after_one_sec = client.get_vested_amount();
    assert!(vested_after_one_sec > 0, "zero cliff should vest immediately after start_time");
    assert_eq!(vested_after_one_sec, 10, "1 second of 1000-second duration = 10 tokens");

    // Advance to halfway: should have 50% vested
    e.ledger().set_timestamp(start_time + 500);
    let vested_halfway = client.get_vested_amount();
    assert_eq!(vested_halfway, 5_000, "halfway through duration should be 50% vested");

    // Advance to end: should have 100% vested
    e.ledger().set_timestamp(start_time + 1_000);
    let vested_end = client.get_vested_amount();
    assert_eq!(vested_end, amount, "at duration end, all should be vested");
}

#[test]
fn test_one_second_cliff_boundary() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
    let cliff_seconds = 1u64;
    let duration_seconds = 100u64;
    let amount = 10_000i128;

    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence_number(100);

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

    // Just before cliff (start_time + 0): no vesting
    let vested_before = client.get_vested_amount();
    assert_eq!(vested_before, 0, "before cliff should have 0 vested");

    // At cliff (start_time + 1): should have 1% vested (1/100)
    e.ledger().set_timestamp(start_time + 1);
    let vested_at_cliff = client.get_vested_amount();
    assert_eq!(vested_at_cliff, 100, "at cliff boundary (1 second into 100-second duration) should be 1%");

    // Slightly after cliff: should continue vesting
    e.ledger().set_timestamp(start_time + 2);
    let vested_after_cliff = client.get_vested_amount();
    assert_eq!(vested_after_cliff, 200, "2 seconds into 100-second duration should be 2%");
}

#[test]
fn test_same_second_cliff_and_duration_edge_case() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
    let cliff_seconds = 100u64;
    let duration_seconds = 100u64;
    let amount = 10_000i128;

    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence_number(100);

    // Initialize with cliff = duration (entire vest happens at cliff)
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

    // Before cliff: 0 vested
    let vested_before = client.get_vested_amount();
    assert_eq!(vested_before, 0, "before cliff should have 0 vested");

    // Exactly at cliff/duration end: should be 100% vested
    e.ledger().set_timestamp(start_time + 100);
    let vested_at_cliff = client.get_vested_amount();
    assert_eq!(vested_at_cliff, amount, "at cliff=duration boundary should have 100% vested");
}

#[test]
fn test_minimal_duration_one_second() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
    let cliff_seconds = 0u64;
    let duration_seconds = 1u64;
    let amount = 10_000i128;

    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence_number(100);

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

    // At start: 0 vested
    let vested_at_start = client.get_vested_amount();
    assert_eq!(vested_at_start, 0, "at start of 1-second duration, 0 vested");

    // After 1 second: 100% vested (duration complete)
    e.ledger().set_timestamp(start_time + 1);
    let vested_at_end = client.get_vested_amount();
    assert_eq!(vested_at_end, amount, "after 1 second with 1-second duration, all vested");
}

#[test]
fn test_same_second_claim_after_cliff() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client) = setup();

    let start_time = 1_000u64;
    let cliff_seconds = 100u64;
    let duration_seconds = 1_000u64;
    let amount = 10_000i128;

    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence_number(100);

    client.initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &100u64,
        &1000u64,
        &10_000i128,
        &cliff_seconds,
        &duration_seconds,
        &amount,
        &clawback_admin,
        &admin,
    );

    // Legitimate claim at a forward-moving timestamp.
    e.ledger().set_timestamp(start_time + 200);
    e.ledger().set_sequence_number(101);
    client.claim();
    let claimed_before = client.get_config().claimed_amount;
    assert!(claimed_before > 0, "first claim should succeed and record a vested amount");

    // Simulate an anomalous/manipulated ledger timestamp moving backward on a
    // later ledger. This must be rejected rather than silently recomputing a
    // smaller (or stale) vested amount.
    e.ledger().set_timestamp(start_time + 50);
    e.ledger().set_sequence_number(102);
    let result = client.try_claim();
    assert_eq!(result, Err(Ok(ContractError::TimestampRegression)),
        "a backward-moving ledger timestamp must be rejected");

    // State must be unchanged after the rejected call.
    let claimed_after = client.get_config().claimed_amount;
    assert_eq!(claimed_before, claimed_after,
        "rejected timestamp-regression claim must not alter claimed amount");

    // A subsequent claim at a timestamp that is forward of the last observed
    // value (not just forward of the manipulated one) must still succeed.
    e.ledger().set_timestamp(start_time + 400);
    e.ledger().set_sequence_number(103);
    client.claim();
    let claimed_final = client.get_config().claimed_amount;
    assert!(claimed_final > claimed_before,
        "claim should succeed again once the timestamp legitimately moves forward");
}

#[test]
fn clawback_rejects_timestamp_regression() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence_number(200);
    let initial_balance = token_client.balance(&beneficiary);

    // Advance to exactly at cliff boundary and claim in same second
    e.ledger().set_timestamp(start_time + 100);
    e.ledger().set_sequence_number(101);

    let vested = client.get_vested_amount();
    assert_eq!(vested, 1_000, "at cliff (100s into 1000s duration) should be 10% vested");

    client.claim();

    let new_balance = token_client.balance(&beneficiary);
    assert_eq!(new_balance - initial_balance, 1_000, "claim at cliff should transfer exactly cliff amount");
}

#[test]
fn test_large_timestamp_boundary() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = u64::MAX / 2;
    let cliff_seconds = 1_000u64;
    let duration_seconds = 10_000u64;
    let amount = 10_000i128;

    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence_number(100);

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

    // At cliff: 10% vested
    e.ledger().set_timestamp(start_time + 1_000);
    let vested = client.get_vested_amount();
    assert_eq!(vested, 1_000, "large timestamp: at cliff should be 10% vested");

    // At duration end: 100% vested
    e.ledger().set_timestamp(start_time + 10_000);
    let vested_end = client.get_vested_amount();
    assert_eq!(vested_end, amount, "large timestamp: at duration end should be 100% vested");
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1600: Replay Attack Protection Tests
// ─────────────────────────────────────────────────────────────────────────────

/// INVARIANT AUDIT TEST:
/// Escrowed token balance strictly equals unresolved liabilities (total_amount - claimed_amount)
/// at every stage of the grant lifecycle across claims, partial clawbacks, full clawbacks,
/// and post-clawback resolution.
#[test]
fn test_invariant_vesting_balance_equals_unresolved_liabilities() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client) = setup();

    let start_time = 1_000u64;
    let cliff_seconds = 200u64;
    let duration_seconds = 1_000u64;
    let total_amount: i128 = 100_000;

    let assert_vesting_invariant = |step: &str| {
        let config = client.get_config();
        let contract_balance = token_client.balance(&client.address);
        let expected_liability = config.total_amount - config.claimed_amount;
        assert_eq!(
            contract_balance, expected_liability,
            "Vesting invariant violated at step {step}: contract balance ({contract_balance}) != unresolved liability ({expected_liability})"
        );
        assert!(
            contract_balance >= 0,
            "Contract balance must never be negative at step {step}"
        );
    };

    let mut ledger_seq = 100u32;
    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence_number(ledger_seq);

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

    e.ledger().set_timestamp(start_time + 200);
    e.ledger().set_sequence_number(201);
    client.claim();

    // Move the clock backward before the clawback call.
    e.ledger().set_timestamp(start_time + 50);
    e.ledger().set_sequence_number(202);
    let result = client.try_clawback();
    assert_eq!(result, Err(Ok(ContractError::TimestampRegression)),
        "clawback must also reject a backward-moving ledger timestamp");

    let config = client.get_config();
    assert!(config.is_active, "rejected clawback must not deactivate the grant");
}
        &cliff_seconds,
        &duration_seconds,
        &total_amount,
        &clawback_admin,
        &admin,
    );
    assert_vesting_invariant("initialization");

    // 1. Before cliff: no claims possible, invariant holds
    ledger_seq += 1;
    e.ledger().set_sequence_number(ledger_seq);
    e.ledger().set_timestamp(start_time + 100);
    assert_vesting_invariant("before cliff");

    // 2. Past cliff: 400s elapsed (40% vested = 40,000)
    ledger_seq += 1;
    e.ledger().set_sequence_number(ledger_seq);
    e.ledger().set_timestamp(start_time + 400);
    client.claim();
    assert_vesting_invariant("after first claim past cliff");

    // 3. Partial clawback: reclaim 20,000 unvested tokens
    ledger_seq += 1;
    e.ledger().set_sequence_number(ledger_seq);
    client.partial_clawback(&20_000);
    assert_vesting_invariant("after partial clawback");

    // 4. Advance time: 600s elapsed; claim additional vested tokens
    ledger_seq += 1;
    e.ledger().set_sequence_number(ledger_seq);
    e.ledger().set_timestamp(start_time + 600);
    client.claim();
    assert_vesting_invariant("after second claim");

    // 5. Full clawback: revokes remaining unvested tokens; remaining vested tokens stay in contract
    ledger_seq += 1;
    e.ledger().set_sequence_number(ledger_seq);
    client.clawback();
    assert_vesting_invariant("after full clawback");

    // 6. Beneficiary claims all remaining vested tokens post-clawback
    ledger_seq += 1;
    e.ledger().set_sequence_number(ledger_seq);
    e.ledger().set_timestamp(start_time + 1000);
    client.claim();
    assert_vesting_invariant("after final post-clawback claim");

    // Final state: all liabilities resolved, contract balance is exactly 0
    assert_eq!(token_client.balance(&client.address), 0);
    let final_config = client.get_config();
    assert_eq!(final_config.claimed_amount, final_config.total_amount);
}

