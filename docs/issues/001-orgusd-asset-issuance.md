# #001: ORGUSD Custom Asset on Stellar Testnet

## Overview

ORGUSD is PayD's organization-specific stablecoin issued on the Stellar network. It is used for payroll disbursements, cross-border payments, and revenue distribution across the platform.

## Account Architecture

### Issuer Account

The **Issuer** account is the source of truth for the ORGUSD asset. Any ORGUSD token in existence was originally minted from this account.

- Creates and defines the ORGUSD asset
- Sets authorization flags (`auth_required`, `auth_revocable`)
- Authorizes trustlines from distribution and employee accounts
- Can clawback tokens when needed (via `auth_revocable`)
- Should **never** hold ORGUSD itself

### Distribution Account

The **Distribution** account receives the initial token supply and acts as the operational wallet for sending ORGUSD to employees and other recipients.

- Holds the circulating supply of ORGUSD
- Sends tokens to employee wallets during payroll runs
- Establishes a trustline to the Issuer for ORGUSD
- Can be replaced or rotated without affecting the asset definition

## Authorization Flags

| Flag | Value | Purpose |
|------|-------|---------|
| `auth_required` | `0x1` | All accounts must be explicitly authorized by the Issuer before they can hold ORGUSD. Prevents unauthorized holding. |
| `auth_revocable` | `0x2` | The Issuer can revoke authorization and clawback tokens from any account. Required for compliance and clawback operations. |

These flags are set on the Issuer account via `Operation.setOptions({ setFlags })` before any trustlines or payments are created.

## Trustline Flow

```
1. Distribution account calls changeTrust(ORGUSD) → trustline created (unauthorized)
2. Issuer calls setTrustLineFlags(authorized: true) → trustline authorized
3. Issuer sends payment(ORGUSD) to Distribution → tokens minted
```

The same flow applies for employee accounts:

```
1. Employee wallet calls changeTrust(ORGUSD) → trustline created (unauthorized)
2. Issuer calls setTrustLineFlags(authorized: true) → employee authorized
3. Distribution sends payment(ORGUSD) to Employee → tokens transferred
```

## Keypair Management Strategy

### Testnet (Current)

On testnet, keypairs are generated fresh each time the issuance script runs. The output is stored in `.keys/orgusd-testnet-keypairs.json` which is gitignored.

- **Storage**: Local JSON file with public and secret keys
- **Funding**: Accounts are funded via Stellar Friendbot
- **Rotation**: Generate new keypairs by re-running the script
- **Access**: Any developer with repo access can run the script

### Production (Future)

For mainnet deployment, the following strategy should be adopted:

| Concern | Approach |
|---------|----------|
| **Secret storage** | Use a hardware security module (HSM) or cloud KMS (e.g., AWS KMS, HashiCorp Vault). Never store production secret keys in plaintext files or environment variables. |
| **Issuer key access** | Restrict to a multi-signature scheme (2-of-3 or 3-of-5). The Issuer key should be cold-stored and only used for authorization and flag changes. |
| **Distribution key access** | Can be a hot wallet with operational access, but should still use multi-sig for large transfers. Rate-limit outgoing payments. |
| **Key rotation** | The Distribution account can be rotated by creating a new account, establishing a trustline, authorizing it, transferring the balance, and deauthorizing the old account. The Issuer account cannot be rotated without re-issuing the entire asset. |
| **Backup** | Maintain encrypted backups of all keypairs in geographically separate locations. Use Shamir's Secret Sharing for the Issuer key. |
| **Audit trail** | Log all key usage (authorization, payments, clawbacks) to the `clawback_audit_logs` and `payroll_audit_logs` tables. |

### Environment Variables

After running the issuance script, configure the backend with the generated keys:

```env
# Add to backend/.env after running the issuance script
ORGUSD_ISSUER_PUBLIC=G...
ORGUSD_ISSUER_SECRET=S...
ORGUSD_DISTRIBUTION_PUBLIC=G...
ORGUSD_DISTRIBUTION_SECRET=S...
```

## Running the Issuance Script

```bash
# From the project root
npx tsx backend/scripts/issue-orgusd.ts

# With a custom issuance amount
ORGUSD_ISSUE_AMOUNT=5000000 npx tsx backend/scripts/issue-orgusd.ts
```

The script will:

1. Generate new Issuer and Distribution keypairs
2. Fund both accounts via Friendbot (10,000 XLM each)
3. Set `auth_required` and `auth_revocable` flags on the Issuer
4. Create a trustline from Distribution to the ORGUSD asset
5. Authorize the Distribution trustline
6. Issue the specified amount of ORGUSD to the Distribution account
7. Save keypair data to `.keys/orgusd-testnet-keypairs.json`

## Verifying the Asset

After issuance, verify on Stellar Expert:

```
https://stellar.expert/explorer/testnet/asset/ORGUSD-<ISSUER_PUBLIC_KEY>
```

Or via the Horizon API:

```bash
curl "https://horizon-testnet.stellar.org/accounts/<DISTRIBUTION_PUBLIC_KEY>"
```

Look for the ORGUSD balance in the `balances` array.
