#![cfg(test)]

use crate::{RecipientShare, RevenueSplitContract, RevenueSplitContractClient, RevenueSplitError};
use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::token::StellarAssetClient;
use soroban_sdk::{
    Address, Env, Vec,
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
    assert_eq!(second.amount, 667);
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

    // Zero-amount distribute is a no-op: no transfer, no ledger update
    client.distribute(&token_id, &sender, &0);
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
    // Zero is valid — each recipient gets 0, no panic.
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

    let preview = client.preview_distribution(&0_i128);
    for entry in preview.iter() {
        assert_eq!(entry.amount, 0);
    }
}
