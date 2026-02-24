# Multi-Sig Recovery Guide for PayD Issuer Account

This document outlines the recovery procedures for the PayD issuer account when using multi-signature (m-of-n) authorization.

## Overview

The issuer account uses a multi-signature scheme where multiple parties must approve high-impact operations (such as asset issuance and fund transfers). This prevents any single entity from acting unilaterally.

## Understanding Thresholds

| Threshold Level | Operations | Typical Setting |
|---|---|---|
| **Low** | Allow trust, bump sequence | 1 signer |
| **Medium** | Payments, manage offers, manage data | 2 signers |
| **High** | Set options, change signers, merge account | 3 signers |

## Recovery Scenarios

### Scenario 1: A Signer Loses Their Key

1. The remaining signers must collectively meet the **high threshold** to remove the compromised signer.
2. Use the `DELETE /api/v1/multisig/signers/:publicKey` endpoint. The transaction must be signed by enough remaining signers to meet the high threshold.
3. Generate a new keypair for the affected party using `StellarService.generateTestnetKeypair()`.
4. Add the new signer using `POST /api/v1/multisig/signers` with the replacement public key.

### Scenario 2: Emergency Key Rotation

1. Have all active signers available.
2. Use `POST /api/v1/multisig/configure` with the updated signer list.
3. The old signers are replaced atomically in a single transaction.

### Scenario 3: Account Lockout Prevention

Before applying any multi-sig configuration, the system automatically validates:
- The total signer weight must be >= the highest threshold.
- No single signer can meet the high threshold alone (which would defeat the multi-sig purpose).
- All threshold values must be properly ordered (low <= med <= high).

If validation fails, the configuration is rejected.

### Scenario 3: Complete Recovery (All Keys Lost)

> **Warning**: If the total weight of available signers falls below the high threshold, the account cannot be reconfigured. This is by design to prevent unauthorized changes.

**Prevention measures:**
- Store encrypted backup keys in a secure offline vault.
- Use hardware security modules (HSMs) for key storage.
- Designate a "recovery signer" whose key is stored in a separate, offline location.

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/multisig/configure` | POST | Full multi-sig setup |
| `/api/v1/multisig/status/:key` | GET | View current config |
| `/api/v1/multisig/signers` | POST | Add a signer |
| `/api/v1/multisig/signers/:key` | DELETE | Remove a signer |
| `/api/v1/multisig/thresholds` | PUT | Update thresholds |

## Best Practices

1. **Never set master weight to 0** unless you have enough other signers to meet all thresholds.
2. **Always validate configurations** before applying. The API does this automatically.
3. **Keep at least one backup signer key offline** in a secure location.
4. **Test the configuration on Testnet** before applying to Mainnet.
5. **Document all signer identities** and their associated public keys in a secure, access-controlled registry.
