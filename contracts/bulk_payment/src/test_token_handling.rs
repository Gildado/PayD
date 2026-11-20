#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::{Address as _}, Address, Env, Vec, token};

#[test]
fn test_consistent_handling_xlm_vs_custom_token() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let receiver1 = Address::generate(&e);
    
    // Simulate Native XLM Token
    let xlm_admin = Address::generate(&e);
    let xlm_id = e.register_stellar_asset_contract_v2(xlm_admin.clone()).address();
    let xlm_client = token::StellarAssetClient::new(&e, &xlm_id);
    xlm_client.mint(&sender, &1_000_000);

    // Simulate Custom Token (e.g., ORGUSD or another wrapped asset)
    let custom_admin = Address::generate(&e);
    let custom_id = e.register_stellar_asset_contract_v2(custom_admin.clone()).address();
    let custom_client = token::StellarAssetClient::new(&e, &custom_id);
    custom_client.mint(&sender, &1_000_000);

    // Register Bulk Payment Contract
    let contract_id = e.register(BulkPaymentContract, ());
    let client = BulkPaymentContractClient::new(&e, &contract_id);
    client.initialize(&admin);

    // Test with XLM
    let payments_xlm = Vec::from_array(&e, [
        PaymentOp { recipient: receiver1.clone(), amount: 500_000, category: soroban_sdk::Symbol::new(&e, "test") },
    ]);
    client.execute_batch(&sender, &xlm_id, &payments_xlm, &0);
    
    // Test with Custom Token
    let payments_custom = Vec::from_array(&e, [
        PaymentOp { recipient: receiver1.clone(), amount: 500_000, category: soroban_sdk::Symbol::new(&e, "test") },
    ]);
    client.execute_batch(&sender, &custom_id, &payments_custom, &1);

    // Verify consistency
    let xlm_token = token::Client::new(&e, &xlm_id);
    let custom_token = token::Client::new(&e, &custom_id);

    assert_eq!(xlm_token.balance(&sender), 500_000);
    assert_eq!(custom_token.balance(&sender), 500_000);
    assert_eq!(xlm_token.balance(&receiver1), 500_000);
    assert_eq!(custom_token.balance(&receiver1), 500_000);
}
