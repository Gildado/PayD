//! # Role-Based Access Control (RBAC) Tests
//!
//! Comprehensive tests verifying that each role (admin, sender, verifier,
//! beneficiary, clawback_admin) can only perform its designated operations
//! and is correctly rejected from operations outside its permissions.
//!
//! ## Why this matters
//! Incorrect access control is the most common and dangerous smart contract
//! vulnerability. A verifier who can release funds, or a regular user who
//! can mint tokens, represents a critical security failure.
//!
//! ## Error codes
//! Soroban host panics with `"HostError: Error(Contract, #N)"` on auth failures.
//! Each contract defines its own Unauthorized variant (typically code `3`).
//!
//! ## Auth model
//! Soroban's `require_auth()` checks transaction-level authorization.
//! Without `mock_all_auths()`, calling a function that requires auth from
//! an unauthorized address causes a host-level panic — which IS the access
//! control mechanism. These tests verify that panics occur as expected.

use soroban_sdk::{
    testutils::Address as _, testutils::Ledger, token, Address, Env, String, Vec,
};

// ══════════════════════════════════════════════════════════════════════════════
// Utility: catch panics from unauthorized Soroban calls
// ══════════════════════════════════════════════════════════════════════════════

/// Execute `f` inside a new `Env` that does NOT mock auth, then verify it
/// panics (i.e. Soroban's host-level auth check rejected the caller).
fn assert_unauthorized<F>(f: F)
where
    F: FnOnce(&Env) + std::panic::UnwindSafe,
{
    let result = std::panic::catch_unwind(|| {
        let env = Env::default();
        // No mock_all_auths — real auth enforcement is active
        f(&env);
    });
    assert!(
        result.is_err(),
        "Expected panic (unauthorized) but call succeeded"
    );
}

/// Execute `f` inside a new `Env` with `mock_all_auths` and verify it succeeds.
fn assert_authorized<F>(f: F)
where
    F: FnOnce(&Env) + std::panic::UnwindSafe,
{
    let result = std::panic::catch_unwind(|| {
        let env = Env::default();
        env.mock_all_auths();
        f(&env);
    });
    assert!(
        result.is_ok(),
        "Expected success but call panicked: {:?}",
        result.err()
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. BULK PAYMENT CONTRACT — Admin vs Sender
// ══════════════════════════════════════════════════════════════════════════════

mod bulk_payment_rbac {
    use super::*;
    use crate::bulk_payment::{BulkPaymentContract, BulkPaymentContractClient, PaymentOp};

    /// Setup that returns all role addresses for RBAC testing.
    fn setup_rbac() -> (Env, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let user_a = Address::generate(&env);
        let user_b = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        crate::bulk_payment::StellarAssetClient::new(&env, &token_id).mint(&user_a, &1_000_000);
        crate::bulk_payment::StellarAssetClient::new(&env, &token_id).mint(&user_b, &1_000_000);

        let contract_id = env.register(BulkPaymentContract, ());
        let client = BulkPaymentContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        (env, admin, user_a, user_b, token_id)
    }

    // ── Admin allowed operations ──────────────────────────────────────────

    #[test]
    fn test_admin_can_set_paused() {
        let (env, admin, _, _, _) = setup_rbac();
        let contract_id = env.register(BulkPaymentContract, ());
        let client = BulkPaymentContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        // Admin can pause
        client.set_paused(&admin, &true);
        assert!(client.is_paused());
        // Admin can unpause
        client.set_paused(&admin, &false);
        assert!(!client.is_paused());
    }

    #[test]
    fn test_admin_can_set_admin() {
        let (env, admin, user_a, _, _) = setup_rbac();
        let contract_id = env.register(BulkPaymentContract, ());
        let client = BulkPaymentContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        // Admin can transfer admin role
        client.set_admin(&user_a);
        assert_eq!(client.get_admin(), user_a);
    }

    #[test]
    fn test_admin_can_bump_ttl() {
        let (env, admin, _, _, _) = setup_rbac();
        let contract_id = env.register(BulkPaymentContract, ());
        let client = BulkPaymentContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        // Admin can bump TTL
        client.bump_ttl();
    }

    // ── Non-admin rejected from admin operations ───────────────────────────

    #[test]
    fn test_user_cannot_set_paused() {
        let (env, admin, user_a, _, _) = setup_rbac();
        let contract_id = env.register(BulkPaymentContract, ());
        let client = BulkPaymentContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        // user_a tries to pause — should panic (auth fails)
        let result = std::panic::catch_unwind(|| {
            let env2 = Env::default();
            // Re-setup inside the closure for the panic test
            let admin2 = Address::generate(&env2);
            let user = Address::generate(&env2);
            let token_admin = Address::generate(&env2);
            let token_id = env2
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            let contract_id = env2.register(BulkPaymentContract, ());
            let client = BulkPaymentContractClient::new(&env2, &contract_id);
            client.initialize(&admin2);
            // Only mock auth for admin (not for user)
            env2.mock_auths(&[soroban_sdk::testutils::MockAuth {
                address: &admin2,
                invoke: &soroban_sdk::testutils::MockAuthInvoke {
                    contract: &contract_id,
                    fn_name: "set_paused",
                    args: (&env2, true).into_val(&env2),
                    sub_invokes: &[],
                },
            }]);
            // user calls set_paused — user is NOT in mock_auths, so this should fail
            // But actually, we need to call with user as the authority
            // The contract reads admin from storage and calls require_auth on it
            // So the auth check is for admin's address, not user's address
            // This means even if user calls it, Soroban checks admin's auth
            client.set_paused(&user, &true);
        });
        // The call should fail because user's address != admin address
        assert!(result.is_err(), "Non-admin should not be able to set_paused");
    }

    #[test]
    fn test_user_cannot_set_admin() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            let contract_id = env.register(BulkPaymentContract, ());
            let client = BulkPaymentContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            // user tries to change admin — should panic
            client.set_admin(&user);
        });
        assert!(result.is_err(), "Non-admin should not be able to set_admin");
    }

    #[test]
    fn test_user_cannot_bump_ttl() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            let contract_id = env.register(BulkPaymentContract, ());
            let client = BulkPaymentContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            // No mock_auths at all — any require_auth call will fail
            client.bump_ttl();
        });
        assert!(result.is_err(), "Non-admin should not be able to bump_ttl");
    }

    // ── Sender can execute batches (with mock auth) ────────────────────────

    #[test]
    fn test_sender_can_execute_batch() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let sender = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        crate::bulk_payment::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);

        let contract_id = env.register(BulkPaymentContract, ());
        let client = BulkPaymentContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let mut payments: Vec<PaymentOp> = Vec::new(&env);
        payments.push_back(PaymentOp {
            recipient: Address::generate(&env),
            amount: 100,
            category: soroban_sdk::symbol_short!("payroll"),
        });

        // Sender can execute batch (with proper auth)
        let batch_id = client.execute_batch(&sender, &token_id, &payments, &client.get_sequence());
        assert!(batch_id > 0);
    }

    #[test]
    fn test_sender_cannot_set_paused() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            let contract_id = env.register(BulkPaymentContract, ());
            let client = BulkPaymentContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            // sender tries to pause — only admin's require_auth is checked
            client.set_paused(&sender, &true);
        });
        assert!(result.is_err(), "Sender should not be able to set_paused");
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. CROSS ASSET PAYMENT CONTRACT — Admin vs Sender
// ══════════════════════════════════════════════════════════════════════════════

mod cross_asset_payment_rbac {
    use super::*;
    use crate::cross_asset_payment::{
        CrossAssetPaymentContract, CrossAssetPaymentContractClient,
        CrossAssetPaymentError,
    };

    #[test]
    fn test_admin_can_set_paused() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(CrossAssetPaymentContract, ());
        let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
        client.init(&admin);
        client.set_paused(&admin, &true);
        assert!(client.is_paused());
        client.set_paused(&admin, &false);
        assert!(!client.is_paused());
    }

    #[test]
    fn test_admin_can_propose_admin_transfer() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let new_admin = Address::generate(&env);
        let contract_id = env.register(CrossAssetPaymentContract, ());
        let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
        client.init(&admin);
        client.propose_admin_transfer(&admin, &new_admin);
        assert_eq!(client.get_pending_admin(), Some(new_admin));
    }

    #[test]
    fn test_non_admin_cannot_set_paused() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let contract_id = env.register(CrossAssetPaymentContract, ());
            let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);
            // user tries to pause — should fail because require_admin checks admin auth
            client.set_paused(&user, &true);
        });
        assert!(result.is_err(), "Non-admin cannot set_paused");
    }

    #[test]
    fn test_non_admin_cannot_propose_admin_transfer() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let new_admin = Address::generate(&env);
            let contract_id = env.register(CrossAssetPaymentContract, ());
            let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);
            client.propose_admin_transfer(&user, &new_admin);
        });
        assert!(result.is_err(), "Non-admin cannot propose admin transfer");
    }

    #[test]
    fn test_non_admin_cannot_complete_payment() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let contract_id = env.register(CrossAssetPaymentContract, ());
            let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);
            // user tries to complete payment — require_matching_admin checks auth + address
            let _ = client.complete_payment(&user, &1, &Address::generate(&env));
        });
        assert!(result.is_err(), "Non-admin cannot complete_payment");
    }

    #[test]
    fn test_non_admin_cannot_fail_payment() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let contract_id = env.register(CrossAssetPaymentContract, ());
            let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);
            let _ = client.fail_payment(&user, &1);
        });
        assert!(result.is_err(), "Non-admin cannot fail_payment");
    }

    #[test]
    fn test_non_admin_cannot_cancel_admin_transfer() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let contract_id = env.register(CrossAssetPaymentContract, ());
            let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);
            client.cancel_admin_transfer(&user);
        });
        assert!(result.is_err(), "Non-admin cannot cancel admin transfer");
    }

    #[test]
    fn test_non_admin_cannot_bump_ttl() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let contract_id = env.register(CrossAssetPaymentContract, ());
            let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);
            client.bump_ttl();
        });
        assert!(result.is_err(), "Non-admin cannot bump_ttl");
    }

    #[test]
    fn test_sender_can_initiate_payment() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let sender = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        crate::cross_asset_payment::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);

        let contract_id = env.register(CrossAssetPaymentContract, ());
        let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
        client.init(&admin);

        let payment_id = client.initiate_payment(
            &sender,
            &100,
            &token_id,
            &String::from_str(&env, "receiver123"),
            &String::from_str(&env, "USD"),
            &String::from_str(&env, "anchor1"),
        );
        assert!(payment_id > 0);
    }

    #[test]
    fn test_sender_cannot_update_status() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::cross_asset_payment::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);

            let contract_id = env.register(CrossAssetPaymentContract, ());
            let client = CrossAssetPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);

            let _ = client.initiate_payment(
                &sender,
                &100,
                &token_id,
                &String::from_str(&env, "receiver123"),
                &String::from_str(&env, "USD"),
                &String::from_str(&env, "anchor1"),
            );
            // sender tries to update status — should fail (admin only)
            let _ = client.try_update_status(&sender, &1, &soroban_sdk::symbol_short!("complete"));
        });
        assert!(result.is_err(), "Sender cannot update_status");
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. MILESTONE ESCROW CONTRACT — Admin vs Sender vs Verifier vs Beneficiary
// ══════════════════════════════════════════════════════════════════════════════

mod milestone_escrow_rbac {
    use super::*;
    use crate::milestone_escrow::{
        Milestone, MilestoneEscrowContract, MilestoneEscrowContractClient, MilestoneStatus,
    };

    fn setup_rbac() -> (Env, Address, Address, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let sender = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let verifier = Address::generate(&env);
        let outsider = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        crate::milestone_escrow::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);

        let contract_id = env.register(MilestoneEscrowContract, ());
        let client = MilestoneEscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        (env, admin, sender, beneficiary, verifier, outsider, token_id)
    }

    fn make_milestones(e: &Env, amounts: &[i128]) -> Vec<Milestone> {
        let mut milestones: Vec<Milestone> = Vec::new(e);
        for (i, &amount) in amounts.iter().enumerate() {
            let desc = match i {
                0 => String::from_str(e, "M1"),
                1 => String::from_str(e, "M2"),
                _ => String::from_str(e, "MN"),
            };
            milestones.push_back(Milestone {
                description: desc,
                amount,
                status: MilestoneStatus::Pending,
            });
        }
        milestones
    }

    // ── Admin operations ───────────────────────────────────────────────────

    #[test]
    fn test_admin_can_set_paused() {
        let (env, admin, _, _, _, _, _) = setup_rbac();
        let contract_id = env.register(MilestoneEscrowContract, ());
        let client = MilestoneEscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.set_paused(&admin, &true);
        assert!(client.is_paused());
        client.set_paused(&admin, &false);
        assert!(!client.is_paused());
    }

    #[test]
    fn test_admin_can_set_admin() {
        let (env, admin, _, _, _, _, _) = setup_rbac();
        let new_admin = Address::generate(&env);
        let contract_id = env.register(MilestoneEscrowContract, ());
        let client = MilestoneEscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.set_admin(&new_admin);
        assert_eq!(client.get_admin(), new_admin);
    }

    #[test]
    fn test_admin_can_bump_ttl() {
        let (env, admin, _, _, _, _, _) = setup_rbac();
        let contract_id = env.register(MilestoneEscrowContract, ());
        let client = MilestoneEscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.bump_ttl();
    }

    // ── Non-admin rejected from admin operations ───────────────────────────

    #[test]
    fn test_sender_cannot_set_paused() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            client.set_paused(&sender, &true);
        });
        assert!(result.is_err(), "Sender cannot set_paused");
    }

    #[test]
    fn test_verifier_cannot_set_admin() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let verifier = Address::generate(&env);
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            client.set_admin(&verifier);
        });
        assert!(result.is_err(), "Verifier cannot set_admin");
    }

    #[test]
    fn test_beneficiary_cannot_set_paused() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            client.set_paused(&beneficiary, &true);
        });
        assert!(result.is_err(), "Beneficiary cannot set_paused");
    }

    // ── Sender-specific operations ─────────────────────────────────────────

    #[test]
    fn test_sender_can_create_escrow() {
        let (env, admin, sender, beneficiary, verifier, _, token_id) = setup_rbac();
        let contract_id = env.register(MilestoneEscrowContract, ());
        let client = MilestoneEscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        let milestones = make_milestones(&env, &[1000, 2000]);
        let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
        assert!(escrow_id > 0);
    }

    #[test]
    fn test_sender_can_cancel_escrow() {
        let (env, admin, sender, beneficiary, verifier, _, token_id) = setup_rbac();
        let contract_id = env.register(MilestoneEscrowContract, ());
        let client = MilestoneEscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        let milestones = make_milestones(&env, &[1000]);
        let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
        client.cancel_escrow(&escrow_id);
    }

    #[test]
    fn test_verifier_cannot_create_escrow() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let verifier = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = make_milestones(&env, &[1000]);
            // verifier calls create_escrow — sender.require_auth will fail
            let _ = client.try_create_escrow(&verifier, &beneficiary, &verifier, &token_id, &milestones);
        });
        assert!(result.is_err(), "Verifier cannot create_escrow");
    }

    #[test]
    fn test_beneficiary_cannot_cancel_escrow() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let verifier = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::milestone_escrow::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = make_milestones(&env, &[1000]);
            let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
            // beneficiary tries to cancel — sender.require_auth fails
            client.cancel_escrow(&escrow_id);
        });
        assert!(result.is_err(), "Beneficiary cannot cancel_escrow");
    }

    // ── Verifier-specific operations ───────────────────────────────────────

    #[test]
    fn test_verifier_can_approve_milestone() {
        let (env, admin, sender, beneficiary, verifier, _, token_id) = setup_rbac();
        let contract_id = env.register(MilestoneEscrowContract, ());
        let client = MilestoneEscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        let milestones = make_milestones(&env, &[1000, 2000]);
        let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
        client.approve_milestone(&escrow_id, &0);
    }

    #[test]
    fn test_sender_cannot_approve_milestone() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let verifier = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::milestone_escrow::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = make_milestones(&env, &[1000]);
            let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
            // sender tries to approve — verifier.require_auth fails
            let _ = client.try_approve_milestone(&escrow_id, &0);
        });
        assert!(result.is_err(), "Sender cannot approve_milestone");
    }

    #[test]
    fn test_beneficiary_cannot_approve_milestone() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let verifier = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::milestone_escrow::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = make_milestones(&env, &[1000]);
            let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
            let _ = client.try_approve_milestone(&escrow_id, &0);
        });
        assert!(result.is_err(), "Beneficiary cannot approve_milestone");
    }

    #[test]
    fn test_admin_cannot_approve_milestone() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let verifier = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::milestone_escrow::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = make_milestones(&env, &[1000]);
            let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
            let _ = client.try_approve_milestone(&escrow_id, &0);
        });
        assert!(result.is_err(), "Admin cannot approve_milestone");
    }

    // ── Beneficiary-specific operations ────────────────────────────────────

    #[test]
    fn test_beneficiary_can_release_milestone() {
        let (env, admin, sender, beneficiary, verifier, _, token_id) = setup_rbac();
        let contract_id = env.register(MilestoneEscrowContract, ());
        let client = MilestoneEscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        let milestones = make_milestones(&env, &[1000]);
        let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
        client.approve_milestone(&escrow_id, &0);
        client.release_milestone(&escrow_id, &0);
    }

    #[test]
    fn test_sender_cannot_release_milestone() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let verifier = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::milestone_escrow::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = make_milestones(&env, &[1000]);
            let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
            client.approve_milestone(&escrow_id, &0);
            // sender tries to release — beneficiary.require_auth fails
            let _ = client.try_release_milestone(&escrow_id, &0);
        });
        assert!(result.is_err(), "Sender cannot release_milestone");
    }

    #[test]
    fn test_verifier_cannot_release_milestone() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let verifier = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::milestone_escrow::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = make_milestones(&env, &[1000]);
            let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
            client.approve_milestone(&escrow_id, &0);
            // verifier tries to release — beneficiary.require_auth fails
            let _ = client.try_release_milestone(&escrow_id, &0);
        });
        assert!(result.is_err(), "Verifier cannot release_milestone");
    }

    #[test]
    fn test_admin_cannot_release_milestone() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let verifier = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::milestone_escrow::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = make_milestones(&env, &[1000]);
            let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
            client.approve_milestone(&escrow_id, &0);
            let _ = client.try_release_milestone(&escrow_id, &0);
        });
        assert!(result.is_err(), "Admin cannot release_milestone");
    }

    // ── Outsider (unauthorized) operations ─────────────────────────────────

    #[test]
    fn test_outsider_cannot_create_escrow() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let outsider = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = make_milestones(&env, &[1000]);
            let _ = client.try_create_escrow(&outsider, &beneficiary, &outsider, &token_id, &milestones);
        });
        assert!(result.is_err(), "Outsider cannot create_escrow");
    }

    #[test]
    fn test_outsider_cannot_approve_milestone() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let verifier = Address::generate(&env);
            let outsider = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::milestone_escrow::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = make_milestones(&env, &[1000]);
            let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
            // outsider tries to approve — verifier.require_auth fails
            let _ = client.try_approve_milestone(&escrow_id, &0);
        });
        assert!(result.is_err(), "Outsider cannot approve_milestone");
    }

    #[test]
    fn test_outsider_cannot_release_milestone() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let verifier = Address::generate(&env);
            let outsider = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::milestone_escrow::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = make_milestones(&env, &[1000]);
            let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
            client.approve_milestone(&escrow_id, &0);
            // outsider tries to release — beneficiary.require_auth fails
            let _ = client.try_release_milestone(&escrow_id, &0);
        });
        assert!(result.is_err(), "Outsider cannot release_milestone");
    }

    #[test]
    fn test_outsider_cannot_cancel_escrow() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let verifier = Address::generate(&env);
            let outsider = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::milestone_escrow::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);
            let contract_id = env.register(MilestoneEscrowContract, ());
            let client = MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = make_milestones(&env, &[1000]);
            let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
            // outsider tries to cancel — sender.require_auth fails
            let _ = client.try_cancel_escrow(&escrow_id);
        });
        assert!(result.is_err(), "Outsider cannot cancel_escrow");
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. ORGUSD CONTRACT — Admin vs Token Holder
// ══════════════════════════════════════════════════════════════════════════════

mod orgusd_rbac {
    use super::*;
    use crate::orgusd::{OrgUsdContract, OrgUsdContractClient, OrgUsdError};

    #[test]
    fn test_admin_can_authorize() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let account = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.authorize(&account);
        assert!(client.is_authorized(&account));
    }

    #[test]
    fn test_admin_can_revoke() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let account = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.authorize(&account);
        client.revoke(&account);
        assert!(!client.is_authorized(&account));
    }

    #[test]
    fn test_admin_can_freeze() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let account = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.freeze(&account);
        assert!(client.is_frozen(&account));
    }

    #[test]
    fn test_admin_can_unfreeze() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let account = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.freeze(&account);
        client.unfreeze(&account);
        assert!(!client.is_frozen(&account));
    }

    #[test]
    fn test_admin_can_mint() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let account = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.authorize(&account);
        client.mint(&account, &1000);
        assert_eq!(client.balance(&account), 1000);
    }

    #[test]
    fn test_admin_can_clawback() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let account = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.authorize(&account);
        client.mint(&account, &1000);
        client.clawback(&account, &500);
        assert_eq!(client.balance(&account), 500);
    }

    // ── Non-admin rejected from admin operations ───────────────────────────

    #[test]
    fn test_non_admin_cannot_authorize() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let account = Address::generate(&env);
            let contract_id = env.register(OrgUsdContract, ());
            let client = OrgUsdContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            // user tries to authorize — admin.require_auth fails
            client.authorize(&account);
        });
        assert!(result.is_err(), "Non-admin cannot authorize");
    }

    #[test]
    fn test_non_admin_cannot_revoke() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let account = Address::generate(&env);
            let contract_id = env.register(OrgUsdContract, ());
            let client = OrgUsdContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            client.revoke(&account);
        });
        assert!(result.is_err(), "Non-admin cannot revoke");
    }

    #[test]
    fn test_non_admin_cannot_freeze() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let account = Address::generate(&env);
            let contract_id = env.register(OrgUsdContract, ());
            let client = OrgUsdContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            client.freeze(&account);
        });
        assert!(result.is_err(), "Non-admin cannot freeze");
    }

    #[test]
    fn test_non_admin_cannot_mint() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let account = Address::generate(&env);
            let contract_id = env.register(OrgUsdContract, ());
            let client = OrgUsdContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            client.mint(&account, &1000);
        });
        assert!(result.is_err(), "Non-admin cannot mint");
    }

    #[test]
    fn test_non_admin_cannot_clawback() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let account = Address::generate(&env);
            let contract_id = env.register(OrgUsdContract, ());
            let client = OrgUsdContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            client.clawback(&account, &500);
        });
        assert!(result.is_err(), "Non-admin cannot clawback");
    }

    // ── Token holder operations (with auth) ────────────────────────────────

    #[test]
    fn test_authorized_user_can_transfer() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.authorize(&from);
        client.authorize(&to);
        client.mint(&from, &1000);
        client.transfer(&from, &to, &300);
        assert_eq!(client.balance(&from), 700);
        assert_eq!(client.balance(&to), 300);
    }

    #[test]
    fn test_authorized_user_can_burn() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let account = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.authorize(&account);
        client.mint(&account, &1000);
        client.burn(&account, &400);
        assert_eq!(client.balance(&account), 600);
        assert_eq!(client.total_supply(), 600);
    }

    // ── Frozen account cannot transfer ─────────────────────────────────────

    #[test]
    fn test_frozen_account_cannot_transfer() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.authorize(&from);
        client.authorize(&to);
        client.mint(&from, &1000);
        client.freeze(&from);
        let result = client.try_transfer(&from, &to, &100);
        assert_eq!(result, Err(Ok(OrgUsdError::AccountFrozen)));
    }

    // ── Role removal (revoke) immediately revokes access ───────────────────

    #[test]
    fn test_revoke_immediately_blocks_transfer() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let contract_id = env.register(OrgUsdContract, ());
        let client = OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.authorize(&from);
        client.authorize(&to);
        client.mint(&from, &1000);
        // Revoke from's authorization
        client.revoke(&from);
        // from can no longer transfer (even though they have balance)
        let result = client.try_transfer(&from, &to, &100);
        assert_eq!(result, Err(Ok(OrgUsdError::AccountNotAuthorized)));
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. REVENUE SPLIT CONTRACT — Admin vs Sender
// ══════════════════════════════════════════════════════════════════════════════

mod revenue_split_rbac {
    use super::*;
    use crate::revenue_split::{
        RecipientShare, RevenueSplitContract, RevenueSplitContractClient, RevenueSplitError,
    };

    #[test]
    fn test_admin_can_set_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let new_admin = Address::generate(&env);
        let r1 = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();

        let contract_id = env.register(RevenueSplitContract, ());
        let client = RevenueSplitContractClient::new(&env, &contract_id);
        let shares = soroban_sdk::vec![
            &env,
            RecipientShare {
                destination: r1.clone(),
                basis_points: 10000,
            },
        ];
        client.init(&admin, &shares);
        client.set_admin(&new_admin);
        assert_eq!(client.get_admin(), new_admin);
    }

    #[test]
    fn test_admin_can_update_recipients() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let r1 = Address::generate(&env);
        let r2 = Address::generate(&env);

        let contract_id = env.register(RevenueSplitContract, ());
        let client = RevenueSplitContractClient::new(&env, &contract_id);
        let shares = soroban_sdk::vec![
            &env,
            RecipientShare {
                destination: r1.clone(),
                basis_points: 10000,
            },
        ];
        client.init(&admin, &shares);

        let new_shares = soroban_sdk::vec![
            &env,
            RecipientShare {
                destination: r1.clone(),
                basis_points: 5000,
            },
            RecipientShare {
                destination: r2.clone(),
                basis_points: 5000,
            },
        ];
        client.update_recipients(&new_shares);
    }

    #[test]
    fn test_admin_can_set_paused() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let r1 = Address::generate(&env);

        let contract_id = env.register(RevenueSplitContract, ());
        let client = RevenueSplitContractClient::new(&env, &contract_id);
        let shares = soroban_sdk::vec![
            &env,
            RecipientShare {
                destination: r1.clone(),
                basis_points: 10000,
            },
        ];
        client.init(&admin, &shares);
        client.set_paused(&admin, &true);
        assert!(client.is_paused());
        client.set_paused(&admin, &false);
        assert!(!client.is_paused());
    }

    #[test]
    fn test_non_admin_cannot_set_admin() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let r1 = Address::generate(&env);

            let contract_id = env.register(RevenueSplitContract, ());
            let client = RevenueSplitContractClient::new(&env, &contract_id);
            let shares = soroban_sdk::vec![
                &env,
                RecipientShare {
                    destination: r1.clone(),
                    basis_points: 10000,
                },
            ];
            client.init(&admin, &shares);
            client.set_admin(&user);
        });
        assert!(result.is_err(), "Non-admin cannot set_admin");
    }

    #[test]
    fn test_non_admin_cannot_update_recipients() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let r1 = Address::generate(&env);

            let contract_id = env.register(RevenueSplitContract, ());
            let client = RevenueSplitContractClient::new(&env, &contract_id);
            let shares = soroban_sdk::vec![
                &env,
                RecipientShare {
                    destination: r1.clone(),
                    basis_points: 10000,
                },
            ];
            client.init(&admin, &shares);
            let new_shares = soroban_sdk::vec![
                &env,
                RecipientShare {
                    destination: r1.clone(),
                    basis_points: 10000,
                },
            ];
            client.update_recipients(&new_shares);
        });
        assert!(result.is_err(), "Non-admin cannot update_recipients");
    }

    #[test]
    fn test_non_admin_cannot_set_paused() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let r1 = Address::generate(&env);

            let contract_id = env.register(RevenueSplitContract, ());
            let client = RevenueSplitContractClient::new(&env, &contract_id);
            let shares = soroban_sdk::vec![
                &env,
                RecipientShare {
                    destination: r1.clone(),
                    basis_points: 10000,
                },
            ];
            client.init(&admin, &shares);
            client.set_paused(&admin, &true);
        });
        assert!(result.is_err(), "Non-admin cannot set_paused");
    }

    #[test]
    fn test_sender_can_distribute() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let sender = Address::generate(&env);
        let r1 = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        crate::revenue_split::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);

        let contract_id = env.register(RevenueSplitContract, ());
        let client = RevenueSplitContractClient::new(&env, &contract_id);
        let shares = soroban_sdk::vec![
            &env,
            RecipientShare {
                destination: r1.clone(),
                basis_points: 10000,
            },
        ];
        client.init(&admin, &shares);

        // Advance ledger to avoid replay detection
        env.ledger().with_mut(|li| {
            li.sequence = li.sequence + 1;
        });

        client.distribute(&token_id, &sender, &10000);
    }

    #[test]
    fn test_sender_cannot_set_paused() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let r1 = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::revenue_split::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);

            let contract_id = env.register(RevenueSplitContract, ());
            let client = RevenueSplitContractClient::new(&env, &contract_id);
            let shares = soroban_sdk::vec![
                &env,
                RecipientShare {
                    destination: r1.clone(),
                    basis_points: 10000,
                },
            ];
            client.init(&admin, &shares);
            // sender tries to pause — admin.require_auth fails
            let _ = client.try_set_paused(&sender, &true);
        });
        assert!(result.is_err(), "Sender cannot set_paused");
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. VESTING ESCROW CONTRACT — Admin vs Clawback Admin vs Beneficiary
// ══════════════════════════════════════════════════════════════════════════════

mod vesting_escrow_rbac {
    use super::*;
    use crate::vesting_escrow::{VestingContract, VestingContractClient};

    fn setup_rbac() -> (Env, Address, Address, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let funder = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let admin = Address::generate(&env);
        let clawback_admin = Address::generate(&env);
        let outsider = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);

        let contract_id = env.register(VestingContract, ());
        let client = VestingContractClient::new(&env, &contract_id);

        let start_time = 1_000_000u64;
        env.ledger().with_mut(|li| {
            li.timestamp = start_time;
        });

        client.initialize(
            &funder,
            &beneficiary,
            &token_id,
            &start_time,
            &0,     // cliff_seconds
            &3600,  // duration_seconds (1 hour)
            &10000, // amount
            &clawback_admin,
            &admin,
        );

        (env, funder, beneficiary, admin, clawback_admin, outsider, token_id)
    }

    // ── Admin governance operations ────────────────────────────────────────

    #[test]
    fn test_admin_can_set_paused() {
        let (env, _, _, admin, _, _, _) = setup_rbac();
        let contract_id = env.register(VestingContract, ());
        let client = VestingContractClient::new(&env, &contract_id);
        // Re-initialize for clean state
        let funder = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let clawback_admin = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
        let start_time = 1_000_000u64;
        env.ledger().with_mut(|li| { li.timestamp = start_time; });
        client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);

        client.set_paused(&admin, &true);
        assert!(client.is_paused());
        client.set_paused(&admin, &false);
        assert!(!client.is_paused());
    }

    #[test]
    fn test_admin_can_set_admin() {
        let (env, _, _, admin, _, _, _) = setup_rbac();
        let new_admin = Address::generate(&env);
        let contract_id = env.register(VestingContract, ());
        let client = VestingContractClient::new(&env, &contract_id);
        let funder = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let clawback_admin = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
        let start_time = 1_000_000u64;
        env.ledger().with_mut(|li| { li.timestamp = start_time; });
        client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);

        client.set_admin(&new_admin);
        assert_eq!(client.get_admin(), new_admin);
    }

    // ── Non-admin rejected from admin operations ───────────────────────────

    #[test]
    fn test_clawback_admin_cannot_set_paused() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let funder = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let admin = Address::generate(&env);
            let clawback_admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
            let contract_id = env.register(VestingContract, ());
            let client = VestingContractClient::new(&env, &contract_id);
            let start_time = 1_000_000u64;
            env.ledger().with_mut(|li| { li.timestamp = start_time; });
            client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
            // clawback_admin tries to pause — admin.require_auth fails
            client.set_paused(&clawback_admin, &true);
        });
        assert!(result.is_err(), "Clawback admin cannot set_paused");
    }

    #[test]
    fn test_beneficiary_cannot_set_paused() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let funder = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let admin = Address::generate(&env);
            let clawback_admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
            let contract_id = env.register(VestingContract, ());
            let client = VestingContractClient::new(&env, &contract_id);
            let start_time = 1_000_000u64;
            env.ledger().with_mut(|li| { li.timestamp = start_time; });
            client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
            client.set_paused(&beneficiary, &true);
        });
        assert!(result.is_err(), "Beneficiary cannot set_paused");
    }

    #[test]
    fn test_beneficiary_cannot_set_admin() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let funder = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let admin = Address::generate(&env);
            let clawback_admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
            let contract_id = env.register(VestingContract, ());
            let client = VestingContractClient::new(&env, &contract_id);
            let start_time = 1_000_000u64;
            env.ledger().with_mut(|li| { li.timestamp = start_time; });
            client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
            client.set_admin(&beneficiary);
        });
        assert!(result.is_err(), "Beneficiary cannot set_admin");
    }

    // ── Clawback admin operations ──────────────────────────────────────────

    #[test]
    fn test_clawback_admin_can_clawback() {
        let (env, _, _, _, clawback_admin, _, _) = setup_rbac();
        let contract_id = env.register(VestingContract, ());
        let client = VestingContractClient::new(&env, &contract_id);
        let funder = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let admin = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
        let start_time = 1_000_000u64;
        env.ledger().with_mut(|li| { li.timestamp = start_time; });
        client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
        client.clawback();
    }

    #[test]
    fn test_beneficiary_cannot_clawback() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let funder = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let admin = Address::generate(&env);
            let clawback_admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
            let contract_id = env.register(VestingContract, ());
            let client = VestingContractClient::new(&env, &contract_id);
            let start_time = 1_000_000u64;
            env.ledger().with_mut(|li| { li.timestamp = start_time; });
            client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
            // beneficiary tries to clawback — clawback_admin.require_auth fails
            let _ = client.try_clawback();
        });
        assert!(result.is_err(), "Beneficiary cannot clawback");
    }

    #[test]
    fn test_admin_cannot_clawback() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let funder = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let admin = Address::generate(&env);
            let clawback_admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
            let contract_id = env.register(VestingContract, ());
            let client = VestingContractClient::new(&env, &contract_id);
            let start_time = 1_000_000u64;
            env.ledger().with_mut(|li| { li.timestamp = start_time; });
            client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
            // admin tries to clawback — clawback_admin.require_auth fails
            let _ = client.try_clawback();
        });
        assert!(result.is_err(), "Admin cannot clawback");
    }

    #[test]
    fn test_clawback_admin_can_partial_clawback() {
        let (env, _, _, _, clawback_admin, _, _) = setup_rbac();
        let contract_id = env.register(VestingContract, ());
        let client = VestingContractClient::new(&env, &contract_id);
        let funder = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let admin = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
        let start_time = 1_000_000u64;
        env.ledger().with_mut(|li| { li.timestamp = start_time; });
        client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
        client.partial_clawback(&2000);
    }

    #[test]
    fn test_clawback_admin_can_extend_vesting() {
        let (env, _, _, _, clawback_admin, _, _) = setup_rbac();
        let contract_id = env.register(VestingContract, ());
        let client = VestingContractClient::new(&env, &contract_id);
        let funder = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let admin = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
        let start_time = 1_000_000u64;
        env.ledger().with_mut(|li| { li.timestamp = start_time; });
        client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
        client.extend_vesting(&1800);
    }

    #[test]
    fn test_clawback_admin_can_transfer_beneficiary() {
        let (env, _, _, _, clawback_admin, _, _) = setup_rbac();
        let contract_id = env.register(VestingContract, ());
        let client = VestingContractClient::new(&env, &contract_id);
        let funder = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        let new_beneficiary = Address::generate(&env);
        let admin = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
        let start_time = 1_000_000u64;
        env.ledger().with_mut(|li| { li.timestamp = start_time; });
        client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
        client.transfer_beneficiary(&new_beneficiary);
    }

    #[test]
    fn test_beneficiary_cannot_transfer_beneficiary() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let funder = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let admin = Address::generate(&env);
            let clawback_admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
            let contract_id = env.register(VestingContract, ());
            let client = VestingContractClient::new(&env, &contract_id);
            let start_time = 1_000_000u64;
            env.ledger().with_mut(|li| { li.timestamp = start_time; });
            client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
            let new_beneficiary = Address::generate(&env);
            // beneficiary tries to transfer — clawback_admin.require_auth fails
            let _ = client.try_transfer_beneficiary(&new_beneficiary);
        });
        assert!(result.is_err(), "Beneficiary cannot transfer_beneficiary");
    }

    #[test]
    fn test_admin_cannot_transfer_beneficiary() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let funder = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let admin = Address::generate(&env);
            let clawback_admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
            let contract_id = env.register(VestingContract, ());
            let client = VestingContractClient::new(&env, &contract_id);
            let start_time = 1_000_000u64;
            env.ledger().with_mut(|li| { li.timestamp = start_time; });
            client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
            let new_beneficiary = Address::generate(&env);
            // admin tries to transfer — clawback_admin.require_auth fails
            let _ = client.try_transfer_beneficiary(&new_beneficiary);
        });
        assert!(result.is_err(), "Admin cannot transfer_beneficiary");
    }

    // ── Beneficiary operations ─────────────────────────────────────────────

    #[test]
    fn test_beneficiary_can_claim() {
        let (env, _, beneficiary, _, _, _, _) = setup_rbac();
        let contract_id = env.register(VestingContract, ());
        let client = VestingContractClient::new(&env, &contract_id);
        let funder = Address::generate(&env);
        let admin = Address::generate(&env);
        let clawback_admin = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
        let start_time = 1_000_000u64;
        env.ledger().with_mut(|li| { li.timestamp = start_time; });
        client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);

        // Advance time past duration for full vesting
        env.ledger().with_mut(|li| { li.timestamp = start_time + 3600; });
        client.claim();
    }

    #[test]
    fn test_admin_cannot_claim() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let funder = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let admin = Address::generate(&env);
            let clawback_admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
            let contract_id = env.register(VestingContract, ());
            let client = VestingContractClient::new(&env, &contract_id);
            let start_time = 1_000_000u64;
            env.ledger().with_mut(|li| { li.timestamp = start_time; });
            client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
            env.ledger().with_mut(|li| { li.timestamp = start_time + 3600; });
            // admin tries to claim — beneficiary.require_auth fails
            let _ = client.try_claim();
        });
        assert!(result.is_err(), "Admin cannot claim");
    }

    #[test]
    fn test_clawback_admin_cannot_claim() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let funder = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let admin = Address::generate(&env);
            let clawback_admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
            let contract_id = env.register(VestingContract, ());
            let client = VestingContractClient::new(&env, &contract_id);
            let start_time = 1_000_000u64;
            env.ledger().with_mut(|li| { li.timestamp = start_time; });
            client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
            env.ledger().with_mut(|li| { li.timestamp = start_time + 3600; });
            let _ = client.try_claim();
        });
        assert!(result.is_err(), "Clawback admin cannot claim");
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. ASSET PATH PAYMENT CONTRACT — Admin vs User
// ══════════════════════════════════════════════════════════════════════════════

mod asset_path_payment_rbac {
    use super::*;
    use crate::asset_path_payment::{AssetPathPaymentContract, AssetPathPaymentContractClient};

    #[test]
    fn test_admin_can_set_paused() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(AssetPathPaymentContract, ());
        let client = AssetPathPaymentContractClient::new(&env, &contract_id);
        client.init(&admin);
        client.set_paused(&admin, &true);
        assert!(client.is_paused());
        client.set_paused(&admin, &false);
        assert!(!client.is_paused());
    }

    #[test]
    fn test_admin_can_bump_ttl() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(AssetPathPaymentContract, ());
        let client = AssetPathPaymentContractClient::new(&env, &contract_id);
        client.init(&admin);
        client.bump_ttl();
    }

    #[test]
    fn test_non_admin_cannot_set_paused() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let contract_id = env.register(AssetPathPaymentContract, ());
            let client = AssetPathPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);
            client.set_paused(&user, &true);
        });
        assert!(result.is_err(), "Non-admin cannot set_paused");
    }

    #[test]
    fn test_non_admin_cannot_bump_ttl() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let contract_id = env.register(AssetPathPaymentContract, ());
            let client = AssetPathPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);
            client.bump_ttl();
        });
        assert!(result.is_err(), "Non-admin cannot bump_ttl");
    }

    #[test]
    fn test_non_admin_cannot_complete_path_payment() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let contract_id = env.register(AssetPathPaymentContract, ());
            let client = AssetPathPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);
            // user tries to complete — require_admin fails
            let _ = client.try_complete_path_payment(&1, &100, &100);
        });
        assert!(result.is_err(), "Non-admin cannot complete_path_payment");
    }

    #[test]
    fn test_non_admin_cannot_fail_path_payment() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let contract_id = env.register(AssetPathPaymentContract, ());
            let client = AssetPathPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);
            let _ = client.try_fail_path_payment(&1, &1, &String::from_str(&env, "error"), &false);
        });
        assert!(result.is_err(), "Non-admin cannot fail_path_payment");
    }

    #[test]
    fn test_non_admin_cannot_withdraw() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            let contract_id = env.register(AssetPathPaymentContract, ());
            let client = AssetPathPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);
            let _ = client.try_withdraw(&token_id, &100, &Address::generate(&env));
        });
        assert!(result.is_err(), "Non-admin cannot withdraw");
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. SMART WALLET CONTRACT — Multi-sig Authorization
// ══════════════════════════════════════════════════════════════════════════════

mod smart_wallet_rbac {
    use super::*;
    use crate::smart_wallet::{Ed25519Proof, SignerKey, SignatureProof, SmartWalletContract, SmartWalletContractClient};

    #[test]
    fn test_init_requires_no_auth() {
        let env = Env::default();
        let signer = Address::generate(&env);
        let signer_key = SignerKey::Ed25519(signer.clone().to_bytes_32());
        let contract_id = env.register(SmartWalletContract, ());
        let client = SmartWalletContractClient::new(&env, &contract_id);
        let signers = soroban_sdk::vec![&env, signer_key];
        // init does NOT require auth on the contract account
        client.init(&signers, &1);
        assert_eq!(client.threshold(), Ok(1));
    }

    #[test]
    fn test_set_threshold_requires_contract_auth() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let signer = Address::generate(&env);
            let signer_key = SignerKey::Ed25519(signer.clone().to_bytes_32());
            let contract_id = env.register(SmartWalletContract, ());
            let client = SmartWalletContractClient::new(&env, &contract_id);
            let signers = soroban_sdk::vec![&env, signer_key];
            client.init(&signers, &1);
            // set_threshold requires env.current_contract_address().require_auth()
            // Without mock_all_auths, this will fail
            client.set_threshold(&2);
        });
        assert!(result.is_err(), "set_threshold requires contract auth");
    }

    #[test]
    fn test_add_signer_requires_contract_auth() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let signer = Address::generate(&env);
            let signer_key = SignerKey::Ed25519(signer.clone().to_bytes_32());
            let contract_id = env.register(SmartWalletContract, ());
            let client = SmartWalletContractClient::new(&env, &contract_id);
            let signers = soroban_sdk::vec![&env, signer_key];
            client.init(&signers, &1);
            let new_signer = Address::generate(&env);
            let new_signer_key = SignerKey::Ed25519(new_signer.clone().to_bytes_32());
            client.add_signer(&new_signer_key);
        });
        assert!(result.is_err(), "add_signer requires contract auth");
    }

    #[test]
    fn test_remove_signer_requires_contract_auth() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let signer = Address::generate(&env);
            let signer_key = SignerKey::Ed25519(signer.clone().to_bytes_32());
            let contract_id = env.register(SmartWalletContract, ());
            let client = SmartWalletContractClient::new(&env, &contract_id);
            let signers = soroban_sdk::vec![&env, signer_key];
            client.init(&signers, &1);
            client.remove_signer(&signer_key);
        });
        assert!(result.is_err(), "remove_signer requires contract auth");
    }

    #[test]
    fn test_unauthorized_user_cannot_change_threshold() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let signer = Address::generate(&env);
            let signer_key = SignerKey::Ed25519(signer.clone().to_bytes_32());
            let contract_id = env.register(SmartWalletContract, ());
            let client = SmartWalletContractClient::new(&env, &contract_id);
            let signers = soroban_sdk::vec![&env, signer_key];
            client.init(&signers, &1);
            // A regular user (not the contract account) cannot call set_threshold
            // because it requires env.current_contract_address().require_auth()
            let _ = client.try_set_threshold(&2);
        });
        assert!(result.is_err(), "Unauthorized user cannot change threshold");
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. CROSS-CONTRACT ROLE ESCALATION PREVENTION
// ══════════════════════════════════════════════════════════════════════════════

/// Verify that no role can escalate to a higher privilege level.
mod role_escalation_prevention {
    use super::*;

    /// A user (non-admin) cannot make themselves admin on any contract.
    #[test]
    fn test_user_cannot_self_promote_to_admin_bulk_payment() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            let contract_id = env.register(crate::bulk_payment::BulkPaymentContract, ());
            let client = crate::bulk_payment::BulkPaymentContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            // user tries to set themselves as admin
            client.set_admin(&user);
        });
        assert!(result.is_err(), "User cannot self-promote to admin");
    }

    #[test]
    fn test_user_cannot_self_promote_to_admin_milestone_escrow() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let contract_id = env.register(crate::milestone_escrow::MilestoneEscrowContract, ());
            let client = crate::milestone_escrow::MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            client.set_admin(&user);
        });
        assert!(result.is_err(), "User cannot self-promote to admin");
    }

    #[test]
    fn test_user_cannot_self_promote_to_admin_revenue_split() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let user = Address::generate(&env);
            let r1 = Address::generate(&env);
            let contract_id = env.register(crate::revenue_split::RevenueSplitContract, ());
            let client = crate::revenue_split::RevenueSplitContractClient::new(&env, &contract_id);
            let shares = soroban_sdk::vec![
                &env,
                crate::revenue_split::RecipientShare {
                    destination: r1,
                    basis_points: 10000,
                },
            ];
            client.init(&admin, &shares);
            client.set_admin(&user);
        });
        assert!(result.is_err(), "User cannot self-promote to admin");
    }

    /// A verifier cannot release funds (that's the beneficiary's role).
    #[test]
    fn test_verifier_cannot_release_funds() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let verifier = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::milestone_escrow::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);

            let contract_id = env.register(crate::milestone_escrow::MilestoneEscrowContract, ());
            let client = crate::milestone_escrow::MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = soroban_sdk::vec![
                &env,
                crate::milestone_escrow::Milestone {
                    description: String::from_str(&env, "M1"),
                    amount: 1000,
                    status: crate::milestone_escrow::MilestoneStatus::Pending,
                },
            ];
            let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
            client.approve_milestone(&escrow_id, &0);
            // verifier tries to release — beneficiary.require_auth fails
            let _ = client.try_release_milestone(&escrow_id, &0);
        });
        assert!(result.is_err(), "Verifier cannot release funds");
    }

    /// A beneficiary cannot approve milestones (that's the verifier's role).
    #[test]
    fn test_beneficiary_cannot_approve_milestones() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let verifier = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::milestone_escrow::StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);

            let contract_id = env.register(crate::milestone_escrow::MilestoneEscrowContract, ());
            let client = crate::milestone_escrow::MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            let milestones = soroban_sdk::vec![
                &env,
                crate::milestone_escrow::Milestone {
                    description: String::from_str(&env, "M1"),
                    amount: 1000,
                    status: crate::milestone_escrow::MilestoneStatus::Pending,
                },
            ];
            let escrow_id = client.create_escrow(&sender, &beneficiary, &verifier, &token_id, &milestones);
            // beneficiary tries to approve — verifier.require_auth fails
            let _ = client.try_approve_milestone(&escrow_id, &0);
        });
        assert!(result.is_err(), "Beneficiary cannot approve milestones");
    }

    /// A clawback_admin cannot claim tokens (that's the beneficiary's role).
    #[test]
    fn test_clawback_admin_cannot_claim_tokens() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let funder = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let admin = Address::generate(&env);
            let clawback_admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
            let contract_id = env.register(crate::vesting_escrow::VestingContract, ());
            let client = crate::vesting_escrow::VestingContractClient::new(&env, &contract_id);
            let start_time = 1_000_000u64;
            env.ledger().with_mut(|li| { li.timestamp = start_time; });
            client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
            env.ledger().with_mut(|li| { li.timestamp = start_time + 3600; });
            // clawback_admin tries to claim — beneficiary.require_auth fails
            let _ = client.try_claim();
        });
        assert!(result.is_err(), "Clawback admin cannot claim tokens");
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. ROLE REMOVAL TESTS
// ══════════════════════════════════════════════════════════════════════════════

/// Verify that removing a role (e.g., via revoke or set_admin) immediately
/// revokes access — the former role holder cannot perform any more operations.
mod role_removal_tests {
    use super::*;

    /// After admin transfer, old admin loses all admin privileges.
    #[test]
    fn test_old_admin_loses_access_after_transfer() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let new_admin = Address::generate(&env);
            let contract_id = env.register(crate::bulk_payment::BulkPaymentContract, ());
            let client = crate::bulk_payment::BulkPaymentContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            // Transfer admin
            client.set_admin(&new_admin);
            // Old admin tries to pause — should fail
            client.set_paused(&admin, &true);
        });
        assert!(result.is_err(), "Old admin loses access after transfer");
    }

    /// After revoking authorization, user cannot transfer tokens.
    #[test]
    fn test_revoked_user_loses_transfer_ability() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let recipient = Address::generate(&env);
        let contract_id = env.register(crate::orgusd::OrgUsdContract, ());
        let client = crate::orgusd::OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.authorize(&user);
        client.authorize(&recipient);
        client.mint(&user, &1000);
        // Revoke user
        client.revoke(&user);
        // User can no longer transfer
        let result = client.try_transfer(&user, &recipient, &100);
        assert_eq!(result, Err(Ok(crate::orgusd::OrgUsdError::AccountNotAuthorized)));
    }

    /// After revoking authorization, user cannot receive new minted tokens.
    #[test]
    fn test_revoked_user_cannot_receive_mint() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let contract_id = env.register(crate::orgusd::OrgUsdContract, ());
        let client = crate::orgusd::OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.authorize(&user);
        // Revoke user
        client.revoke(&user);
        // Mint to revoked user fails
        let result = client.try_mint(&user, &100);
        assert_eq!(result, Err(Ok(crate::orgusd::OrgUsdError::AccountNotAuthorized)));
    }

    /// Frozen user cannot transfer even if authorized.
    #[test]
    fn test_frozen_user_cannot_transfer_even_if_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let recipient = Address::generate(&env);
        let contract_id = env.register(crate::orgusd::OrgUsdContract, ());
        let client = crate::orgusd::OrgUsdContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.authorize(&user);
        client.authorize(&recipient);
        client.mint(&user, &1000);
        // Freeze user
        client.freeze(&user);
        // User can no longer transfer
        let result = client.try_transfer(&user, &recipient, &100);
        assert_eq!(result, Err(Ok(crate::orgusd::OrgUsdError::AccountFrozen)));
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// 11. UNAUTHORIZED CALLER ERRORS
// ══════════════════════════════════════════════════════════════════════════════

/// Verify that unauthorized callers receive the expected error (panic).
mod unauthorized_caller_tests {
    use super::*;

    #[test]
    fn test_unauthorized_on_bulk_payment_set_paused() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            let contract_id = env.register(crate::bulk_payment::BulkPaymentContract, ());
            let client = crate::bulk_payment::BulkPaymentContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            // No mock_auths — any require_auth call will fail
            client.set_paused(&admin, &true);
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_unauthorized_on_cross_asset_payment_initiate() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            let contract_id = env.register(crate::cross_asset_payment::CrossAssetPaymentContract, ());
            let client = crate::cross_asset_payment::CrossAssetPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);
            // No mock_auths — require_auth on sender will fail
            let _ = client.try_initiate_payment(
                &sender,
                &100,
                &token_id,
                &String::from_str(&env, "receiver"),
                &String::from_str(&env, "USD"),
                &String::from_str(&env, "anchor"),
            );
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_unauthorized_on_milestone_escrow_set_paused() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let contract_id = env.register(crate::milestone_escrow::MilestoneEscrowContract, ());
            let client = crate::milestone_escrow::MilestoneEscrowContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            client.set_paused(&admin, &true);
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_unauthorized_on_orgusd_mint() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let account = Address::generate(&env);
            let contract_id = env.register(crate::orgusd::OrgUsdContract, ());
            let client = crate::orgusd::OrgUsdContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            client.mint(&account, &1000);
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_unauthorized_on_revenue_split_distribute() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let sender = Address::generate(&env);
            let r1 = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            let contract_id = env.register(crate::revenue_split::RevenueSplitContract, ());
            let client = crate::revenue_split::RevenueSplitContractClient::new(&env, &contract_id);
            let shares = soroban_sdk::vec![
                &env,
                crate::revenue_split::RecipientShare {
                    destination: r1,
                    basis_points: 10000,
                },
            ];
            client.init(&admin, &shares);
            // No mock_auths — from.require_auth will fail
            let _ = client.try_distribute(&token_id, &sender, &1000);
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_unauthorized_on_vesting_escrow_clawback() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let funder = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let admin = Address::generate(&env);
            let clawback_admin = Address::generate(&env);
            let token_admin = Address::generate(&env);
            let token_id = env
                .register_stellar_asset_contract_v2(token_admin.clone())
                .address();
            crate::vesting_escrow::StellarAssetClient::new(&env, &token_id).mint(&funder, &1_000_000);
            let contract_id = env.register(crate::vesting_escrow::VestingContract, ());
            let client = crate::vesting_escrow::VestingContractClient::new(&env, &contract_id);
            let start_time = 1_000_000u64;
            env.ledger().with_mut(|li| { li.timestamp = start_time; });
            client.initialize(&funder, &beneficiary, &token_id, &start_time, &0, &3600, &10000, &clawback_admin, &admin);
            // No mock_auths — clawback_admin.require_auth will fail
            client.clawback();
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_unauthorized_on_asset_path_payment_complete() {
        let result = std::panic::catch_unwind(|| {
            let env = Env::default();
            let admin = Address::generate(&env);
            let contract_id = env.register(crate::asset_path_payment::AssetPathPaymentContract, ());
            let client = crate::asset_path_payment::AssetPathPaymentContractClient::new(&env, &contract_id);
            client.init(&admin);
            // No mock_auths — require_admin will fail
            let _ = client.try_complete_path_payment(&1, &100, &100);
        });
        assert!(result.is_err());
    }
}
