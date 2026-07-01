#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

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

fn setup_with_account(
    client: &OrgUsdContractClient,
    env: &Env,
) -> Address {
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