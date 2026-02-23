#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, Env, Vec, token};
use types::StreamStatus;

fn setup_env() -> (Env, Address, PayrollStreamContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollStreamContract, ());
    let client = PayrollStreamContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    (env, admin, client)
}

#[test]
fn test_initialize() {
    let (_env, admin, client) = setup_env();
    client.initialize(&admin);
    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_stream_count(), 0);
}

#[test]
#[should_panic]
fn test_double_initialize() {
    let (_env, admin, client) = setup_env();
    client.initialize(&admin);
    client.initialize(&admin);
}

#[test]
fn test_create_stream() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token_contract = create_token_contract(&env, &token_admin);
    let token_client = create_token_client(&env, &token_contract.address);
    token_contract.mint(&sender, &10000);

    client.initialize(&admin);

    env.ledger().with_mut(|li| {
        li.timestamp = 1000;
    });

    let stream_id = client.create_stream(
        &sender,
        &recipient,
        &token_contract.address,
        &10000_i128,
        &1000_u64,
        &2000_u64,
    );

    assert_eq!(stream_id, 0);
    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.total_amount, 10000);
    assert_eq!(stream.status, StreamStatus::Active);
    assert_eq!(stream.rate_per_second, 10);
    
    assert_eq!(token_client.balance(&sender), 0);
    assert_eq!(token_client.balance(&client.address), 10000);
}

#[test]
fn test_create_batch_streams() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token_contract = create_token_contract(&env, &token_admin);
    let token_client = create_token_client(&env, &token_contract.address);
    token_contract.mint(&sender, &30000);

    client.initialize(&admin);

    env.ledger().with_mut(|li| {
        li.timestamp = 1000;
    });

    let mut streams = Vec::new(&env);
    
    // Stream 1
    streams.push_back(CreateStreamParams {
        recipient: Address::generate(&env),
        token: token_contract.address.clone(),
        total_amount: 10000,
        start_time: 1000,
        end_time: 2000,
    });

    // Stream 2
    streams.push_back(CreateStreamParams {
        recipient: Address::generate(&env),
        token: token_contract.address.clone(),
        total_amount: 20000,
        start_time: 1000,
        end_time: 3000,
    });

    let stream_ids = client.create_batch_streams(&sender, &streams);
    
    assert_eq!(stream_ids.len(), 2);
    assert_eq!(token_client.balance(&sender), 0);
    assert_eq!(token_client.balance(&client.address), 30000);
}

#[test]
fn test_calculate_claimable() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token_contract = create_token_contract(&env, &token_admin);
    token_contract.mint(&sender, &10000);

    client.initialize(&admin);

    env.ledger().with_mut(|li| {
        li.timestamp = 1000;
    });

    let stream_id = client.create_stream(
        &sender,
        &recipient,
        &token_contract.address,
        &10000_i128,
        &1000_u64,
        &2000_u64,
    );

    // At 50% of the stream duration
    env.ledger().with_mut(|li| {
        li.timestamp = 1500;
    });

    let claimable = client.get_claimable(&stream_id);
    assert_eq!(claimable, 5000);
}

#[test]
fn test_cancel_stream() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token_contract = create_token_contract(&env, &token_admin);
    let token_client = create_token_client(&env, &token_contract.address);
    token_contract.mint(&sender, &10000);

    client.initialize(&admin);

    env.ledger().with_mut(|li| {
        li.timestamp = 1000;
    });

    let stream_id = client.create_stream(
        &sender,
        &recipient,
        &token_contract.address,
        &10000_i128,
        &1000_u64,
        &2000_u64,
    );

    client.cancel_stream(&sender, &stream_id);
    
    assert_eq!(token_client.balance(&sender), 10000);
    assert_eq!(token_client.balance(&recipient), 0);
}

#[test]
fn test_cancel_stream_midway() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token_contract = create_token_contract(&env, &token_admin);
    let token_client = create_token_client(&env, &token_contract.address);
    token_contract.mint(&sender, &10000);

    client.initialize(&admin);

    env.ledger().with_mut(|li| {
        li.timestamp = 1000;
    });

    let stream_id = client.create_stream(
        &sender,
        &recipient,
        &token_contract.address,
        &10000_i128,
        &1000_u64,
        &2000_u64,
    );

    env.ledger().with_mut(|li| {
        li.timestamp = 1500;
    });

    client.cancel_stream(&sender, &stream_id);

    assert_eq!(token_client.balance(&recipient), 5000);
    assert_eq!(token_client.balance(&sender), 5000);
}

#[test]
fn test_cancel_stream_after_end() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token_contract = create_token_contract(&env, &token_admin);
    let token_client = create_token_client(&env, &token_contract.address);
    token_contract.mint(&sender, &10000);

    client.initialize(&admin);

    env.ledger().with_mut(|li| {
        li.timestamp = 1000;
    });

    let stream_id = client.create_stream(
        &sender,
        &recipient,
        &token_contract.address,
        &10000_i128,
        &1000_u64,
        &2000_u64,
    );

    env.ledger().with_mut(|li| {
        li.timestamp = 2500;
    });

    client.cancel_stream(&sender, &stream_id);

    assert_eq!(token_client.balance(&recipient), 10000);
    assert_eq!(token_client.balance(&sender), 0);
}

#[test]
fn test_claim_progression() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token_contract = create_token_contract(&env, &token_admin);
    let token_client = create_token_client(&env, &token_contract.address);
    token_contract.mint(&sender, &10000);

    client.initialize(&admin);

    env.ledger().with_mut(|li| {
        li.timestamp = 1000;
    });

    let stream_id = client.create_stream(
        &sender,
        &recipient,
        &token_contract.address,
        &10000_i128,
        &1000_u64,
        &2000_u64,
    );

    // 1. Claim at 25% (1250)
    env.ledger().with_mut(|li| { li.timestamp = 1250; });
    client.claim(&recipient, &stream_id);
    assert_eq!(token_client.balance(&recipient), 2500);

    // 2. Claim at 50% (1500)
    env.ledger().with_mut(|li| { li.timestamp = 1500; });
    client.claim(&recipient, &stream_id);
    assert_eq!(token_client.balance(&recipient), 5000);

    // 3. Claim at 75% (1750)
    env.ledger().with_mut(|li| { li.timestamp = 1750; });
    client.claim(&recipient, &stream_id);
    assert_eq!(token_client.balance(&recipient), 7500);

    // 4. Claim at 100% (2000)
    env.ledger().with_mut(|li| { li.timestamp = 2000; });
    client.claim(&recipient, &stream_id);
    assert_eq!(token_client.balance(&recipient), 10000);
}

#[test]
fn test_claim_after_completion() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token_contract = create_token_contract(&env, &token_admin);
    token_contract.mint(&sender, &10000);

    client.initialize(&admin);

    env.ledger().with_mut(|li| { li.timestamp = 1000; });
    let stream_id = client.create_stream(&sender, &recipient, &token_contract.address, &10000, &1000, &2000);

    // Go past end time
    env.ledger().with_mut(|li| { li.timestamp = 3000; });
    client.claim(&recipient, &stream_id);
    
    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.status, StreamStatus::Completed);
    
    // Attempt second claim should fail
    let result = client.try_claim(&recipient, &stream_id);
    assert!(result.is_err());
}

#[test]
fn test_unauthorized_cancel() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let malicious = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token_contract = create_token_contract(&env, &token_admin);
    token_contract.mint(&sender, &10000);

    client.initialize(&admin);

    env.ledger().with_mut(|li| { li.timestamp = 1000; });
    let stream_id = client.create_stream(&sender, &recipient, &token_contract.address, &10000, &1000, &2000);

    let result = client.try_cancel_stream(&malicious, &stream_id);
    assert!(result.is_err());
}

#[test]
fn test_invalid_creation_params() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = Address::generate(&env);

    client.initialize(&admin);

    // 1. Invalid amount
    let res1 = client.try_create_stream(&sender, &recipient, &token, &-100, &1000, &2000);
    assert!(res1.is_err());

    // 2. Invalid duration
    let res2 = client.try_create_stream(&sender, &recipient, &token, &1000, &2000, &1000);
    assert!(res2.is_err());

    // 3. Same sender and recipient
    let res3 = client.try_create_stream(&sender, &sender, &token, &1000, &1000, &2000);
    assert!(res3.is_err());
}

#[test]
fn test_multiple_concurrent_streams() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token_contract = create_token_contract(&env, &token_admin);
    let token_client = create_token_client(&env, &token_contract.address);
    token_contract.mint(&sender, &20000);

    client.initialize(&admin);

    env.ledger().with_mut(|li| { li.timestamp = 1000; });
    
    let id1 = client.create_stream(&sender, &recipient1, &token_contract.address, &10000, &1000, &2000);
    let id2 = client.create_stream(&sender, &recipient2, &token_contract.address, &10000, &1000, &3000);

    // At 1500: id1 is 50%, id2 is 25%
    env.ledger().with_mut(|li| { li.timestamp = 1500; });
    
    client.claim(&recipient1, &id1);
    client.claim(&recipient2, &id2);
    
    assert_eq!(token_client.balance(&recipient1), 5000);
    assert_eq!(token_client.balance(&recipient2), 2500);
}

fn create_token_contract<'a>(e: &Env, admin: &Address) -> token::StellarAssetClient<'a> {
    let contract_addr = e.register_stellar_asset_contract_v2(admin.clone()).address();
    token::StellarAssetClient::new(e, &contract_addr)
}

#[test]
fn test_cancel_after_partial_claim() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token_contract = create_token_contract(&env, &token_admin);
    let token_client = create_token_client(&env, &token_contract.address);
    token_contract.mint(&sender, &10000);

    client.initialize(&admin);

    let start_time = 1000;
    env.ledger().with_mut(|li| { li.timestamp = start_time; });
    let stream_id = client.create_stream(&sender, &recipient, &token_contract.address, &10000, &start_time, &(start_time + 1000));

    // 1. Advance to 25% (250s)
    env.ledger().with_mut(|li| { li.timestamp = start_time + 250; });
    client.claim(&recipient, &stream_id);
    assert_eq!(token_client.balance(&recipient), 2500);

    // 2. Advance to 50% (500s)
    env.ledger().with_mut(|li| { li.timestamp = start_time + 500; });
    
    // 3. Sender cancels
    client.cancel_stream(&sender, &stream_id);

    // Verify:
    // Recipient should have received the "unclaimed but accrued" 2,500 more.
    assert_eq!(token_client.balance(&recipient), 5000);
    // Sender should have received 5,000 refund (10,000 - 5,000 accrued).
    assert_eq!(token_client.balance(&sender), 5000);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.status, StreamStatus::Cancelled);
}

#[test]
fn test_invalid_start_time() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = Address::generate(&env);

    client.initialize(&admin);

    env.ledger().with_mut(|li| { li.timestamp = 1000; });
    
    // Attempt to create stream starting in the past (999 < 1000)
    let result = client.try_create_stream(&sender, &recipient, &token, &1000, &999, &2000);
    assert!(result.is_err());
}

#[test]
fn test_claim_multiple_times_progression() {
    let (env, admin, client) = setup_env();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token_contract = create_token_contract(&env, &token_admin);
    let token_client = create_token_client(&env, &token_contract.address);
    token_contract.mint(&sender, &10000);

    client.initialize(&admin);

    let start_time = 1000;
    env.ledger().with_mut(|li| { li.timestamp = start_time; });
    let stream_id = client.create_stream(&sender, &recipient, &token_contract.address, &10000, &start_time, &(start_time + 1000));

    for i in 1..=10 {
        env.ledger().with_mut(|li| { li.timestamp = start_time + (i * 100); });
        client.claim(&recipient, &stream_id);
        assert_eq!(token_client.balance(&recipient), (i as i128) * 1000);
    }

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.status, StreamStatus::Completed);
}

fn create_token_client<'a>(e: &Env, contract_addr: &Address) -> token::Client<'a> {
    token::Client::new(e, contract_addr)
}
