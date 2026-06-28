# Smart Wallet Contract

A Soroban custom-account contract that supports mixed signer sets and an M-of-N signing threshold.

Supported key types:

- **Ed25519** — standard Stellar account keys
- **secp256k1** — Ethereum-style keys for bridge tooling and hardware wallets

---

## Contract functions

### Lifecycle

| Function | Description |
|---|---|
| `init(signers, threshold)` | One-time setup. Stores the initial signer list and threshold. Returns `AlreadyInitialized` if called again. |
| `name() → String` | SEP-0034 contract name. |
| `version() → String` | SEP-0034 contract version. |
| `author() → String` | SEP-0034 contract author. |

### Signer management

All mutating operations require the contract account itself to authorise the call (i.e. the current threshold of signers must sign).

| Function | Description |
|---|---|
| `add_signer(signer)` | Adds a new key. Returns `DuplicateSigner` if the key is already registered. |
| `remove_signer(signer)` | Removes a key. Returns `UnknownSigner` if the key is not registered; returns `InvalidThreshold` if removal would leave fewer signers than the threshold. |
| `set_threshold(threshold)` | Updates the M-of-N requirement. Returns `InvalidThreshold` if the new value is zero or exceeds the signer count. |
| `signer_count() → u32` | Returns the number of registered signers. |
| `threshold() → u32` | Returns the current threshold. |

### Authentication (`__check_auth`)

Soroban calls this automatically when the wallet account must authorise an operation. Callers supply a `Vec<SignatureProof>`. The contract:

1. Verifies each proof against a registered signer slot (type-aware — an Ed25519 proof cannot satisfy a secp256k1 slot).
2. Prevents the same signer slot from being counted twice.
3. Returns `NotEnoughSignatures` if the number of valid, distinct signatures is below the threshold.

---

## Error codes (`WalletError`)

| Variant | Value | Meaning |
|---|---|---|
| `AlreadyInitialized` | 1 | `init` called more than once. |
| `NotInitialized` | 2 | A function was called before `init`. |
| `InvalidThreshold` | 3 | Threshold is zero, exceeds signer count, or removal would drop below it. |
| `DuplicateSigner` | 4 | Attempted to add a key that is already registered. |
| `UnknownSigner` | 5 | Proof or removal target does not match any registered signer. |
| `InvalidSignature` | 6 | Cryptographic verification failed (wrong key or bad signature bytes). |
| `NotEnoughSignatures` | 7 | Fewer valid signatures were supplied than the threshold requires. |

---

## Events

| Event | Fields | Emitted by |
|---|---|---|
| `WalletInitializedEvent` | `signer_count`, `threshold` | `init` |
| `SignerAddedEvent` | `added: SignerKey`, `total_signers` | `add_signer` |
| `SignerRemovedEvent` | `removed: SignerKey`, `total_signers` | `remove_signer` |
| `ThresholdChangedEvent` | `old_threshold`, `new_threshold` | `set_threshold` |

---

## Signing payloads

Soroban passes a raw 32-byte `Hash<32>` into `__check_auth`. Sign that exact digest — do not add any prefix or chain-specific framing.

### Ed25519

- Sign the raw 32-byte payload.
- Provide `Ed25519Proof { public_key: BytesN<32>, signature: BytesN<64> }`.

### secp256k1

- Sign the same 32-byte payload with ECDSA secp256k1.
- Provide `Secp256k1Proof { public_key: BytesN<65>, signature: BytesN<64>, recovery_id: u32 }`.
- The wallet recovers the public key from the signature and compares it to the registered key; do not use `personal_sign`-style prefixes.

---

## Testing

```
cargo test --features testutils --target aarch64-apple-darwin
```

The test suite covers signer management, threshold enforcement, auth verification for both key types, mixed M-of-N scenarios, duplicate-proof rejection, and all error paths. Budget-printing tests are included so you can compare CPU instruction usage between Ed25519 and secp256k1 verification in the Soroban environment.
