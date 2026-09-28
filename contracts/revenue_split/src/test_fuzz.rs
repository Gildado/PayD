//! Property-based tests for the basis-point split arithmetic (#1576).
//!
//! Exercises `preview_distribution` (which shares `build_distribution_preview`
//! with `distribute`) over random valid splits and amounts.

#![cfg(test)]

extern crate std;

use crate::{
    RecipientShare, RevenueSplitContract, RevenueSplitContractClient, RevenueSplitError,
    TOTAL_BASIS_POINTS,
};
use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, Env, Vec};

/// Random split of exactly 10_000 bps across 1..=8 recipients, each > 0.
fn shares_strategy() -> impl Strategy<Value = std::vec::Vec<u32>> {
    (1usize..=8).prop_flat_map(|n| {
        prop::collection::btree_set(1u32..TOTAL_BASIS_POINTS, n - 1).prop_map(move |cuts| {
            let mut points = std::vec![0u32];
            points.extend(cuts);
            points.push(TOTAL_BASIS_POINTS);
            points.windows(2).map(|w| w[1] - w[0]).collect()
        })
    })
}

fn setup(bps: &[u32]) -> (Env, RevenueSplitContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let mut shares = Vec::new(&env);
    for &b in bps {
        shares.push_back(RecipientShare {
            destination: Address::generate(&env),
            basis_points: b,
        });
    }
    client.init(&admin, &shares);
    // SAFETY of lifetime: env is returned alongside the client and outlives it.
    let client: RevenueSplitContractClient<'static> = unsafe { core::mem::transmute(client) };
    (env, client)
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(500))]

    /// Every recipient gets exactly floor(amount * bps / 10_000), never negative.
    #[test]
    fn each_share_is_floor_of_its_basis_points(
        bps in shares_strategy(),
        amount in 1i128..=1_000_000_000_000_000_000i128,
    ) {
        let (_env, client) = setup(&bps);
        let preview = client.preview_distribution(&amount);
        prop_assert_eq!(preview.len() as usize, bps.len());
        for (i, entry) in preview.iter().enumerate() {
            prop_assert!(entry.amount >= 0);
            prop_assert_eq!(entry.amount, amount * bps[i] as i128 / TOTAL_BASIS_POINTS as i128);
            prop_assert_eq!(entry.basis_points, bps[i]);
        }
    }

    /// Never over-distributes, and the undistributed dust is < 1 unit per recipient.
    #[test]
    fn total_never_exceeds_amount_and_dust_is_bounded(
        bps in shares_strategy(),
        amount in 1i128..=1_000_000_000_000_000_000i128,
    ) {
        let (_env, client) = setup(&bps);
        let preview = client.preview_distribution(&amount);
        let total: i128 = preview.iter().map(|e| e.amount).sum();
        prop_assert!(total <= amount);
        prop_assert!(amount - total < bps.len() as i128);
    }

    /// A single 100% recipient always receives the full amount (no rounding loss).
    #[test]
    fn single_full_share_receives_everything(amount in 1i128..=i128::MAX / TOTAL_BASIS_POINTS as i128) {
        let (_env, client) = setup(&[TOTAL_BASIS_POINTS]);
        let preview = client.preview_distribution(&amount);
        prop_assert_eq!(preview.get(0).unwrap().amount, amount);
    }

    /// Huge amounts must surface ArithmeticOverflow (or succeed) — never panic or wrap.
    #[test]
    fn huge_amounts_overflow_cleanly(
        bps in shares_strategy(),
        amount in (i128::MAX / 4)..=i128::MAX,
    ) {
        let (_env, client) = setup(&bps);
        match client.try_preview_distribution(&amount) {
            Ok(Ok(preview)) => {
                let total: i128 = preview.iter().map(|e| e.amount).sum();
                prop_assert!(total <= amount);
            }
            Ok(Err(_)) => prop_assert!(false, "unexpected conversion error"),
            Err(Ok(err)) => prop_assert_eq!(err, RevenueSplitError::ArithmeticOverflow),
            Err(Err(_)) => prop_assert!(false, "unexpected host error"),
        }
    }

    /// Non-positive amounts are always rejected with InvalidAmount.
    #[test]
    fn non_positive_amounts_are_rejected(
        bps in shares_strategy(),
        amount in i128::MIN..=0i128,
    ) {
        let (_env, client) = setup(&bps);
        match client.try_preview_distribution(&amount) {
            Err(Ok(err)) => prop_assert_eq!(err, RevenueSplitError::InvalidAmount),
            other => prop_assert!(false, "expected InvalidAmount, got {:?}", other.is_ok()),
        }
    }
}
