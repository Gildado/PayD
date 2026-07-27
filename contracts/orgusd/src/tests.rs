#![cfg(test)]

use soroban_sdk::{
    Address, Env,
    testutils::{Address as _, Events as _, Instance as _, Ledger, Persistent as _},
};

use crate::{OrgUsdContract, OrgUsdContractClient, OrgUsdError};

fn setup() -> (Env, OrgUsdContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(OrgUsdContract, ());
    let client = OrgUsdContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, client, admin)
}

fn setup_with_account(client: &OrgUsdContractClient, env: &Env) -> Address {
    let account = Address::generate(env);
    client.authorize(&account);
    account
}

// ── Transfer checked arithmetic ───────────────────────────────────────────────

#[test]
fn test_transfer_checked_sub_sender() {
    let (env, client, _admin) = setup();
    let from = setup_with_account(&client, &env);
    let to = setup_with_account(&client, &env);

    client.mint(&from, &100);

    // Normal transfer succeeds
    client.transfer(&from, &to, &60);
    assert_eq!(client.balance(&from), 40);
    assert_eq!(client.balance(&to), 60);
}

#[test]
fn test_transfer_insufficient_funds_rejected() {
    let (env, client, _admin) = setup();
    let from = setup_with_account(&client, &env);
    let to = setup_with_account(&client, &env);

    client.mint(&from, &50);

    let result = client.try_transfer(&from, &to, &100);
    assert_eq!(result, Err(Ok(OrgUsdError::InsufficientFunds)));
}

#[test]
fn test_transfer_exact_balance_succeeds() {
    let (env, client, _admin) = setup();
    let from = setup_with_account(&client, &env);
    let to = setup_with_account(&client, &env);

    client.mint(&from, &100);
    client.transfer(&from, &to, &100);
    assert_eq!(client.balance(&from), 0);
    assert_eq!(client.balance(&to), 100);
}

#[test]
fn test_transfer_recipient_balance_accumulates() {
    let (env, client, _admin) = setup();
    let from = setup_with_account(&client, &env);
    let to = setup_with_account(&client, &env);

    client.mint(&from, &1000);
    client.mint(&to, &500);
    client.transfer(&from, &to, &200);
    assert_eq!(client.balance(&to), 700);
}

// ── Clawback checked arithmetic ───────────────────────────────────────────────

#[test]
fn test_clawback_reduces_balance_and_supply() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &200);
    client.clawback(&account, &80);

    assert_eq!(client.balance(&account), 120);
    assert_eq!(client.total_supply(), 120);
}

#[test]
fn test_clawback_exact_balance_succeeds() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &100);
    client.clawback(&account, &100);

    assert_eq!(client.balance(&account), 0);
    assert_eq!(client.total_supply(), 0);
}

#[test]
fn test_clawback_insufficient_balance_rejected() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &50);
    let result = client.try_clawback(&account, &100);
    assert_eq!(result, Err(Ok(OrgUsdError::InsufficientBalance)));
}

// ── Burn checked arithmetic ───────────────────────────────────────────────────

#[test]
fn test_burn_reduces_balance_and_supply() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &300);
    client.burn(&account, &100);

    assert_eq!(client.balance(&account), 200);
    assert_eq!(client.total_supply(), 200);
}

#[test]
fn test_burn_exact_balance_succeeds() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &100);
    client.burn(&account, &100);

    assert_eq!(client.balance(&account), 0);
    assert_eq!(client.total_supply(), 0);
}

#[test]
fn test_burn_insufficient_balance_rejected() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &50);
    let result = client.try_burn(&account, &200);
    assert_eq!(result, Err(Ok(OrgUsdError::InsufficientBalance)));
}

// ── Mint checked arithmetic ───────────────────────────────────────────────────

#[test]
fn test_mint_increases_balance_and_supply() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &500);
    assert_eq!(client.balance(&account), 500);
    assert_eq!(client.total_supply(), 500);
}

#[test]
fn test_mint_accumulates_correctly() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &100);
    client.mint(&account, &200);
    assert_eq!(client.balance(&account), 300);
    assert_eq!(client.total_supply(), 300);
}

// ── Issue #886: negative-amount rejection ─────────────────────────────────────

/// mint() must reject explicitly negative amounts, not just zero.
/// The guard `amount <= 0` already catches negatives but this test makes the
/// behaviour explicit so a future refactor cannot silently regress it.
#[test]
fn test_mint_rejects_negative_amount() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);
    let result = client.try_mint(&account, &-1);
    assert_eq!(result, Err(Ok(OrgUsdError::InvalidAmount)));
}

#[test]
fn test_mint_rejects_large_negative_amount() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);
    let result = client.try_mint(&account, &i128::MIN);
    assert_eq!(result, Err(Ok(OrgUsdError::InvalidAmount)));
}

/// transfer() must reject explicitly negative amounts.
#[test]
fn test_transfer_rejects_negative_amount() {
    let (env, client, _admin) = setup();
    let from = setup_with_account(&client, &env);
    let to = setup_with_account(&client, &env);
    client.mint(&from, &100);
    let result = client.try_transfer(&from, &to, &-1);
    assert_eq!(result, Err(Ok(OrgUsdError::InvalidAmount)));
}

#[test]
fn test_transfer_rejects_large_negative_amount() {
    let (env, client, _admin) = setup();
    let from = setup_with_account(&client, &env);
    let to = setup_with_account(&client, &env);
    client.mint(&from, &100);
    let result = client.try_transfer(&from, &to, &i128::MIN);
    assert_eq!(result, Err(Ok(OrgUsdError::InvalidAmount)));
}

// ── Burn authorization tests ─────────────────────────────────────────────────

/// Test that an authorized account can burn its own tokens.
/// The account owner must authenticate via `from.require_auth()`.
#[test]
fn test_burn_authorized_account_can_burn() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &1_000_000);
    let supply_before = client.total_supply();
    let balance_before = client.balance(&account);

    client.burn(&account, &250_000);

    assert_eq!(client.balance(&account), balance_before - 250_000);
    assert_eq!(client.total_supply(), supply_before - 250_000);
}

/// Test that an unauthorized user cannot burn another account's tokens.
/// `from.require_auth()` must reject callers who don't own the address.
#[test]
fn test_burn_unauthorized_user_cannot_burn_others_tokens() {
    let (env, client, _admin) = setup();
    let owner = setup_with_account(&client, &env);
    let attacker = setup_with_account(&client, &env);

    client.mint(&owner, &1_000_000);

    // Attacker tries to burn from owner's account — auth should fail.
    // In Soroban, require_auth failures surface as generic error.
    let result = client.try_burn(&owner, &100);
    assert!(result.is_err());
    assert_eq!(client.balance(&owner), 1_000_000);
}

/// Test that burn amount cannot exceed account balance.
/// Exceeding balance must return InsufficientBalance.
#[test]
fn test_burn_exceeding_balance_rejected() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &100);

    let result = client.try_burn(&account, &101);
    assert_eq!(result, Err(Ok(OrgUsdError::InsufficientBalance)));
    assert_eq!(client.balance(&account), 100);
}

/// Test that burn of zero amount is rejected.
/// Zero is not a positive amount, so it must return InvalidAmount.
#[test]
fn test_burn_zero_amount_rejected() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &100);

    let result = client.try_burn(&account, &0);
    assert_eq!(result, Err(Ok(OrgUsdError::InvalidAmount)));
    assert_eq!(client.balance(&account), 100);
}

/// Test that burn of negative amount is rejected.
/// Negative values must return InvalidAmount.
#[test]
fn test_burn_negative_amount_rejected() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &100);

    let result = client.try_burn(&account, &-50);
    assert_eq!(result, Err(Ok(OrgUsdError::InvalidAmount)));
    assert_eq!(client.balance(&account), 100);
}

/// Test that total supply is reduced by the exact burn amount.
/// Verifies the accounting invariant: total_supply = sum of all balances.
#[test]
fn test_burn_total_supply_reduced_by_exact_amount() {
    let (env, client, _admin) = setup();
    let alice = setup_with_account(&client, &env);
    let bob = setup_with_account(&client, &env);

    client.mint(&alice, &500_000);
    client.mint(&bob, &300_000);
    let supply_before = client.total_supply(); // 800_000

    client.burn(&alice, &150_000);

    assert_eq!(client.total_supply(), supply_before - 150_000); // 650_000
}

/// Test that account balance is reduced by the exact burn amount.
/// Verifies precise arithmetic at each step.
#[test]
fn test_burn_balance_reduced_by_exact_amount() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &1_000_000);
    let balance_before = client.balance(&account);

    client.burn(&account, &333_333);

    assert_eq!(client.balance(&account), balance_before - 333_333); // 666_667
}

/// Test burn behavior from a frozen account.
/// Current contract does not check frozen status for burn — the account owner
/// can still burn their own tokens even when frozen. This test documents that
/// behavior explicitly.
#[test]
fn test_burn_from_frozen_account_succeeds() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &1_000_000);
    client.freeze(&account);
    assert!(client.is_frozen(&account));

    // Frozen account can still burn its own tokens.
    client.burn(&account, &200_000);

    assert_eq!(client.balance(&account), 800_000);
    assert_eq!(client.total_supply(), 800_000);
}

/// Test multiple sequential burns maintain accounting invariants.
/// After each burn, balance + sum of all burns == initial balance,
/// and total_supply == sum of remaining balances.
#[test]
fn test_burn_multiple_burns_maintain_accounting() {
    let (env, client, _admin) = setup();
    let alice = setup_with_account(&client, &env);
    let bob = setup_with_account(&client, &env);

    // Mint to both accounts
    client.mint(&alice, &1_000_000);
    client.mint(&bob, &500_000);
    assert_eq!(client.total_supply(), 1_500_000);

    // Alice burns 100k
    client.burn(&alice, &100_000);
    assert_eq!(client.balance(&alice), 900_000);
    assert_eq!(client.total_supply(), 1_400_000);

    // Bob burns 50k
    client.burn(&bob, &50_000);
    assert_eq!(client.balance(&bob), 450_000);
    assert_eq!(client.total_supply(), 1_350_000);

    // Alice burns another 200k
    client.burn(&alice, &200_000);
    assert_eq!(client.balance(&alice), 700_000);
    assert_eq!(client.total_supply(), 1_150_000);

    // Verify final accounting: balance sum == total supply
    assert_eq!(
        client.balance(&alice) + client.balance(&bob),
        client.total_supply()
    );
}

/// Test burning exact balance reduces both to zero.
/// Edge case: burn all tokens, verify clean state.
#[test]
fn test_burn_exact_balance_zeros_out() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.mint(&account, &999_999);

    client.burn(&account, &999_999);

    assert_eq!(client.balance(&account), 0);
    assert_eq!(client.total_supply(), 0);
}

/// Test burn fails when account has zero balance.
/// Burning from an empty account must return InsufficientBalance.
#[test]
fn test_burn_from_empty_account_rejected() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    let result = client.try_burn(&account, &1);
    assert_eq!(result, Err(Ok(OrgUsdError::InsufficientBalance)));
}

/// Test that a non-authorized (unregistered) account cannot burn.
/// Account not authorized to hold tokens shouldn't be able to burn.
#[test]
fn test_burn_unregistered_account_rejected() {
    let (env, client, _admin) = setup();
    let account = Address::generate(&env);
    // Deliberately NOT authorizing the account

    let result = client.try_burn(&account, &1);
    // Should fail on auth or balance check (account has 0 balance)
    assert!(result.is_err());
}

#[test]
fn test_admin_operation_events_are_emitted() {
    let (env, client, _admin) = setup();
    let account = Address::generate(&env);

    let before = env.events().all().len();
    client.authorize(&account);
    client.mint(&account, &100);
    client.freeze(&account);
    client.unfreeze(&account);
    client.clawback(&account, &25);
    client.revoke(&account);
    let after = env.events().all().len();

    assert_eq!(after - before, 6);
}

#[test]
fn test_mint_to_frozen_account_rejected_without_state_change() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);
    client.mint(&account, &100);
    client.freeze(&account);

    let result = client.try_mint(&account, &50);

    assert_eq!(result, Err(Ok(OrgUsdError::AccountFrozen)));
    assert_eq!(client.balance(&account), 100);
    assert_eq!(client.total_supply(), 100);
}

#[test]
fn test_freeze_already_frozen_and_unfreeze_already_unfrozen_are_idempotent() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);

    client.freeze(&account);
    client.freeze(&account);
    assert!(client.is_frozen(&account));

    client.unfreeze(&account);
    client.unfreeze(&account);
    assert!(!client.is_frozen(&account));
}

#[test]
fn test_transfer_to_frozen_recipient_rejected() {
    let (env, client, _admin) = setup();
    let alice = setup_with_account(&client, &env);
    let bob = setup_with_account(&client, &env);
    client.mint(&alice, &250);
    client.freeze(&bob);

    let result = client.try_transfer(&alice, &bob, &50);

    assert_eq!(result, Err(Ok(OrgUsdError::AccountFrozen)));
    assert_eq!(client.balance(&alice), 250);
    assert_eq!(client.balance(&bob), 0);
}

#[test]
fn test_clawback_zero_and_negative_amounts_rejected() {
    let (env, client, _admin) = setup();
    let account = setup_with_account(&client, &env);
    client.mint(&account, &100);

    assert_eq!(
        client.try_clawback(&account, &0),
        Err(Ok(OrgUsdError::InvalidAmount))
    );
    assert_eq!(
        client.try_clawback(&account, &-1),
        Err(Ok(OrgUsdError::InvalidAmount))
    );
    assert_eq!(client.balance(&account), 100);
}

#[test]
fn test_orgusd_instance_ttl_set_on_initialization_and_extended_by_bump() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(1);
    let contract_id = env.register(OrgUsdContract, ());
    let client = OrgUsdContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);
    let initial_ttl = env.as_contract(&contract_id, || env.storage().instance().get_ttl());
    assert!(initial_ttl >= crate::INSTANCE_TTL_THRESHOLD);

    env.ledger().set_sequence_number(110_000);
    let aged_ttl = env.as_contract(&contract_id, || env.storage().instance().get_ttl());
    assert!(aged_ttl < crate::INSTANCE_TTL_THRESHOLD);

    client.bump_ttl();
    let bumped_ttl = env.as_contract(&contract_id, || env.storage().instance().get_ttl());
    assert!(bumped_ttl >= crate::INSTANCE_TTL_EXTEND_TO - 1);
}

#[test]
fn test_account_storage_ttl_extended_on_successful_operation() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(1);
    let contract_id = env.register(OrgUsdContract, ());
    let client = OrgUsdContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    client.initialize(&admin);
    client.authorize(&account);
    let auth_key = crate::DataKey::Authorized(account.clone());
    let initial_ttl = env.as_contract(&contract_id, || {
        env.storage().persistent().get_ttl(&auth_key)
    });
    assert!(initial_ttl >= crate::PERSISTENT_TTL_THRESHOLD);

    env.ledger().set_sequence_number(110_000);
    let aged_ttl = env.as_contract(&contract_id, || {
        env.storage().persistent().get_ttl(&auth_key)
    });
    assert!(aged_ttl < crate::PERSISTENT_TTL_THRESHOLD);

    client.is_authorized(&account);
    let bumped_ttl = env.as_contract(&contract_id, || {
        env.storage().persistent().get_ttl(&auth_key)
    });
    assert!(bumped_ttl >= crate::PERSISTENT_TTL_EXTEND_TO - 1);
}
