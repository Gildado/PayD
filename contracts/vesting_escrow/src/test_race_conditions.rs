#![cfg(test)]

use super::*;
use soroban_sdk::{
    Address, Env,
    testutils::{Address as _, Ledger},
    token,
};

// -- Race-condition tests for concurrent withdrawal claims (Issue #1616) --
//
// Soroban contract calls execute atomically within a ledger, so a "race"
// between two would-be concurrent transactions is modeled here as two calls
// submitted for the same ledger sequence number. These tests go beyond the
// existing replay-detection tests (Issue #1600) by asserting on actual token
// balances, not just config/error state, and by covering a race between two
// *different* withdrawal paths (claim vs. clawback) that touch the same
// escrowed funds.

fn setup_race() -> (
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

/// Two claim attempts racing for the same ledger must not result in a
/// double payout: the loser of the race must transfer zero tokens.
#[test]
fn same_ledger_concurrent_claims_move_tokens_exactly_once() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client) =
        setup_race();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence_number(100);

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

    e.ledger().set_timestamp(start_time + 300);

    // "Transaction A" wins the race.
    client.claim();
    let balance_after_winner = token_client.balance(&beneficiary);
    assert!(balance_after_winner > 0, "winning claim should transfer tokens");

    // "Transaction B" races for the same ledger sequence and must lose.
    let result = client.try_claim();
    assert_eq!(
        result,
        Err(Ok(ContractError::LedgerReplayDetected)),
        "concurrent same-ledger claim must be rejected"
    );

    let balance_after_loser = token_client.balance(&beneficiary);
    assert_eq!(
        balance_after_winner, balance_after_loser,
        "losing side of a claim race must not cause a double payout"
    );

    let config = client.get_config();
    assert_eq!(config.claimed_amount, balance_after_winner);
}

/// A claim (beneficiary withdrawal) and a clawback (admin withdrawal) racing
/// for the same ledger use independent replay guards, so both may legally
/// execute in the same ledger. The invariant that must hold regardless of
/// ordering is conservation of funds.
#[test]
fn claim_and_clawback_race_in_same_ledger_conserve_total_funds() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client) =
        setup_race();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence_number(200);

    let total_amount = 10_000i128;
    client.initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &0u64,
        &1000u64,
        &total_amount,
        &clawback_admin,
        &admin,
    );

    e.ledger().set_timestamp(start_time + 300);

    client.claim();
    client.clawback();

    let beneficiary_balance = token_client.balance(&beneficiary);
    let clawback_admin_balance = token_client.balance(&clawback_admin);

    assert_eq!(
        beneficiary_balance + clawback_admin_balance,
        total_amount,
        "racing claim + clawback in the same ledger must conserve the total grant"
    );
}

/// Simulates repeated block-by-block claim races: at every ledger, two
/// transactions attempt to claim, and only the first should ever succeed.
/// Over many ledgers this proves the guard does not drift or accumulate
/// double payouts.
#[test]
fn repeated_per_ledger_claim_races_never_exceed_vested_amount() {
    let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client) =
        setup_race();

    let start_time = 1_000u64;
    e.ledger().set_timestamp(start_time);
    e.ledger().set_sequence_number(1_000);

    let total_amount = 10_000i128;
    client.initialize(
        &funder,
        &beneficiary,
        &token_contract,
        &start_time,
        &0u64,
        &1000u64,
        &total_amount,
        &clawback_admin,
        &admin,
    );

    for i in 1..=5u32 {
        e.ledger().set_sequence_number(1_000 + i);
        e.ledger().set_timestamp(start_time + (i as u64) * 200);

        let balance_before = token_client.balance(&beneficiary);

        client.claim();
        let balance_after_winner = token_client.balance(&beneficiary);
        assert!(
            balance_after_winner >= balance_before,
            "claim must never decrease the beneficiary's balance"
        );

        let result = client.try_claim();
        assert_eq!(result, Err(Ok(ContractError::LedgerReplayDetected)));
        assert_eq!(
            token_client.balance(&beneficiary),
            balance_after_winner,
            "losing race attempt must not move tokens"
        );
    }

    let config = client.get_config();
    let final_vested = client.get_vested_amount();
    assert_eq!(
        config.claimed_amount, final_vested,
        "cumulative claims across repeated per-ledger races must equal exactly the vested amount"
    );
    assert!(
        config.claimed_amount <= total_amount,
        "cumulative claims must never exceed the total grant"
    );
    assert_eq!(token_client.balance(&beneficiary), config.claimed_amount);
}

