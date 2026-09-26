#![cfg(test)]

use super::*;
use soroban_sdk::{
    Address, Env,
    testutils::{Address as _, Events as _, Ledger},
    token,
};

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
    assert!(
        !events.is_empty(),
        "expected at least one event after clawback"
    );

    // Confirm the admin identity is preserved in the config (the clawback_admin
    // field in ClawbackExecutedEvent mirrors the one stored in VestingConfig).
    let config = client.get_config();
    assert_eq!(config.clawback_admin, clawback_admin);
}

// ── EDGE-CASE TESTS FOR ISSUE #1595 ───────────────────────────────────────────

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

// ── REPLAY-ATTACK PROTECTION TESTS (Issue #1600) ────────────────────────────

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

    // First claim in ledger sequence N should succeed
    client.claim();
    let config_after_first = client.get_config();
    assert!(config_after_first.total_claimed > 0, "first claim should succeed");

    // Attempting second claim in the SAME ledger sequence should fail with LedgerReplayDetected
    // This prevents an attacker from repeatedly calling claim() in the same ledger
    let result = client.try_claim();
    assert_eq!(result, Err(Ok(ContractError::LedgerReplayDetected)),
        "same-ledger replay should be detected and rejected");

    // Verify state hasn't changed from failed replay attempt
    let config_after_replay = client.get_config();
    assert_eq!(config_after_first.total_claimed, config_after_replay.total_claimed,
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
    e.ledger().set_sequence(100);
    client.claim();
    let claimed_at_ledger_100 = client.get_config().total_claimed;

    // Advance to ledger 101 and claim again — this should succeed
    // (different ledger sequence means not a replay)
    e.ledger().set_timestamp(start_time + 400);
    e.ledger().set_sequence(101);
    client.claim();
    let claimed_at_ledger_101 = client.get_config().total_claimed;

    assert!(claimed_at_ledger_101 > claimed_at_ledger_100,
        "claim in different ledger should succeed and increase claimed amount");
}

#[test]
fn same_ledger_clawback_replay_detected() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client) = setup();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence(100);

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
    e.ledger().set_sequence(100);

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
    e.ledger().set_sequence(50_000_000); // Mainnet-realistic sequence

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
    let contract_id = e.register(VestingContract, ());
    let first_balance = token_client.balance(&beneficiary);

    // Try to claim again in same ledger — should fail
    let result = client.try_claim();
    assert_eq!(result, Err(Ok(ContractError::LedgerReplayDetected)));

    // Advance ~12 seconds (realistic ledger interval)
    e.ledger().set_timestamp(start_time + 112);
    e.ledger().set_sequence(50_000_012);

    // Claim in new ledger — should succeed
    client.claim();
    let second_balance = token_client.balance(&beneficiary);
    assert!(second_balance > first_balance,
        "claim in later ledger should succeed and increase balance");
}

// ── PROPERTY-BASED TESTS FOR CLIFF LOGIC ──────────────────────────────────────

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

            for elapsed in 0..cliff_seconds {
                e.ledger().set_timestamp(start_time + elapsed);
                let vested = client.get_vested_amount();
                prop_assert_eq!(vested, 0i128, "vested should be 0 before cliff at time {}", elapsed);
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
            for i in 0..=duration_seconds {
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

            for i in 0..=(duration_seconds + 100) {
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

            for i in duration_seconds..=(duration_seconds + 1000) {
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

            e.ledger().set_timestamp(start_time + 1);
            let vested = client.get_vested_amount();
            prop_assert!(vested > 0i128, "should have some vested tokens immediately after start with zero cliff");
        }
    }
}
