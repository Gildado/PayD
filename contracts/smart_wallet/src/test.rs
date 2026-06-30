#![cfg(test)]

use crate::{
    SignatureProof, SignerKey, SmartWalletContract, SmartWalletContractClient, WalletError,
};
use core::convert::TryInto;
use ed25519_dalek::{Signer as _, SigningKey as Ed25519SigningKey};
use k256::ecdsa::SigningKey as SecpSigningKey;
use soroban_sdk::{Address, Bytes, BytesN, Env, Vec, crypto::Hash};

fn make_ed25519_signer(env: &Env, seed: [u8; 32]) -> (SignerKey, ed25519_dalek::SigningKey) {
    let signing_key = Ed25519SigningKey::from_bytes(&seed);
    let public_key = BytesN::from_array(env, &signing_key.verifying_key().to_bytes());
    (SignerKey::Ed25519(public_key), signing_key)
}

fn make_secp256k1_signer(env: &Env, seed: [u8; 32]) -> (SignerKey, SecpSigningKey) {
    let signing_key = SecpSigningKey::from_bytes((&seed).into()).expect("valid secp256k1 key");
    let public_key_bytes = signing_key.verifying_key().to_encoded_point(false);
    let public_key = BytesN::from_array(
        env,
        public_key_bytes
            .as_bytes()
            .try_into()
            .expect("65-byte secp256k1 public key"),
    );
    (SignerKey::Secp256k1(public_key), signing_key)
}

fn register_wallet(
    env: &Env,
    signers: Vec<SignerKey>,
    threshold: u32,
) -> (Address, SmartWalletContractClient<'static>) {
    let contract_id = env.register(SmartWalletContract, ());
    let client = SmartWalletContractClient::new(env, &contract_id);
    client.init(&signers, &threshold);
    (contract_id, client)
}

fn sign_ed25519(payload: &Hash<32>, signing_key: &Ed25519SigningKey, env: &Env) -> SignatureProof {
    let signature = signing_key.sign(payload.to_array().as_slice());
    let signature_bytes: [u8; 64] = signature.to_bytes();
    SignatureProof::Ed25519(crate::Ed25519Proof {
        public_key: BytesN::from_array(env, &signing_key.verifying_key().to_bytes()),
        signature: BytesN::from_array(env, &signature_bytes),
    })
}

fn sign_secp256k1(payload: &Hash<32>, signing_key: &SecpSigningKey, env: &Env) -> SignatureProof {
    let (signature, recovery_id) = signing_key
        .sign_prehash_recoverable(payload.to_array().as_slice())
        .expect("valid secp256k1 signature");
    let signature_bytes: [u8; 64] = signature.to_bytes().into();
    let public_key_bytes = signing_key.verifying_key().to_encoded_point(false);
    SignatureProof::Secp256k1(crate::Secp256k1Proof {
        public_key: BytesN::from_array(
            env,
            public_key_bytes
                .as_bytes()
                .try_into()
                .expect("65-byte secp256k1 public key"),
        ),
        signature: BytesN::from_array(env, &signature_bytes),
        recovery_id: u32::from(recovery_id.to_byte()),
    })
}

#[test]
fn ed25519_and_secp256k1_signatures_are_accepted() {
    let env = Env::default();

    let (ed_signer_key, ed_signing_key) = make_ed25519_signer(&env, [1u8; 32]);
    let (secp_signer_key, secp_signing_key) = make_secp256k1_signer(&env, [2u8; 32]);
    let signers = Vec::from_array(&env, [ed_signer_key.clone(), secp_signer_key.clone()]);

    let (contract_id, _client) = register_wallet(&env, signers, 2);

    let raw = Bytes::from_slice(&env, &[9u8; 32]);
    let payload = env.crypto().sha256(&raw);
    let proofs = Vec::from_array(
        &env,
        [
            sign_ed25519(&payload, &ed_signing_key, &env),
            sign_secp256k1(&payload, &secp_signing_key, &env),
        ],
    );

    env.as_contract(&contract_id, || {
        SmartWalletContract::verify_signatures_inner(&env, &payload, &proofs).unwrap();
    });
}

#[test]
fn secp256k1_auth_uses_host_budget() {
    let env = Env::default();

    let (secp_signer_key, secp_signing_key) = make_secp256k1_signer(&env, [3u8; 32]);
    let signers = Vec::from_array(&env, [secp_signer_key]);
    let (contract_id, _client) = register_wallet(&env, signers, 1);

    let raw = Bytes::from_slice(&env, &[10u8; 32]);
    let payload = env.crypto().sha256(&raw);
    let proof = Vec::from_array(&env, [sign_secp256k1(&payload, &secp_signing_key, &env)]);
    env.as_contract(&contract_id, || {
        SmartWalletContract::verify_signatures_inner(&env, &payload, &proof).unwrap();
    });

    let budget = env.cost_estimate().budget();
    budget.print();
}

#[test]
fn ed25519_auth_uses_host_budget() {
    let env = Env::default();

    let (ed_signer_key, ed_signing_key) = make_ed25519_signer(&env, [4u8; 32]);
    let signers = Vec::from_array(&env, [ed_signer_key]);
    let (contract_id, _client) = register_wallet(&env, signers, 1);

    let raw = Bytes::from_slice(&env, &[11u8; 32]);
    let payload = env.crypto().sha256(&raw);
    let proof = Vec::from_array(&env, [sign_ed25519(&payload, &ed_signing_key, &env)]);
    env.as_contract(&contract_id, || {
        SmartWalletContract::verify_signatures_inner(&env, &payload, &proof).unwrap();
    });

    let budget = env.cost_estimate().budget();
    budget.print();
}

#[test]
fn add_signer_increases_count() {
    let env = Env::default();
    env.mock_all_auths();

    let (signer1, _) = make_ed25519_signer(&env, [1u8; 32]);
    let (signer2, _) = make_ed25519_signer(&env, [2u8; 32]);
    let signers = Vec::from_array(&env, [signer1]);
    let (_contract_id, client) = register_wallet(&env, signers, 1);

    assert_eq!(client.signer_count(), 1);
    client.add_signer(&signer2);
    assert_eq!(client.signer_count(), 2);
}

#[test]
fn add_duplicate_signer_returns_error() {
    let env = Env::default();
    env.mock_all_auths();

    let (signer1, _) = make_ed25519_signer(&env, [1u8; 32]);
    let signers = Vec::from_array(&env, [signer1.clone()]);
    let (_contract_id, client) = register_wallet(&env, signers, 1);

    let result = client.try_add_signer(&signer1);
    assert_eq!(result, Err(Ok(WalletError::DuplicateSigner)));
}

#[test]
fn remove_signer_decreases_count() {
    let env = Env::default();
    env.mock_all_auths();

    let (signer1, _) = make_ed25519_signer(&env, [1u8; 32]);
    let (signer2, _) = make_ed25519_signer(&env, [2u8; 32]);
    let signers = Vec::from_array(&env, [signer1.clone(), signer2.clone()]);
    let (_contract_id, client) = register_wallet(&env, signers, 1);

    assert_eq!(client.signer_count(), 2);
    client.remove_signer(&signer2);
    assert_eq!(client.signer_count(), 1);
}

#[test]
fn remove_unknown_signer_returns_error() {
    let env = Env::default();
    env.mock_all_auths();

    let (signer1, _) = make_ed25519_signer(&env, [1u8; 32]);
    let (signer2, _) = make_ed25519_signer(&env, [2u8; 32]);
    let signers = Vec::from_array(&env, [signer1.clone()]);
    let (_contract_id, client) = register_wallet(&env, signers, 1);

    let result = client.try_remove_signer(&signer2);
    assert_eq!(result, Err(Ok(WalletError::UnknownSigner)));
}

#[test]
fn remove_signer_below_threshold_returns_error() {
    let env = Env::default();
    env.mock_all_auths();

    let (signer1, _) = make_ed25519_signer(&env, [1u8; 32]);
    let signers = Vec::from_array(&env, [signer1.clone()]);
    let (_contract_id, client) = register_wallet(&env, signers, 1);

    let result = client.try_remove_signer(&signer1);
    assert_eq!(result, Err(Ok(WalletError::InvalidThreshold)));
}

// ══════════════════════════════════════════════════════════════════════════════
// ── EVENT TESTS ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_wallet_initialized_event() {
    let env = Env::default();

    let (signer1, _) = make_ed25519_signer(&env, [1u8; 32]);
    let (signer2, _) = make_ed25519_signer(&env, [2u8; 32]);
    let signers = Vec::from_array(&env, [signer1, signer2]);

    let contract_id = env.register(SmartWalletContract, ());
    let client = SmartWalletContractClient::new(&env, &contract_id);
    client.init(&signers, &2);

    assert_eq!(client.signer_count(), 2);
    assert_eq!(client.threshold(), 2);
}

#[test]
fn test_signer_added_event() {
    let env = Env::default();
    env.mock_all_auths();

    let (signer1, _) = make_ed25519_signer(&env, [1u8; 32]);
    let (signer2, _) = make_ed25519_signer(&env, [2u8; 32]);
    let signers = Vec::from_array(&env, [signer1]);
    let (_contract_id, client) = register_wallet(&env, signers, 1);

    client.add_signer(&signer2);
    assert_eq!(client.signer_count(), 2);
}

#[test]
fn test_signer_removed_event() {
    let env = Env::default();
    env.mock_all_auths();

    let (signer1, _) = make_ed25519_signer(&env, [1u8; 32]);
    let (signer2, _) = make_ed25519_signer(&env, [2u8; 32]);
    let signers = Vec::from_array(&env, [signer1.clone(), signer2.clone()]);
    let (_contract_id, client) = register_wallet(&env, signers, 1);

    client.remove_signer(&signer2);
    assert_eq!(client.signer_count(), 1);
}

#[test]
fn test_threshold_changed_event() {
    let env = Env::default();
    env.mock_all_auths();

    let (signer1, _) = make_ed25519_signer(&env, [1u8; 32]);
    let (signer2, _) = make_ed25519_signer(&env, [2u8; 32]);
    let (signer3, _) = make_ed25519_signer(&env, [3u8; 32]);
    let signers = Vec::from_array(&env, [signer1, signer2, signer3]);
    let (_contract_id, client) = register_wallet(&env, signers, 1);

    client.set_threshold(&3);
    assert_eq!(client.threshold(), 3);
}


// ══════════════════════════════════════════════════════════════════════════════
// ── ISSUE #903: signature type-mismatch tests ─────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn ed25519_signer_rejects_secp256k1_proof() {
    // Register an ed25519 signer, then submit a secp256k1 proof — type mismatch
    // means signer_matches_proof always returns false → UnknownSigner.
    let env = Env::default();

    let (ed_signer_key, _ed_signing_key) = make_ed25519_signer(&env, [10u8; 32]);
    let (_secp_signer_key, secp_signing_key) = make_secp256k1_signer(&env, [11u8; 32]);
    let signers = Vec::from_array(&env, [ed_signer_key]);
    let (contract_id, _client) = register_wallet(&env, signers, 1);

    let raw = Bytes::from_slice(&env, &[42u8; 32]);
    let payload = env.crypto().sha256(&raw);
    // Submit a secp256k1 proof to a wallet that only has an ed25519 signer
    let proof = Vec::from_array(&env, [sign_secp256k1(&payload, &secp_signing_key, &env)]);

    env.as_contract(&contract_id, || {
        let result = SmartWalletContract::verify_signatures_inner(&env, &payload, &proof);
        assert_eq!(result, Err(WalletError::UnknownSigner));
    });
}

#[test]
fn secp256k1_signer_rejects_ed25519_proof() {
    // Register a secp256k1 signer, then submit an ed25519 proof — type mismatch
    // means signer_matches_proof always returns false → UnknownSigner.
    let env = Env::default();

    let (_ed_signer_key, ed_signing_key) = make_ed25519_signer(&env, [20u8; 32]);
    let (secp_signer_key, _secp_signing_key) = make_secp256k1_signer(&env, [21u8; 32]);
    let signers = Vec::from_array(&env, [secp_signer_key]);
    let (contract_id, _client) = register_wallet(&env, signers, 1);

    let raw = Bytes::from_slice(&env, &[43u8; 32]);
    let payload = env.crypto().sha256(&raw);
    // Submit an ed25519 proof to a wallet that only has a secp256k1 signer
    let proof = Vec::from_array(&env, [sign_ed25519(&payload, &ed_signing_key, &env)]);

    env.as_contract(&contract_id, || {
        let result = SmartWalletContract::verify_signatures_inner(&env, &payload, &proof);
        assert_eq!(result, Err(WalletError::UnknownSigner));
    });
}

#[test]
fn mixed_multisig_with_swapped_types_fails_threshold() {
    // 2-of-2 wallet: signer[0] is ed25519, signer[1] is secp256k1.
    // Submit proofs from UNREGISTERED keys of each type — neither proof matches
    // any registered signer so the batch never satisfies the threshold.
    let env = Env::default();

    let (ed_signer_key, _ed_signing_key) = make_ed25519_signer(&env, [30u8; 32]);
    let (secp_signer_key, _secp_signing_key) = make_secp256k1_signer(&env, [31u8; 32]);
    // Register the above two keys.
    let signers = Vec::from_array(&env, [ed_signer_key, secp_signer_key]);
    let (contract_id, _client) = register_wallet(&env, signers, 2);

    let raw = Bytes::from_slice(&env, &[44u8; 32]);
    let payload = env.crypto().sha256(&raw);

    // Use DIFFERENT (unregistered) keys to sign — these proofs cannot match any slot.
    let (_, unregistered_secp_key) = make_secp256k1_signer(&env, [32u8; 32]);
    let (_, unregistered_ed_key) = make_ed25519_signer(&env, [33u8; 32]);
    let proofs = Vec::from_array(
        &env,
        [
            sign_secp256k1(&payload, &unregistered_secp_key, &env),
            sign_ed25519(&payload, &unregistered_ed_key, &env),
        ],
    );

    env.as_contract(&contract_id, || {
        let result = SmartWalletContract::verify_signatures_inner(&env, &payload, &proofs);
        // Both proofs are from unknown keys → UnknownSigner on the first proof.
        assert_eq!(result, Err(WalletError::UnknownSigner));
    });
}

#[test]
fn mixed_multisig_correct_types_satisfy_threshold() {
    // 2-of-3 wallet with ed25519, secp256k1, ed25519 signers.
    // Submitting correct-type proofs for two different key-type slots must pass.
    let env = Env::default();

    let (ed_signer_key1, ed_signing_key1) = make_ed25519_signer(&env, [40u8; 32]);
    let (secp_signer_key, secp_signing_key) = make_secp256k1_signer(&env, [41u8; 32]);
    let (ed_signer_key2, _ed_signing_key2) = make_ed25519_signer(&env, [42u8; 32]);
    let signers = Vec::from_array(
        &env,
        [ed_signer_key1, secp_signer_key, ed_signer_key2],
    );
    let (contract_id, _client) = register_wallet(&env, signers, 2);

    let raw = Bytes::from_slice(&env, &[45u8; 32]);
    let payload = env.crypto().sha256(&raw);
    let proofs = Vec::from_array(
        &env,
        [
            sign_ed25519(&payload, &ed_signing_key1, &env),
            sign_secp256k1(&payload, &secp_signing_key, &env),
        ],
    );

    env.as_contract(&contract_id, || {
        SmartWalletContract::verify_signatures_inner(&env, &payload, &proofs).unwrap();
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ISSUE #900: duplicate-signer guard and cross-key-type tests ───────────────
// ══════════════════════════════════════════════════════════════════════════════

/// Submitting the same signer's proof twice must not count toward the threshold
/// more than once.
///
/// How the guard works: the inner loop in verify_signatures_inner() skips any
/// signer slot already in `used_signers`.  When the same proof is submitted a
/// second time, no unused matching slot remains and the call returns
/// `UnknownSigner` rather than incrementing `valid_signatures` again.
#[test]
fn duplicate_ed25519_proof_only_counts_once() {
    let env = Env::default();

    let (ed_signer_key, ed_signing_key) = make_ed25519_signer(&env, [50u8; 32]);
    // Register one signer; threshold = 1 so the first proof satisfies it.
    let signers = Vec::from_array(&env, [ed_signer_key]);
    let (contract_id, _client) = register_wallet(&env, signers, 1);

    let raw = Bytes::from_slice(&env, &[55u8; 32]);
    let payload = env.crypto().sha256(&raw);
    let proof = sign_ed25519(&payload, &ed_signing_key, &env);

    // Submit the same proof twice.  The first consumption of slot 0 is valid;
    // the second finds slot 0 already in `used_signers` and cannot re-match.
    let proofs = Vec::from_array(&env, [proof.clone(), proof]);
    env.as_contract(&contract_id, || {
        let result = SmartWalletContract::verify_signatures_inner(&env, &payload, &proofs);
        assert_eq!(result, Err(WalletError::UnknownSigner));
    });
}

/// 2-of-2 wallet: attacker submits signer A's proof twice instead of A + B.
/// The duplicate must NOT satisfy the threshold.
#[test]
fn duplicate_ed25519_proof_cannot_satisfy_two_of_two_threshold() {
    let env = Env::default();

    let (ed_signer_key_a, ed_signing_key_a) = make_ed25519_signer(&env, [60u8; 32]);
    let (ed_signer_key_b, _) = make_ed25519_signer(&env, [61u8; 32]);
    let signers = Vec::from_array(&env, [ed_signer_key_a, ed_signer_key_b]);
    let (contract_id, _client) = register_wallet(&env, signers, 2);

    let raw = Bytes::from_slice(&env, &[66u8; 32]);
    let payload = env.crypto().sha256(&raw);
    let proof_a = sign_ed25519(&payload, &ed_signing_key_a, &env);

    // Slot A is consumed by the first proof; the second finds no unused match.
    let proofs = Vec::from_array(&env, [proof_a.clone(), proof_a]);
    env.as_contract(&contract_id, || {
        let result = SmartWalletContract::verify_signatures_inner(&env, &payload, &proofs);
        assert_eq!(result, Err(WalletError::UnknownSigner));
    });
}

/// Ed25519 and secp256k1 keys from the "same person" occupy separate signer
/// slots and are counted independently — no cross-type conflation or
/// double-counting in either direction.
#[test]
fn ed25519_and_secp256k1_same_person_count_as_independent_signers() {
    let env = Env::default();

    let (ed_signer_key, ed_signing_key) = make_ed25519_signer(&env, [70u8; 32]);
    let (secp_signer_key, secp_signing_key) = make_secp256k1_signer(&env, [71u8; 32]);

    // Register both key types; threshold = 2.
    let signers = Vec::from_array(&env, [ed_signer_key, secp_signer_key]);
    let (contract_id, _client) = register_wallet(&env, signers, 2);

    let raw = Bytes::from_slice(&env, &[77u8; 32]);
    let payload = env.crypto().sha256(&raw);
    let proofs = Vec::from_array(
        &env,
        [
            sign_ed25519(&payload, &ed_signing_key, &env),
            sign_secp256k1(&payload, &secp_signing_key, &env),
        ],
    );

    env.as_contract(&contract_id, || {
        // Each key fills its own slot (indices 0 and 1) → valid_signatures = 2.
        SmartWalletContract::verify_signatures_inner(&env, &payload, &proofs).unwrap();
    });
}

/// Cross-type mismatch: an Ed25519 proof submitted to a wallet whose only
/// signer is registered as secp256k1 must return UnknownSigner.
/// Confirms signer_matches_proof() is type-aware and never cross-matches.
#[test]
fn cross_type_ed25519_proof_against_secp256k1_slot_fails() {
    let env = Env::default();

    let (_ed_key, ed_signing_key) = make_ed25519_signer(&env, [80u8; 32]);
    let (secp_key, _) = make_secp256k1_signer(&env, [81u8; 32]);

    let signers = Vec::from_array(&env, [secp_key]);
    let (contract_id, _client) = register_wallet(&env, signers, 1);

    let raw = Bytes::from_slice(&env, &[88u8; 32]);
    let payload = env.crypto().sha256(&raw);
    let proof = Vec::from_array(&env, [sign_ed25519(&payload, &ed_signing_key, &env)]);

    env.as_contract(&contract_id, || {
        let result = SmartWalletContract::verify_signatures_inner(&env, &payload, &proof);
        assert_eq!(result, Err(WalletError::UnknownSigner));
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ISSUE #899: verify_secp256k1() must return WalletError, not panic ─────────
// ══════════════════════════════════════════════════════════════════════════════

/// A secp256k1 proof whose claimed public key matches the registered signer but
/// whose signature was produced by a different key must return InvalidSignature
/// instead of panicking.
#[test]
fn bad_secp256k1_signature_returns_invalid_signature() {
    let env = Env::default();

    // Register signer A.
    let (secp_signer_key_a, _secp_signing_key_a) = make_secp256k1_signer(&env, [90u8; 32]);
    // Key B will provide the (mismatched) signature.
    let (_, secp_signing_key_b) = make_secp256k1_signer(&env, [91u8; 32]);

    let signers = Vec::from_array(&env, [secp_signer_key_a.clone()]);
    let (contract_id, _client) = register_wallet(&env, signers, 1);

    let raw = Bytes::from_slice(&env, &[92u8; 32]);
    let payload = env.crypto().sha256(&raw);

    // Sign the payload with key B, then build a proof claiming key A's public key.
    // secp256k1_recover will recover key B (≠ A) → must return InvalidSignature.
    let (sig_b, rec_b) = secp_signing_key_b
        .sign_prehash_recoverable(payload.to_array().as_slice())
        .expect("valid secp256k1 signature");
    let sig_bytes: [u8; 64] = sig_b.to_bytes().into();

    let a_pubkey = match secp_signer_key_a {
        SignerKey::Secp256k1(pk) => pk,
        _ => panic!("expected secp256k1 key"),
    };

    let bad_proof = SignatureProof::Secp256k1(crate::Secp256k1Proof {
        public_key: a_pubkey,
        signature: BytesN::from_array(&env, &sig_bytes),
        recovery_id: u32::from(rec_b.to_byte()),
    });

    let proofs = Vec::from_array(&env, [bad_proof]);
    env.as_contract(&contract_id, || {
        let result = SmartWalletContract::verify_signatures_inner(&env, &payload, &proofs);
        assert_eq!(result, Err(WalletError::InvalidSignature));
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ISSUE #898: verify_ed25519() must return WalletError, not panic ───────────
// ══════════════════════════════════════════════════════════════════════════════

/// An ed25519 proof whose claimed public key matches the registered signer but
/// whose signature was produced by a different key must return InvalidSignature
/// instead of panicking.
#[test]
fn bad_ed25519_signature_returns_invalid_signature() {
    let env = Env::default();

    // Register signer A.
    let (ed_signer_key_a, _ed_signing_key_a) = make_ed25519_signer(&env, [80u8; 32]);
    // Key B will provide the (mismatched) signature.
    let (_, ed_signing_key_b) = make_ed25519_signer(&env, [81u8; 32]);

    let signers = Vec::from_array(&env, [ed_signer_key_a.clone()]);
    let (contract_id, _client) = register_wallet(&env, signers, 1);

    let raw = Bytes::from_slice(&env, &[82u8; 32]);
    let payload = env.crypto().sha256(&raw);

    // Sign the payload with key B, then build a proof claiming key A's public key.
    // ed25519_verify will reject the mismatch → must return InvalidSignature.
    let sig_b = ed_signing_key_b.sign(payload.to_array().as_slice());
    let sig_bytes: [u8; 64] = sig_b.to_bytes();

    let a_pubkey = match ed_signer_key_a {
        SignerKey::Ed25519(pk) => pk,
        _ => panic!("expected ed25519 key"),
    };

    let bad_proof = SignatureProof::Ed25519(crate::Ed25519Proof {
        public_key: a_pubkey,
        signature: BytesN::from_array(&env, &sig_bytes),
    });

    let proofs = Vec::from_array(&env, [bad_proof]);
    env.as_contract(&contract_id, || {
        let result = SmartWalletContract::verify_signatures_inner(&env, &payload, &proofs);
        assert_eq!(result, Err(WalletError::InvalidSignature));
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ISSUE #901: add_signer() must reject duplicate signers ────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/// Adding a secp256k1 signer that is already registered must return DuplicateSigner.
#[test]
fn add_duplicate_secp256k1_signer_returns_error() {
    let env = Env::default();
    env.mock_all_auths();

    let (signer1, _) = make_secp256k1_signer(&env, [1u8; 32]);
    let signers = Vec::from_array(&env, [signer1.clone()]);
    let (_contract_id, client) = register_wallet(&env, signers, 1);

    let result = client.try_add_signer(&signer1);
    assert_eq!(result, Err(Ok(WalletError::DuplicateSigner)));
}
