# Smart Wallet Custom Account Contract (`smart_wallet`)

The **Smart Wallet Contract** is a Soroban custom-account contract implementing multi-signature governance, threshold signatures (M-of-N), mixed cryptographic key support (Ed25519 & secp256k1), dynamic signer management, and custom account auth verification (`__check_auth`).

---

## Purpose

Enterprise payroll and multisig treasury management require flexible multisig authorization:
- **Mixed Key Support**: Supports native Stellar `Ed25519` keys as well as Ethereum/hardware wallet `secp256k1` keys within the same signer set.
- **Dynamic M-of-N Thresholds**: Allows adding/removing signers and updating required signature thresholds under current wallet authorization.
- **Custom Account Interface**: Implements Soroban's `CustomAccountInterface`, allowing the smart wallet contract address to authorize contract invocations (e.g. `bulk_payment.execute_batch`) as a first-class account.

---

## Interface

### Public Functions

| Function | Parameters | Return Type | Access Control | Description |
|---|---|---|---|---|
| `name` | `env: Env` | `String` | Public | Returns contract name (`smart_wallet`). |
| `version` | `env: Env` | `String` | Public | Returns contract version string (SEP-0034). |
| `author` | `env: Env` | `String` | Public | Returns package author metadata. |
| `init` | `env: Env, signers: Vec<SignerKey>, threshold: u32` | `Result<(), WalletError>` | Public (Once) | Initializes wallet with initial signers set and M-of-N threshold. |
| `threshold` | `env: Env` | `Result<u32, WalletError>` | Public | Reads current M-of-N signature threshold. |
| `signer_count` | `env: Env` | `Result<u32, WalletError>` | Public | Reads total count of registered signers. |
| `set_threshold` | `env: Env, threshold: u32` | `Result<(), WalletError>` | Contract Auth | Updates signature threshold. Requires current wallet multisig auth. |
| `add_signer` | `env: Env, new_signer: SignerKey` | `Result<(), WalletError>` | Contract Auth | Adds a new signer key. Requires current wallet multisig auth. |
| `remove_signer` | `env: Env, signer: SignerKey` | `Result<(), WalletError>` | Contract Auth | Removes an existing signer key. Requires current wallet multisig auth. |
| `__check_auth` | `env: Env, signature_payload: Hash<32>, signatures: Vec<SignatureProof>, auth_context: Vec<Context>` | `Result<(), WalletError>` | Soroban System | Custom account auth callback; verifies M-of-N signatures against registered signers. |

---

## Storage Layout

State is maintained in Soroban `Instance` storage for fast, low-cost verification during auth checks.

| Key | Storage Domain | Value Type | Description / Key Pattern |
|---|---|---|---|
| `DataKey::Signers` | Instance | `Vec<SignerKey>` | Vector of registered `Ed25519` or `Secp256k1` signer keys. |
| `DataKey::Threshold` | Instance | `u32` | M-of-N signature threshold required for authorization. |

---

## Security Considerations

1. **Two-Layer Duplicate Proof Prevention**:
   - Layer 1 (Primary): When matching proofs to signer slots, used slots are skipped so the same signer cannot be counted twice even if duplicate proofs are submitted.
   - Layer 2 (Defensive): Post-match assertion checks slot availability, returning `DuplicateSigner` or `UnknownSigner`.
2. **Type-Aware Key Matching**:
   - `signer_matches_proof` checks key-type enum variants (`Ed25519` vs `Secp256k1`). An Ed25519 proof cannot satisfy a secp256k1 slot.
3. **Threshold Enforcement Invariants**:
   - `remove_signer` asserts `signers.len() - 1 >= threshold` (`InvalidThreshold`), preventing removals that would lock out the wallet.
   - `set_threshold` asserts `0 < threshold <= signers.len()`.
4. **Self-Authorization**:
   - `add_signer`, `remove_signer`, and `set_threshold` invoke `env.current_contract_address().require_auth()`, ensuring all administration requires full threshold multisig consent.

---

## Usage Examples

### Initializing Smart Wallet (`Soroban CLI`)

```bash
soroban contract invoke \
  --id <SMART_WALLET_CONTRACT_ID> \
  -- \
  init \
  --signers '[{"ed25519":"<ED25519_BYTES32_HEX>"},{"secp256k1":"<SECP256K1_BYTES65_HEX>"}]' \
  --threshold 2
```

---

## Cross-References

- **`bulk_payment`**: Uses `smart_wallet` as the multisig admin or payroll sender.
- **`vesting_escrow`**: Uses `smart_wallet` as the governance or clawback admin address.
- **`orgusd`**: Uses `smart_wallet` for multisig token issuance governance.
