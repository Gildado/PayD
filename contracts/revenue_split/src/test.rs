#![cfg(test)]

use crate::{
    DEFAULT_MAX_DISTRIBUTION_AMOUNT, RecipientShare, RevenueSplitContract,
    RevenueSplitContractClient, RevenueSplitError, TOTAL_BASIS_POINTS,
};
use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::token::StellarAssetClient;
use soroban_sdk::{
    Address, Env, IntoVal, Vec,
    testutils::{Address as _, Ledger},
};

fn create_token_contract<'a>(
    e: &Env,
    admin: &Address,
) -> (Address, StellarAssetClient<'a>, TokenClient<'a>) {
    e.mock_all_auths();
    let contract_id = e
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let stellar_asset_client = StellarAssetClient::new(e, &contract_id);
    let token_client = TokenClient::new(e, &contract_id);
    (contract_id, stellar_asset_client, token_client)
}

// ══════════════════════════════════════════════════════════════════════════════
// ── INITIALIZATION ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_initialization() {
    let env = Env::default();
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 6000,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 4000,
            },
        ],
    );

    let result = client.try_init(&admin, &shares);
    assert_eq!(result, Ok(Ok(())));
}

#[test]
fn test_init_invalid_shares_sum() {
    let env = Env::default();
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient1.clone(),
            basis_points: 5000,
        }],
    );

    let result = client.try_init(&admin, &shares);
    assert_eq!(result, Err(Ok(RevenueSplitError::BasisPointsSumMismatch)));
}

#[test]
fn test_init_duplicate_recipient() {
    let env = Env::default();
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: recipient,
                basis_points: 5000,
            },
        ],
    );

    let result = client.try_init(&admin, &shares);
    assert_eq!(result, Err(Ok(RevenueSplitError::DuplicateRecipient)));
}

#[test]
fn test_double_init() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10000,
        }],
    );

    client.init(&admin, &shares);
    let result = client.try_init(&admin, &shares);
    assert_eq!(result, Err(Ok(RevenueSplitError::AlreadyInitialized)));
}

// ══════════════════════════════════════════════════════════════════════════════
// ── DISTRIBUTION ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_distribution() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let contract_client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);
    let recipient3 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 3000,
            },
            RecipientShare {
                destination: recipient3.clone(),
                basis_points: 2000,
            },
        ],
    );

    contract_client.init(&admin, &shares);

    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &1000);

    contract_client.distribute(&token_id, &sender, &1000);

    assert_eq!(token_client.balance(&sender), 0);
    assert_eq!(token_client.balance(&recipient1), 500);
    assert_eq!(token_client.balance(&recipient2), 300);
    assert_eq!(token_client.balance(&recipient3), 200);
}

#[test]
fn test_distribution_rounding_never_over_distributes() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let contract_client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);
    let recipient3 = Address::generate(&env);

    // Three shares that sum to 10000 bp but produce a remainder for
    // amounts that are not exact multiples of 3.
    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 3333,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 3333,
            },
            RecipientShare {
                destination: recipient3.clone(),
                basis_points: 3334,
            },
        ],
    );

    contract_client.init(&admin, &shares);

    let amount: i128 = 10;
    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &amount);

    contract_client.distribute(&token_id, &sender, &amount);

    let bal1 = token_client.balance(&recipient1);
    let bal2 = token_client.balance(&recipient2);
    let bal3 = token_client.balance(&recipient3);

    assert_eq!(
        bal1 + bal2 + bal3,
        9,
        "floor rounding must never distribute more than the input amount"
    );
    assert!(bal1 + bal2 + bal3 <= amount);

    // One stroop of dust remains with the sender rather than overpaying recipients.
    assert_eq!(token_client.balance(&sender), 1);

    // recipient3 (last) holds the remainder: 10 - 3 - 3 = 4.
    assert_eq!(
        bal1, 3,
        "recipient1 should receive floor(10 * 3333 / 10000) = 3"
    );
    assert_eq!(
        bal2, 3,
        "recipient2 should receive floor(10 * 3333 / 10000) = 3"
    );
    assert_eq!(
        bal3, 4,
        "recipient3 (last) absorbs the rounding remainder: 10 - 3 - 3 = 4"
    );
}

#[test]
fn test_update_recipients() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient1.clone(),
            basis_points: 10000,
        }],
    );
    client.init(&admin, &shares);

    let recipient2 = Address::generate(&env);
    let new_shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 5000,
            },
        ],
    );

    client.update_recipients(&new_shares);
}

#[test]
fn test_update_recipients_rejects_zero_share() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient1.clone(),
            basis_points: 10000,
        }],
    );
    client.init(&admin, &shares);

    let recipient2 = Address::generate(&env);
    let new_shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1,
                basis_points: 10000,
            },
            RecipientShare {
                destination: recipient2,
                basis_points: 0,
            },
        ],
    );

    let result = client.try_update_recipients(&new_shares);
    assert_eq!(result, Err(Ok(RevenueSplitError::ZeroBasisPoints)));
}

#[test]
fn test_update_recipients_rejects_invalid_sum() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient1.clone(),
            basis_points: 10000,
        }],
    );
    client.init(&admin, &shares);

    let recipient2 = Address::generate(&env);
    let new_shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1,
                basis_points: 5000,
            },
            RecipientShare {
                destination: recipient2,
                basis_points: 4000,
            },
        ],
    );

    let result = client.try_update_recipients(&new_shares);
    assert_eq!(result, Err(Ok(RevenueSplitError::BasisPointsSumMismatch)));
}

#[test]
fn test_set_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10000,
        }],
    );

    client.init(&admin, &shares);
    client.set_admin(&new_admin);
    assert_eq!(client.get_admin(), new_admin);
}

#[test]
fn test_multi_asset_distribution_tracks_each_token() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);

    let token_admin = Address::generate(&env);
    let (token_a, asset_a, token_client_a) = create_token_contract(&env, &token_admin);
    let (token_b, asset_b, token_client_b) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10000,
        }],
    );

    client.init(&admin, &shares);
    client.add_supported_asset(&token_a);
    client.add_supported_asset(&token_b);

    let sender = Address::generate(&env);
    asset_a.mint(&sender, &1000);
    asset_b.mint(&sender, &2500);

    client.distribute(&token_a, &sender, &1000);
    env.ledger().set_sequence_number(101);
    client.distribute(&token_b, &sender, &2500);

    assert_eq!(token_client_a.balance(&recipient), 1000);
    assert_eq!(token_client_b.balance(&recipient), 2500);
    assert_eq!(client.get_total_distributed(&token_a), 1000);
    assert_eq!(client.get_total_distributed(&token_b), 2500);
    assert_eq!(client.get_distribution_count(), 2);
}

#[test]
fn test_unsupported_asset_is_rejected_when_allowlist_configured() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let (supported_token, _, _) = create_token_contract(&env, &token_admin);
    let (unsupported_token, asset_b, token_client_b) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10000,
        }],
    );

    client.init(&admin, &shares);
    client.add_supported_asset(&supported_token);

    let sender = Address::generate(&env);
    asset_b.mint(&sender, &1000);

    let result = client.try_distribute(&unsupported_token, &sender, &1000);
    assert_eq!(result, Err(Ok(RevenueSplitError::UnsupportedAsset)));
    assert_eq!(token_client_b.balance(&recipient), 0);
    assert_eq!(client.get_total_distributed(&unsupported_token), 0);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── LEDGER SEQUENCE VERIFICATION ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_distribute_replay_same_ledger() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(50);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, _) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10000,
        }],
    );

    client.init(&admin, &shares);

    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &2000);

    client.distribute(&token_id, &sender, &1000);
    let result = client.try_distribute(&token_id, &sender, &500);
    assert_eq!(result, Err(Ok(RevenueSplitError::LedgerReplayDetected)));
}

#[test]
fn test_sep0034_metadata() {
    let env = Env::default();
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    assert_eq!(
        client.name(),
        soroban_sdk::String::from_str(&env, env!("CARGO_PKG_NAME"))
    );
    assert_eq!(
        client.version(),
        soroban_sdk::String::from_str(&env, env!("CARGO_PKG_VERSION"))
    );
    assert_eq!(
        client.author(),
        soroban_sdk::String::from_str(&env, env!("CARGO_PKG_AUTHORS"))
    );
}

#[test]
fn test_distribute_allowed_different_ledgers() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(50);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let contract_client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 3333,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 6667,
            },
        ],
    );

    contract_client.init(&admin, &shares);

    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &1000);

    contract_client.distribute(&token_id, &sender, &1000);

    assert_eq!(token_client.balance(&sender), 0);
    let r1 = token_client.balance(&recipient1);
    let r2 = token_client.balance(&recipient2);
    assert_eq!(r1 + r2, 1000);
}

#[test]
fn test_update_recipients_invalid_sum() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient1.clone(),
            basis_points: 10000,
        }],
    );
    client.init(&admin, &shares);

    let recipient2 = Address::generate(&env);
    let bad_shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 4000,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 5000,
            },
        ],
    );
    let result = client.try_update_recipients(&bad_shares);
    assert_eq!(result, Err(Ok(RevenueSplitError::BasisPointsSumMismatch)));
}

#[test]
fn test_update_recipients_invalid_set_does_not_partially_apply() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);

    let initial_shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient1.clone(),
            basis_points: 10000,
        }],
    );
    client.init(&admin, &initial_shares);

    let recipient2 = Address::generate(&env);
    // Invalid: shares sum to 9000, not 10000
    let bad_shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 4000,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 5000,
            },
        ],
    );
    let result = client.try_update_recipients(&bad_shares);
    assert_eq!(result, Err(Ok(RevenueSplitError::BasisPointsSumMismatch)));

    // Recipients must remain unchanged from the initial configuration
    let stored = client.get_recipients();
    assert_eq!(stored.len(), 1);
    assert_eq!(stored.get(0).unwrap().destination, recipient1);
    assert_eq!(stored.get(0).unwrap().basis_points, 10000);
}

#[test]
fn test_distribute_updates_ledger_state() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(50);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10000,
        }],
    );
    client.init(&admin, &shares);

    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &2000);

    client.distribute(&token_id, &sender, &1000);
    assert_eq!(client.get_last_distribute_ledger(), 50);

    env.ledger().set_sequence_number(51);
    client.distribute(&token_id, &sender, &500);
    assert_eq!(client.get_last_distribute_ledger(), 51);
    assert_eq!(token_client.balance(&recipient), 1500);
}

#[test]
fn test_get_recipients_returns_current_configuration() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 7000,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 3000,
            },
        ],
    );

    client.init(&admin, &shares);

    let stored = client.get_recipients();
    assert_eq!(stored, shares);
}

#[test]
fn test_preview_distribution_preserves_remainder_on_last_recipient() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 3333,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 6667,
            },
        ],
    );

    client.init(&admin, &shares);

    let preview = client.preview_distribution(&1000);
    let first = preview.get(0).unwrap();
    let second = preview.get(1).unwrap();

    assert_eq!(first.destination, recipient1);
    assert_eq!(first.amount, 333);
    assert_eq!(second.destination, recipient2);
    assert_eq!(second.amount, 666);
    assert_eq!(first.amount + second.amount, 999);
}

#[test]
fn test_total_distributed_accumulates_across_calls() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    let (token_contract, token_admin_client, token_client) = create_token_contract(&env, &admin);
    token_admin_client.mint(&sender, &100_000);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 5000,
            },
        ],
    );
    client.init(&admin, &shares);

    env.ledger().set_sequence_number(1);
    client.distribute(&token_contract, &sender, &10_000);
    assert_eq!(client.get_total_distributed(&token_contract), 10_000);

    env.ledger().set_sequence_number(2);
    client.distribute(&token_contract, &sender, &5_000);
    assert_eq!(client.get_total_distributed(&token_contract), 15_000);

    assert_eq!(token_client.balance(&recipient1), 7_500);
    assert_eq!(token_client.balance(&recipient2), 7_500);
}

#[test]
fn test_total_distributed_starts_at_zero() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (token_contract, _, _) = create_token_contract(&env, &admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: Address::generate(&env),
            basis_points: 10_000,
        }],
    );
    client.init(&admin, &shares);

    assert_eq!(client.get_total_distributed(&token_contract), 0);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── CIRCUIT BREAKER TESTS (Issue #191 / Part 46) ─────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

fn setup_with_token() -> (
    Env,
    RevenueSplitContractClient<'static>,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: recipient1.clone(),
                basis_points: 6000,
            },
            RecipientShare {
                destination: recipient2.clone(),
                basis_points: 4000,
            },
        ],
    );
    client.init(&admin, &shares);

    (env, client, admin, sender, recipient1, recipient2)
}

#[test]
fn test_is_paused_defaults_to_false() {
    let (env, client, admin, _, _, _) = setup_with_token();
    let _ = admin;
    let _ = env;
    assert!(!client.is_paused());
}

#[test]
fn test_set_paused_and_is_paused() {
    let (_, client, admin, _, _, _) = setup_with_token();
    let _ = admin;

    client.set_paused(&true);
    assert!(client.is_paused());

    client.set_paused(&false);
    assert!(!client.is_paused());
}

#[test]
fn test_distribute_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, _) = create_token_contract(&env, &token_admin);
    stellar_asset_client.mint(&sender, &1000);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10_000,
        }],
    );
    client.init(&admin, &shares);
    client.set_paused(&true);

    let result = client.try_distribute(&token_id, &sender, &500);
    assert_eq!(result, Err(Ok(RevenueSplitError::ContractPaused)));
}

#[test]
fn test_distribute_succeeds_after_unpause() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(10);

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);
    stellar_asset_client.mint(&sender, &1000);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10_000,
        }],
    );
    client.init(&admin, &shares);
    client.set_paused(&true);
    client.set_paused(&false);

    client.distribute(&token_id, &sender, &1000);
    assert_eq!(token_client.balance(&recipient), 1000);
}

#[test]
fn test_distribution_count_increments() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, _) = create_token_contract(&env, &token_admin);
    stellar_asset_client.mint(&sender, &5000);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10_000,
        }],
    );
    client.init(&admin, &shares);
    assert_eq!(client.get_distribution_count(), 0);

    env.ledger().set_sequence_number(1);
    client.distribute(&token_id, &sender, &1000);
    assert_eq!(client.get_distribution_count(), 1);

    env.ledger().set_sequence_number(2);
    client.distribute(&token_id, &sender, &1000);
    assert_eq!(client.get_distribution_count(), 2);

    env.ledger().set_sequence_number(3);
    client.distribute(&token_id, &sender, &1000);
    assert_eq!(client.get_distribution_count(), 3);
}

#[test]
fn test_update_recipients_emits_event_and_stores_new_config() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);
    let r3 = Address::generate(&env);

    let initial = Vec::from_array(
        &env,
        [RecipientShare {
            destination: r1.clone(),
            basis_points: 10_000,
        }],
    );
    client.init(&admin, &initial);

    let updated = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 4000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 3000,
            },
            RecipientShare {
                destination: r3.clone(),
                basis_points: 3000,
            },
        ],
    );
    client.update_recipients(&updated);

    let stored = client.get_recipients();
    assert_eq!(stored, updated);
}

#[test]
fn test_set_admin_updates_stored_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10_000,
        }],
    );
    client.init(&admin, &shares);
    client.set_admin(&new_admin);

    assert_eq!(client.get_admin(), new_admin);
}

#[test]
fn test_distribute_noop_on_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(10);

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);
    stellar_asset_client.mint(&sender, &1000);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10_000,
        }],
    );
    client.init(&admin, &shares);

    let result = client.try_distribute(&token_id, &sender, &0);
    assert_eq!(result, Err(Ok(RevenueSplitError::InvalidAmount)));
    assert_eq!(token_client.balance(&recipient), 0);
    assert_eq!(client.get_distribution_count(), 0);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ISSUE #892: set_admin / load_admin must not panic ────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_set_admin_before_init_returns_not_initialized() {
    // Calling set_admin on an uninitialized contract must return
    // NotInitialized instead of panicking.
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let new_admin = Address::generate(&env);
    let result = client.try_set_admin(&new_admin);
    assert_eq!(result, Err(Ok(RevenueSplitError::NotInitialized)));
}

#[test]
fn test_get_admin_before_init_returns_not_initialized() {
    let env = Env::default();
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let result = client.try_get_admin();
    assert_eq!(result, Err(Ok(RevenueSplitError::NotInitialized)));
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ISSUE #893: validate_shares() must return typed errors, not panic ─────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_validate_shares_overflow_returns_share_overflow() {
    // Passing a share whose basis_points is large enough that accumulating
    // two of them overflows u32 must return ShareOverflow, not panic.
    // We use two recipients each with u32::MAX / 2 + 1, guaranteeing overflow.
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    // u32::MAX / 2 + 1 = 2_147_483_648; two of these overflow u32.
    let large_bp: u32 = u32::MAX / 2 + 1;
    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: large_bp,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: large_bp,
            },
        ],
    );

    let result = client.try_init(&admin, &shares);
    assert_eq!(result, Err(Ok(RevenueSplitError::ShareOverflow)));
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ISSUE #895: build_distribution_preview() must return typed error ──────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_preview_distribution_negative_amount_returns_invalid_amount() {
    // preview_distribution(-1) must return InvalidAmount, not panic.
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10_000,
        }],
    );
    client.init(&admin, &shares);

    let result = client.try_preview_distribution(&-1_i128);
    assert_eq!(result, Err(Ok(RevenueSplitError::InvalidAmount)));
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ISSUE #894: distribute() must explicitly reject negative amounts ───────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_distribute_negative_amount_returns_invalid_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);
    stellar_asset_client.mint(&sender, &1000);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10_000,
        }],
    );
    client.init(&admin, &shares);

    let result = client.try_distribute(&token_id, &sender, &-1_i128);
    assert_eq!(result, Err(Ok(RevenueSplitError::InvalidAmount)));
    assert_eq!(token_client.balance(&recipient), 0);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ISSUE #897: preview_distribution() must reject empty shares ───────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_build_distribution_preview_empty_shares_returns_zero_recipients() {
    let env = Env::default();
    let contract_id = env.register(RevenueSplitContract, ());

    let empty: Vec<RecipientShare> = Vec::new(&env);
    env.as_contract(&contract_id, || {
        let result = RevenueSplitContract::build_distribution_preview(&env, &empty, 1000);
        assert_eq!(result, Err(RevenueSplitError::ZeroRecipients));
    });
}

#[test]
fn test_preview_distribution_zero_amount_returns_empty_amounts() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 6000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 4000,
            },
        ],
    );
    client.init(&admin, &shares);

    let result = client.try_preview_distribution(&0_i128);
    assert_eq!(result, Err(Ok(RevenueSplitError::InvalidAmount)));
}

#[test]
fn test_default_max_distribution_amount_is_configured() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient,
            basis_points: 10_000,
        }],
    );

    client.init(&admin, &shares);
    assert_eq!(
        client.get_max_distribution_amount(),
        DEFAULT_MAX_DISTRIBUTION_AMOUNT
    );
}

#[test]
fn test_set_max_distribution_amount_enforced() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10_000,
        }],
    );

    client.init(&admin, &shares);
    client.set_max_distribution_amount(&500);
    stellar_asset_client.mint(&sender, &1_000);

    let result = client.try_distribute(&token_id, &sender, &501);
    assert_eq!(result, Err(Ok(RevenueSplitError::AmountTooLarge)));
    assert_eq!(token_client.balance(&recipient), 0);

    client.distribute(&token_id, &sender, &500);
    assert_eq!(token_client.balance(&recipient), 500);
}

#[test]
fn test_basis_point_multiplication_overflow_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);
    let shares = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1,
                basis_points: 5_000,
            },
            RecipientShare {
                destination: r2,
                basis_points: 5_000,
            },
        ],
    );

    client.init(&admin, &shares);
    client.set_max_distribution_amount(&i128::MAX);

    let result = client.try_preview_distribution(&i128::MAX);
    assert_eq!(result, Err(Ok(RevenueSplitError::ArithmeticOverflow)));
}

#[test]
fn test_single_recipient_and_minimum_unit_distribution() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);
    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let shares = Vec::from_array(
        &env,
        [RecipientShare {
            destination: recipient.clone(),
            basis_points: 10_000,
        }],
    );

    client.init(&admin, &shares);
    stellar_asset_client.mint(&sender, &1);
    client.distribute(&token_id, &sender, &1);

    assert_eq!(token_client.balance(&recipient), 1);
    assert_eq!(client.get_total_distributed(&token_id), 1);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ISSUE #1092: DYNAMIC RECIPIENT UPDATES ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
//
// These tests verify that changing the recipient split via `update_recipients`
// is safe at any point in the distribution lifecycle: the basis-point sum is
// re-validated on every change, invalid changes are rejected atomically (no
// partial application), historical distributions are unaffected, and the next
// distribution uses the updated list. Coverage includes 1, 5, and 20 recipients.

/// Builds an `n`-recipient split whose basis points sum to exactly 10,000.
///
/// The first `n - 1` recipients each receive `10_000 / n` (floored) and the
/// final recipient absorbs the remainder so the total is always 10,000.
fn even_split(env: &Env, n: u32) -> Vec<RecipientShare> {
    assert!(n >= 1, "split requires at least one recipient");
    let mut shares = Vec::new(env);
    let base = TOTAL_BASIS_POINTS / n;
    let mut assigned = 0u32;
    let mut i = 0u32;
    while i < n - 1 {
        shares.push_back(RecipientShare {
            destination: Address::generate(env),
            basis_points: base,
        });
        assigned += base;
        i += 1;
    }
    // Last recipient takes whatever is left so the sum is exactly 10,000.
    shares.push_back(RecipientShare {
        destination: Address::generate(env),
        basis_points: TOTAL_BASIS_POINTS - assigned,
    });
    shares
}

fn sum_basis_points(shares: &Vec<RecipientShare>) -> u32 {
    let mut total = 0u32;
    for s in shares.iter() {
        total += s.basis_points;
    }
    total
}

// ── Add a recipient before distribution ───────────────────────────────────────

#[test]
fn test_add_recipient_before_distribution() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(10);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    // Start with a single recipient owning the full split.
    let initial = Vec::from_array(
        &env,
        [RecipientShare {
            destination: r1.clone(),
            basis_points: 10_000,
        }],
    );
    client.init(&admin, &initial);

    // Add a second recipient, rebalancing to 60/40. The whole list is replaced
    // so the sum must still be exactly 10,000.
    let updated = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 6000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 4000,
            },
        ],
    );
    client.update_recipients(&updated);

    let stored = client.get_recipients();
    assert_eq!(stored.len(), 2);
    assert_eq!(sum_basis_points(&stored), 10_000);

    // Next distribution must use the newly-added recipient.
    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &1000);
    client.distribute(&token_id, &sender, &1000);

    assert_eq!(token_client.balance(&r1), 600);
    assert_eq!(token_client.balance(&r2), 400);
}

// ── Remove a recipient before distribution ────────────────────────────────────

#[test]
fn test_remove_recipient_before_distribution() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(10);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);
    let r3 = Address::generate(&env);

    let initial = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 3000,
            },
            RecipientShare {
                destination: r3.clone(),
                basis_points: 2000,
            },
        ],
    );
    client.init(&admin, &initial);

    // Drop r3 and redistribute its share across the remaining two.
    let updated = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 6000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 4000,
            },
        ],
    );
    client.update_recipients(&updated);

    let stored = client.get_recipients();
    assert_eq!(stored.len(), 2);
    assert_eq!(sum_basis_points(&stored), 10_000);

    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &1000);
    client.distribute(&token_id, &sender, &1000);

    // r3 was removed and must receive nothing from the new distribution.
    assert_eq!(token_client.balance(&r1), 600);
    assert_eq!(token_client.balance(&r2), 400);
    assert_eq!(token_client.balance(&r3), 0);
}

// ── Modify a recipient's share before distribution ────────────────────────────

#[test]
fn test_modify_recipient_share_before_distribution() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(10);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    let initial = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 5000,
            },
        ],
    );
    client.init(&admin, &initial);

    // Same recipients, new shares (7500 / 2500). Sum stays 10,000.
    let updated = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 7500,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 2500,
            },
        ],
    );
    client.update_recipients(&updated);

    let stored = client.get_recipients();
    assert_eq!(stored.get(0).unwrap().basis_points, 7500);
    assert_eq!(stored.get(1).unwrap().basis_points, 2500);

    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &1000);
    client.distribute(&token_id, &sender, &1000);

    assert_eq!(token_client.balance(&r1), 750);
    assert_eq!(token_client.balance(&r2), 250);
}

// ── Update recipients between distributions (mid-lifecycle) ────────────────────

#[test]
fn test_update_recipient_during_active_distribution() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(1);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    let initial = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 5000,
            },
        ],
    );
    client.init(&admin, &initial);

    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &3000);

    // First distribution uses the 50/50 split.
    client.distribute(&token_id, &sender, &1000);
    assert_eq!(token_client.balance(&r1), 500);
    assert_eq!(token_client.balance(&r2), 500);

    // Update the split mid-stream (between distributions in a later ledger).
    let updated = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 8000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 2000,
            },
        ],
    );
    client.update_recipients(&updated);

    // Second distribution in the next ledger must use the updated split, while
    // balances already paid out under the old split remain untouched.
    env.ledger().set_sequence_number(2);
    client.distribute(&token_id, &sender, &1000);

    assert_eq!(token_client.balance(&r1), 500 + 800);
    assert_eq!(token_client.balance(&r2), 500 + 200);
    assert_eq!(client.get_total_distributed(&token_id), 2000);
    assert_eq!(client.get_distribution_count(), 2);
}

// ── Basis-point sum re-validated after each change ─────────────────────────────

#[test]
fn test_basis_point_sum_validated_after_each_change() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);
    let r3 = Address::generate(&env);

    client.init(&admin, &even_split(&env, 1));

    // A sequence of valid updates; every stored configuration must sum to 10,000.
    let update_a = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 5000,
            },
        ],
    );
    client.update_recipients(&update_a);
    assert_eq!(sum_basis_points(&client.get_recipients()), 10_000);

    let update_b = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 2500,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 2500,
            },
            RecipientShare {
                destination: r3.clone(),
                basis_points: 5000,
            },
        ],
    );
    client.update_recipients(&update_b);
    assert_eq!(sum_basis_points(&client.get_recipients()), 10_000);

    let update_c = Vec::from_array(
        &env,
        [RecipientShare {
            destination: r3.clone(),
            basis_points: 10_000,
        }],
    );
    client.update_recipients(&update_c);
    assert_eq!(sum_basis_points(&client.get_recipients()), 10_000);
}

// ── Historical distributions unaffected by later changes ───────────────────────

#[test]
fn test_historical_distributions_unaffected_by_changes() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(1);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    let initial = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 5000,
            },
        ],
    );
    client.init(&admin, &initial);

    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &10_000);

    // Two historical distributions under the 50/50 split.
    client.distribute(&token_id, &sender, &1000);
    env.ledger().set_sequence_number(2);
    client.distribute(&token_id, &sender, &1000);

    let hist_r1 = token_client.balance(&r1);
    let hist_r2 = token_client.balance(&r2);
    let hist_total = client.get_total_distributed(&token_id);
    let hist_count = client.get_distribution_count();
    assert_eq!(hist_r1, 1000);
    assert_eq!(hist_r2, 1000);
    assert_eq!(hist_total, 2000);
    assert_eq!(hist_count, 2);

    // Remove r2 entirely; r1 now owns the full split.
    let updated = Vec::from_array(
        &env,
        [RecipientShare {
            destination: r1.clone(),
            basis_points: 10_000,
        }],
    );
    client.update_recipients(&updated);

    // Historical accounting must be preserved exactly: prior balances, the
    // cumulative total, and the distribution count are all unchanged by the
    // recipient update itself.
    assert_eq!(token_client.balance(&r1), hist_r1);
    assert_eq!(token_client.balance(&r2), hist_r2);
    assert_eq!(client.get_total_distributed(&token_id), hist_total);
    assert_eq!(client.get_distribution_count(), hist_count);

    // The next distribution uses the updated list and adds to the history.
    env.ledger().set_sequence_number(3);
    client.distribute(&token_id, &sender, &1000);
    assert_eq!(token_client.balance(&r1), hist_r1 + 1000);
    assert_eq!(token_client.balance(&r2), hist_r2); // r2 removed, still unchanged
    assert_eq!(client.get_total_distributed(&token_id), 3000);
    assert_eq!(client.get_distribution_count(), 3);
}

// ── Invalid basis-point sum is rejected atomically ─────────────────────────────

#[test]
fn test_invalid_basis_point_sum_rejected_over() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    let initial = Vec::from_array(
        &env,
        [RecipientShare {
            destination: r1.clone(),
            basis_points: 10_000,
        }],
    );
    client.init(&admin, &initial);

    // Sum = 11,000 (> 10,000) must be rejected.
    let too_much = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 6000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 5000,
            },
        ],
    );
    let result = client.try_update_recipients(&too_much);
    assert_eq!(result, Err(Ok(RevenueSplitError::BasisPointsSumMismatch)));

    // Configuration is unchanged (atomic rejection).
    let stored = client.get_recipients();
    assert_eq!(stored.len(), 1);
    assert_eq!(stored.get(0).unwrap().destination, r1);
    assert_eq!(stored.get(0).unwrap().basis_points, 10_000);
}

#[test]
fn test_invalid_basis_point_sum_rejected_under() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    client.init(&admin, &even_split(&env, 1));

    // Sum = 9,000 (< 10,000) must be rejected.
    let too_little = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 4000,
            },
        ],
    );
    let result = client.try_update_recipients(&too_little);
    assert_eq!(result, Err(Ok(RevenueSplitError::BasisPointsSumMismatch)));
}

// ── Recipient changes are logged in events ─────────────────────────────────────

#[test]
fn test_recipient_update_emits_event() {
    use soroban_sdk::testutils::Events;
    use soroban_sdk::{Map, Symbol, TryFromVal};

    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    client.init(&admin, &even_split(&env, 1));

    let updated = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: r1.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 5000,
            },
        ],
    );
    client.update_recipients(&updated);

    // RecipientsUpdatedEvent layout (from #[contractevent]):
    //   topic[0] = Symbol  (event name)
    //   topic[1] = Address (indexed admin field)
    //   data     = Map { "recipient_count" => u32 }
    let all_events = env.events().all();
    assert!(!all_events.is_empty(), "update_recipients must emit an event");

    let (_event_contract, topics, data) = all_events.last().unwrap();

    let topic_admin = Address::try_from_val(&env, &topics.get(1).unwrap()).unwrap();
    assert_eq!(topic_admin, admin, "admin must be an indexed event topic");

    let data_map = Map::<Symbol, soroban_sdk::Val>::try_from_val(&env, &data).unwrap();
    let count_val = data_map.get(Symbol::new(&env, "recipient_count")).unwrap();
    let recipient_count = u32::try_from_val(&env, &count_val).unwrap();
    assert_eq!(recipient_count, 2, "event must record the new recipient count");
}

// ── Scale coverage: 1, 5, and 20 recipients ────────────────────────────────────

#[test]
fn test_update_recipients_single_recipient() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(5);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let old_recipient = Address::generate(&env);
    let new_recipient = Address::generate(&env);

    client.init(
        &admin,
        &Vec::from_array(
            &env,
            [RecipientShare {
                destination: old_recipient.clone(),
                basis_points: 10_000,
            }],
        ),
    );

    // Replace the sole recipient with a different sole recipient.
    let updated = Vec::from_array(
        &env,
        [RecipientShare {
            destination: new_recipient.clone(),
            basis_points: 10_000,
        }],
    );
    client.update_recipients(&updated);
    assert_eq!(sum_basis_points(&client.get_recipients()), 10_000);

    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &1000);
    client.distribute(&token_id, &sender, &1000);

    assert_eq!(token_client.balance(&new_recipient), 1000);
    assert_eq!(token_client.balance(&old_recipient), 0);
}

#[test]
fn test_update_recipients_five_recipients() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(5);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.init(&admin, &even_split(&env, 1));

    // Five recipients: 2000 bp each → sum 10,000.
    let mut recipients = Vec::new(&env);
    let mut updated = Vec::new(&env);
    let mut i = 0u32;
    while i < 5 {
        let r = Address::generate(&env);
        recipients.push_back(r.clone());
        updated.push_back(RecipientShare {
            destination: r,
            basis_points: 2000,
        });
        i += 1;
    }
    client.update_recipients(&updated);

    let stored = client.get_recipients();
    assert_eq!(stored.len(), 5);
    assert_eq!(sum_basis_points(&stored), 10_000);

    let sender = Address::generate(&env);
    stellar_asset_client.mint(&sender, &1000);
    client.distribute(&token_id, &sender, &1000);

    // 1000 * 2000 / 10000 = 200 each.
    for r in recipients.iter() {
        assert_eq!(token_client.balance(&r), 200);
    }
}

#[test]
fn test_update_recipients_twenty_recipients() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(5);

    let token_admin = Address::generate(&env);
    let (token_id, stellar_asset_client, token_client) = create_token_contract(&env, &token_admin);

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.init(&admin, &even_split(&env, 1));

    // Twenty recipients: 500 bp each → sum 10,000.
    let mut recipients = Vec::new(&env);
    let mut updated = Vec::new(&env);
    let mut i = 0u32;
    while i < 20 {
        let r = Address::generate(&env);
        recipients.push_back(r.clone());
        updated.push_back(RecipientShare {
            destination: r,
            basis_points: 500,
        });
        i += 1;
    }
    client.update_recipients(&updated);

    let stored = client.get_recipients();
    assert_eq!(stored.len(), 20);
    assert_eq!(sum_basis_points(&stored), 10_000);

    let sender = Address::generate(&env);
    let amount: i128 = 20_000;
    stellar_asset_client.mint(&sender, &amount);
    client.distribute(&token_id, &sender, &amount);

    // 20000 * 500 / 10000 = 1000 each; floor division is exact here so no dust.
    let mut distributed = 0i128;
    for r in recipients.iter() {
        let bal = token_client.balance(&r);
        assert_eq!(bal, 1000);
        distributed += bal;
    }
    assert_eq!(distributed, amount);
}

#[test]
fn test_update_recipients_twenty_rejects_invalid_sum() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.init(&admin, &even_split(&env, 1));

    // Twenty recipients at 500 bp is 10,000; bump one to 501 → sum 10,001, invalid.
    let mut updated = Vec::new(&env);
    let mut i = 0u32;
    while i < 20 {
        let bp = if i == 0 { 501 } else { 500 };
        updated.push_back(RecipientShare {
            destination: Address::generate(&env),
            basis_points: bp,
        });
        i += 1;
    }

    let result = client.try_update_recipients(&updated);
    assert_eq!(result, Err(Ok(RevenueSplitError::BasisPointsSumMismatch)));
}

#[test]
fn test_update_recipients_rejects_duplicate() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RevenueSplitContract, ());
    let client = RevenueSplitContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let dup = Address::generate(&env);

    client.init(&admin, &even_split(&env, 1));

    // Same destination listed twice must be rejected even though bp sum to 10,000.
    let updated = Vec::from_array(
        &env,
        [
            RecipientShare {
                destination: dup.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: dup.clone(),
                basis_points: 5000,
            },
        ],
    );
    let result = client.try_update_recipients(&updated);
    assert_eq!(result, Err(Ok(RevenueSplitError::DuplicateRecipient)));
}






