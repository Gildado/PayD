#![cfg(test)]

//! Fuzz and Property-Based Tests for Vesting Escrow Contract (#1057)
//!
//! Uses proptest to systematically explore the state space with 1000+ random inputs per property.
//! Tests key financial and state invariants:
//! 1. Total claimed never exceeds total vested.
//! 2. Clawback amount never exceeds available unvested balance.
//! 3. Extending schedule always increases schedule duration.
//! 4. Progress percentage is always between 0 and 10000 basis points.
//! 5. Claiming immediately after cliff yields exactly cliff amount.
//! 6. Vested amount is monotonically non-decreasing over time.
//! 7. Vested amount never exceeds total grant amount.
//! 8. Claimable amount plus claimed amount equals total vested amount.
//! 9. Locked amount plus claimed amount equals total grant amount.
//! 10. Partial clawback reduces total grant by exactly clawback amount.

use super::*;
use proptest::prelude::*;
use soroban_sdk::{
    Address, Env,
    testutils::{Address as _, Ledger},
    token,
};

fn setup_fuzz_escrow() -> (
    Env,
    Address,
    Address,
    Address,
    Address,
    Address,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
    VestingContractClient<'static>,
    Address,
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

    token_admin_client.mint(&funder, &1_000_000_000_000_000);

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

proptest! {
    #![proptest_config(ProptestConfig::with_cases(1000))]

    /// Property 1: Total claimed never exceeds total vested.
    /// Invariant: claimed_amount <= vested_amount for any elapsed time and claims.
    #[test]
    fn prop_claimed_never_exceeds_vested(
        total_amount in 100i128..1_000_000_000_000,
        cliff in 0u64..100_000,
        duration in 100_000u64..10_000_000,
        elapsed in 0u64..20_000_000,
    ) {
        let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) = setup_fuzz_escrow();
        let start = 1_000u64;
        client.initialize(&funder, &beneficiary, &token_contract, &start, &cliff, &duration, &total_amount, &clawback_admin, &admin);

        e.ledger().set_timestamp(start + elapsed);
        e.ledger().set_sequence_number(100);
        let _ = client.try_claim();

        let config = client.get_config();
        let vested = client.get_vested_amount();
        prop_assert!(config.claimed_amount <= vested, "Claimed {} > Vested {}", config.claimed_amount, vested);
    }

    /// Property 2: Clawback amount never exceeds available unvested balance.
    /// Invariant: unvested_returned <= total_amount - claimed_amount.
    #[test]
    fn prop_clawback_never_exceeds_available_balance(
        total_amount in 1_000i128..1_000_000_000,
        cliff in 0u64..10_000,
        duration in 10_000u64..1_000_000,
        elapsed in 0u64..2_000_000,
    ) {
        let (e, funder, beneficiary, clawback_admin, admin, token_contract, token_client, _, client, _) = setup_fuzz_escrow();
        let start = 1_000u64;
        client.initialize(&funder, &beneficiary, &token_contract, &start, &cliff, &duration, &total_amount, &clawback_admin, &admin);

        e.ledger().set_timestamp(start + elapsed);
        e.ledger().set_sequence_number(100);

        let initial_clawback_bal = token_client.balance(&clawback_admin);
        let config_before = client.get_config();
        let _ = client.try_clawback();

        let final_clawback_bal = token_client.balance(&clawback_admin);
        let clawback_received = final_clawback_bal - initial_clawback_bal;
        let available = config_before.total_amount - config_before.claimed_amount;

        prop_assert!(clawback_received <= available, "Clawback received {} > Available {}", clawback_received, available);
    }

    /// Property 3: Extending schedule always increases total schedule duration.
    /// Invariant: new_duration_seconds == old_duration_seconds + extension_seconds > old_duration_seconds.
    #[test]
    fn prop_extending_schedule_increases_duration(
        duration in 1u64..10_000_000,
        extension in 1u64..10_000_000,
    ) {
        let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) = setup_fuzz_escrow();
        let start = 1_000u64;
        let amount = 100_000i128;
        let cliff = 0u64;
        client.initialize(&funder, &beneficiary, &token_contract, &start, &cliff, &duration, &amount, &clawback_admin, &admin);

        e.ledger().set_timestamp(start + 10);
        let res = client.try_extend_vesting(&extension);
        if res.is_ok() {
            let new_duration = client.get_config().duration_seconds;
            prop_assert_eq!(new_duration, duration + extension);
            prop_assert!(new_duration > duration);
        }
    }

    /// Property 4: Progress percentage is always between 0 and 10000 basis points.
    /// Invariant: 0 <= get_vesting_progress_bps() <= 10_000 for any timestamp.
    #[test]
    fn prop_progress_bps_bounded(
        total_amount in 1i128..1_000_000_000_000,
        cliff in 0u64..1_000_000,
        duration in 1_000_000u64..100_000_000,
        timestamp in 0u64..200_000_000,
    ) {
        let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) = setup_fuzz_escrow();
        let start = 1_000u64;
        client.initialize(&funder, &beneficiary, &token_contract, &start, &cliff, &duration, &total_amount, &clawback_admin, &admin);

        e.ledger().set_timestamp(timestamp);
        let progress = client.get_vesting_progress_bps();
        prop_assert!(progress <= 10_000, "Progress bps {} > 10000", progress);
    }

    /// Property 5: Claiming immediately after cliff yields exactly cliff amount.
    /// Invariant: vested_amount at start + cliff == (total_amount * cliff) / duration.
    #[test]
    fn prop_claim_after_cliff_yields_exact_cliff_amount(
        total_amount in 1_000i128..1_000_000_000,
        cliff in 100u64..100_000,
        duration in 100_000u64..1_000_000,
    ) {
        let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) = setup_fuzz_escrow();
        let start = 1_000u64;
        client.initialize(&funder, &beneficiary, &token_contract, &start, &cliff, &duration, &total_amount, &clawback_admin, &admin);

        e.ledger().set_timestamp(start + cliff);
        let vested = client.get_vested_amount();
        let expected = (total_amount * cliff as i128) / duration as i128;
        prop_assert_eq!(vested, expected, "Vested at cliff {} != expected {}", vested, expected);
    }

    /// Property 6: Vested amount is monotonically non-decreasing over time.
    /// Invariant: for t1 <= t2, vested(t1) <= vested(t2).
    #[test]
    fn prop_vested_amount_monotonic(
        total_amount in 100i128..1_000_000_000_000,
        cliff in 0u64..10_000,
        duration in 10_000u64..10_000_000,
        t1_offset in 0u64..10_000_000,
        dt in 0u64..10_000_000,
    ) {
        let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) = setup_fuzz_escrow();
        let start = 1_000u64;
        client.initialize(&funder, &beneficiary, &token_contract, &start, &cliff, &duration, &total_amount, &clawback_admin, &admin);

        let t1 = start + t1_offset;
        let t2 = t1 + dt;

        let vested1 = client.preview_vested_amount(&t1);
        let vested2 = client.preview_vested_amount(&t2);

        prop_assert!(vested1 <= vested2, "vested(t1) {} > vested(t2) {}", vested1, vested2);
    }

    /// Property 7: Vested amount never exceeds total grant amount.
    /// Invariant: vested_amount <= total_amount for any timestamp.
    #[test]
    fn prop_vested_never_exceeds_total(
        total_amount in 1i128..1_000_000_000_000,
        cliff in 0u64..10_000,
        duration in 10_000u64..10_000_000,
        timestamp in 0u64..100_000_000,
    ) {
        let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) = setup_fuzz_escrow();
        let start = 1_000u64;
        client.initialize(&funder, &beneficiary, &token_contract, &start, &cliff, &duration, &total_amount, &clawback_admin, &admin);

        let vested = client.preview_vested_amount(&timestamp);
        prop_assert!(vested <= total_amount, "vested {} > total {}", vested, total_amount);
    }

    /// Property 8: Claimable amount plus claimed amount equals total vested amount.
    /// Invariant: claimable_amount + claimed_amount == vested_amount.
    #[test]
    fn prop_claimable_plus_claimed_equals_vested(
        total_amount in 100i128..1_000_000_000,
        cliff in 0u64..10_000,
        duration in 10_000u64..1_000_000,
        elapsed in 0u64..2_000_000,
    ) {
        let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) = setup_fuzz_escrow();
        let start = 1_000u64;
        client.initialize(&funder, &beneficiary, &token_contract, &start, &cliff, &duration, &total_amount, &clawback_admin, &admin);

        e.ledger().set_timestamp(start + elapsed);
        let vested = client.get_vested_amount();
        let claimable = client.get_claimable_amount();
        let config = client.get_config();

        prop_assert_eq!(claimable + config.claimed_amount, vested);
    }

    /// Property 9: Locked amount plus claimed amount equals total grant amount.
    /// Invariant: locked_amount + claimed_amount == total_amount.
    #[test]
    fn prop_locked_plus_claimed_equals_total(
        total_amount in 100i128..1_000_000_000,
        cliff in 0u64..10_000,
        duration in 10_000u64..1_000_000,
        elapsed in 0u64..2_000_000,
    ) {
        let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) = setup_fuzz_escrow();
        let start = 1_000u64;
        client.initialize(&funder, &beneficiary, &token_contract, &start, &cliff, &duration, &total_amount, &clawback_admin, &admin);

        e.ledger().set_timestamp(start + elapsed);
        let locked = client.get_locked_amount();
        let config = client.get_config();

        prop_assert_eq!(locked + config.claimed_amount, config.total_amount);
    }

    /// Property 10: Partial clawback reduces total grant by exactly clawback amount.
    /// Invariant: new_total_amount == old_total_amount - clawback_amount.
    #[test]
    fn prop_partial_clawback_exact_reduction(
        total_amount in 100_000i128..1_000_000_000,
        cliff in 0u64..10_000,
        duration in 10_000u64..1_000_000,
        elapsed in 0u64..500_000,
    ) {
        let (e, funder, beneficiary, clawback_admin, admin, token_contract, _, _, client, _) = setup_fuzz_escrow();
        let start = 1_000u64;
        client.initialize(&funder, &beneficiary, &token_contract, &start, &cliff, &duration, &total_amount, &clawback_admin, &admin);

        e.ledger().set_timestamp(start + elapsed);
        let vested = client.get_vested_amount();
        let unvested = total_amount - vested;

        if unvested > 10 {
            let clawback_amt = unvested / 2;
            let res = client.try_partial_clawback(&clawback_amt);
            if res.is_ok() {
                let new_total = client.get_config().total_amount;
                prop_assert_eq!(new_total, total_amount - clawback_amt);
            }
        }
    }
}
