#![no_std]

use soroban_sdk::{
    Bytes, BytesN, Env, String, Vec,
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractevent, contractimpl, contracttype,
    crypto::Hash,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum WalletError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidThreshold = 3,
    DuplicateSigner = 4,
    UnknownSigner = 5,
    InvalidSignature = 6,
    NotEnoughSignatures = 7,
}

// ── Events ────────────────────────────────────────────────────────────────────

/// Emitted when the wallet is initialized with its signer set.
#[contractevent]
pub struct WalletInitializedEvent {
    pub signer_count: u32,
    pub threshold: u32,
}

/// Emitted when a new signer is added to the wallet.
#[contractevent]
pub struct SignerAddedEvent {
    pub added: SignerKey,
    pub total_signers: u32,
}

/// Emitted when a signer is removed from the wallet.
#[contractevent]
pub struct SignerRemovedEvent {
    pub removed: SignerKey,
    pub total_signers: u32,
}

/// Emitted when the signing threshold is changed.
#[contractevent]
pub struct ThresholdChangedEvent {
    pub old_threshold: u32,
    pub new_threshold: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SignerKey {
    Ed25519(BytesN<32>),
    Secp256k1(BytesN<65>),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SignatureProof {
    Ed25519(Ed25519Proof),
    Secp256k1(Secp256k1Proof),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Ed25519Proof {
    pub public_key: BytesN<32>,
    pub signature: BytesN<64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Secp256k1Proof {
    pub public_key: BytesN<65>,
    pub signature: BytesN<64>,
    pub recovery_id: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Signers,
    Threshold,
}

#[contract]
pub struct SmartWalletContract;

#[contractimpl]
impl SmartWalletContract {
    // ── SEP-0034 Contract Metadata ───────────────────────────

    /// Returns the human-readable contract name (SEP-0034).
    pub fn name(env: Env) -> String {
        String::from_str(&env, env!("CARGO_PKG_NAME"))
    }

    /// Returns the contract version string (SEP-0034).
    pub fn version(env: Env) -> String {
        String::from_str(&env, env!("CARGO_PKG_VERSION"))
    }

    /// Returns the contract author / organization (SEP-0034).
    pub fn author(env: Env) -> String {
        String::from_str(&env, env!("CARGO_PKG_AUTHORS"))
    }

    /// Initializes the wallet with a signer set and a signature threshold.
    pub fn init(env: Env, signers: Vec<SignerKey>, threshold: u32) -> Result<(), WalletError> {
        if env.storage().instance().has(&DataKey::Signers) {
            return Err(WalletError::AlreadyInitialized);
        }

        Self::validate_signers(&signers)?;
        Self::validate_threshold(&signers, threshold)?;

        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage()
            .instance()
            .set(&DataKey::Threshold, &threshold);

        WalletInitializedEvent {
            signer_count: signers.len(),
            threshold,
        }
        .publish(&env);
        Ok(())
    }

    /// Returns the configured threshold.
    pub fn threshold(env: Env) -> Result<u32, WalletError> {
        Self::load_threshold(&env)
    }

    /// Returns the number of configured signers.
    pub fn signer_count(env: Env) -> Result<u32, WalletError> {
        let signers = Self::load_signers(&env)?;
        Ok(signers.len())
    }

    /// Example admin operation that uses the contract account as the auth source.
    pub fn set_threshold(env: Env, threshold: u32) -> Result<(), WalletError> {
        env.current_contract_address().require_auth();

        let signers = Self::load_signers(&env)?;
        let old_threshold = Self::load_threshold(&env)?;
        Self::validate_threshold(&signers, threshold)?;

        env.storage()
            .instance()
            .set(&DataKey::Threshold, &threshold);

        ThresholdChangedEvent {
            old_threshold,
            new_threshold: threshold,
        }
        .publish(&env);
        Ok(())
    }

    /// Adds a new signer key to the wallet. The new key must not duplicate an
    /// existing signer. Requires the contract account to authorise (i.e. the
    /// current threshold of existing signers must sign this call).
    pub fn add_signer(env: Env, new_signer: SignerKey) -> Result<(), WalletError> {
        env.current_contract_address().require_auth();

        let mut signers = Self::load_signers(&env)?;

        // Reject duplicates
        let mut i = 0u32;
        while i < signers.len() {
            let s = signers.get(i).ok_or(WalletError::NotInitialized)?;
            if s == new_signer {
                return Err(WalletError::DuplicateSigner);
            }
            i += 1;
        }

        signers.push_back(new_signer.clone());
        env.storage().instance().set(&DataKey::Signers, &signers);

        SignerAddedEvent {
            added: new_signer,
            total_signers: signers.len(),
        }
        .publish(&env);
        Ok(())
    }

    /// Removes an existing signer key from the wallet.
    /// Returns `WalletError::UnknownSigner` if the key is not registered, or
    /// `WalletError::InvalidThreshold` if removal would drop below the current
    /// threshold. Requires the contract account to authorise.
    pub fn remove_signer(env: Env, signer: SignerKey) -> Result<(), WalletError> {
        env.current_contract_address().require_auth();

        let signers = Self::load_signers(&env)?;
        let threshold = Self::load_threshold(&env)?;

        // Locate the signer to remove
        let mut found_index: Option<u32> = None;
        let mut i = 0u32;
        while i < signers.len() {
            let s = signers.get(i).ok_or(WalletError::NotInitialized)?;
            if s == signer {
                found_index = Some(i);
                break;
            }
            i += 1;
        }

        let idx = found_index.ok_or(WalletError::UnknownSigner)?;

        // Must still satisfy threshold after removal
        if signers.len() - 1 < threshold {
            return Err(WalletError::InvalidThreshold);
        }

        let mut new_signers: Vec<SignerKey> = Vec::new(&env);
        let mut j = 0u32;
        while j < signers.len() {
            if j != idx {
                let s = signers.get(j).ok_or(WalletError::NotInitialized)?;
                new_signers.push_back(s);
            }
            j += 1;
        }

        env.storage()
            .instance()
            .set(&DataKey::Signers, &new_signers);

        SignerRemovedEvent {
            removed: signer,
            total_signers: new_signers.len(),
        }
        .publish(&env);
        Ok(())
    }

    fn load_signers(env: &Env) -> Result<Vec<SignerKey>, WalletError> {
        env.storage()
            .instance()
            .get(&DataKey::Signers)
            .ok_or(WalletError::NotInitialized)
    }

    fn load_threshold(env: &Env) -> Result<u32, WalletError> {
        env.storage()
            .instance()
            .get(&DataKey::Threshold)
            .ok_or(WalletError::NotInitialized)
    }

    fn validate_signers(signers: &Vec<SignerKey>) -> Result<(), WalletError> {
        let mut i = 0u32;
        while i < signers.len() {
            let lhs = signers.get(i).ok_or(WalletError::NotInitialized)?;
            let mut j = i + 1;
            while j < signers.len() {
                let rhs = signers.get(j).ok_or(WalletError::NotInitialized)?;
                if lhs == rhs {
                    return Err(WalletError::DuplicateSigner);
                }
                j += 1;
            }
            i += 1;
        }

        Ok(())
    }

    fn validate_threshold(signers: &Vec<SignerKey>, threshold: u32) -> Result<(), WalletError> {
        if threshold == 0 || threshold > signers.len() {
            return Err(WalletError::InvalidThreshold);
        }

        Ok(())
    }

    fn verify_ed25519(
        env: &Env,
        payload: &Hash<32>,
        public_key: &BytesN<32>,
        signature: &BytesN<64>,
    ) {
        let message: Bytes = Bytes::from(&payload.to_bytes());
        env.crypto().ed25519_verify(public_key, &message, signature);
    }

    fn verify_secp256k1(
        env: &Env,
        payload: &Hash<32>,
        public_key: &BytesN<65>,
        signature: &BytesN<64>,
        recovery_id: u32,
    ) -> Result<(), WalletError> {
        let recovered = env
            .crypto()
            .secp256k1_recover(payload, signature, recovery_id);
        if &recovered != public_key {
            return Err(WalletError::InvalidSignature);
        }
        Ok(())
    }

    fn signer_matches_proof(signer: &SignerKey, proof: &SignatureProof) -> bool {
        match (signer, proof) {
            (SignerKey::Ed25519(expected), SignatureProof::Ed25519(proof)) => {
                expected == &proof.public_key
            }
            (SignerKey::Secp256k1(expected), SignatureProof::Secp256k1(proof)) => {
                expected == &proof.public_key
            }
            _ => false,
        }
    }

    fn verify_signatures_inner(
        env: &Env,
        signature_payload: &Hash<32>,
        signatures: &Vec<SignatureProof>,
    ) -> Result<(), WalletError> {
        let signers = Self::load_signers(env)?;
        let threshold = Self::load_threshold(env)?;

        let mut valid_signatures = 0u32;
        // Tracks the signer-list indices that have already been matched to a
        // proof in this batch.  The duplicate-detection invariant is:
        //
        //   Each signer index may appear in `used_signers` at most once.
        //
        // Enforcement uses two complementary layers:
        //   1. Inner-loop skip (primary)  – before testing a signer for a
        //      match, we skip it if its index is already in `used_signers`.
        //      This means a used signer slot can never become `matched_signer_index`,
        //      so the same signer cannot be counted twice even if the same proof
        //      is submitted multiple times in the `signatures` list.
        //   2. Post-loop assertion (defensive) – after the inner loop we verify
        //      that `matched_signer_index` (when Some) is not already in
        //      `used_signers`.  Because the inner-loop skip makes this
        //      unreachable in practice, this check is a safety belt against
        //      future refactors that might break the skip invariant.
        //
        // Consequence: submitting the same signer's proof twice (or more)
        // causes the second occurrence's inner loop to find no unused signer
        // slot that matches, resulting in `UnknownSigner` — not `DuplicateSigner`.
        // The `DuplicateSigner` branch exists solely as the defensive layer.
        let mut used_signers: Vec<u32> = Vec::new(env);

        let mut signature_index = 0u32;
        while signature_index < signatures.len() {
            let proof = signatures
                .get(signature_index)
                .ok_or(WalletError::InvalidSignature)?;

            // ── Inner loop: find an unused signer slot that matches this proof ─
            // Note: key-type is part of identity.  An Ed25519 proof for a
            // secp256k1 signer slot (or vice-versa) never matches because
            // `signer_matches_proof` performs a type-aware comparison.  This
            // ensures proofs of different key types from the "same person"
            // (holding multiple registered keys) each satisfy their own distinct
            // signer slot and are never conflated.
            let mut matched_signer_index: Option<u32> = None;
            let mut signer_index = 0u32;
            while signer_index < signers.len() {
                // Layer 1: skip slots already consumed by an earlier proof.
                if used_signers.iter().any(|used| used == signer_index) {
                    signer_index += 1;
                    continue;
                }

                let signer = signers
                    .get(signer_index)
                    .ok_or(WalletError::InvalidSignature)?;
                if Self::signer_matches_proof(&signer, &proof) {
                    matched_signer_index = Some(signer_index);
                    match (signer, proof) {
                        (SignerKey::Ed25519(public_key), SignatureProof::Ed25519(proof)) => {
                            if public_key != proof.public_key {
                                return Err(WalletError::UnknownSigner);
                            }
                            Self::verify_ed25519(
                                env,
                                signature_payload,
                                &proof.public_key,
                                &proof.signature,
                            );
                        }
                        (SignerKey::Secp256k1(public_key), SignatureProof::Secp256k1(proof)) => {
                            if public_key != proof.public_key {
                                return Err(WalletError::UnknownSigner);
                            }
                            Self::verify_secp256k1(
                                env,
                                signature_payload,
                                &proof.public_key,
                                &proof.signature,
                                proof.recovery_id,
                            )?;
                        }
                        _ => return Err(WalletError::UnknownSigner),
                    }
                    break;
                }
                signer_index += 1;
            }

            // If no unused signer matched, the proof is either unknown or a
            // duplicate attempt (all matching slots were already consumed by
            // the inner-loop skip above).  Both cases are surfaced as
            // UnknownSigner from the caller's perspective.
            let signer_index = matched_signer_index.ok_or(WalletError::UnknownSigner)?;

            // Layer 2 (defensive): assert the matched index was indeed unused.
            // This should be unreachable given the inner-loop skip, but is
            // retained as a safety belt.
            if used_signers.iter().any(|used| used == signer_index) {
                return Err(WalletError::DuplicateSigner);
            }
            used_signers.push_back(signer_index);
            valid_signatures += 1;
            signature_index += 1;
        }

        if valid_signatures < threshold {
            return Err(WalletError::NotEnoughSignatures);
        }

        Ok(())
    }
}

#[allow(non_snake_case)]
impl CustomAccountInterface for SmartWalletContract {
    type Signature = Vec<SignatureProof>;
    type Error = WalletError;

    fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,
        signatures: Self::Signature,
        _auth_context: Vec<Context>,
    ) -> Result<(), WalletError> {
        Self::verify_signatures_inner(&env, &signature_payload, &signatures)
    }
}

mod test;
