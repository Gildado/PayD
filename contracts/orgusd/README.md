# ORGUSD Custom Stable Asset Contract (`orgusd`)

The **ORGUSD Contract** manages the issuance, authorization, regulatory compliance (freeze/clawback), and SEP-0001 / SEP-0034 metadata for PayD's native USD stable asset on Stellar / Soroban.

---

## Purpose

ORGUSD acts as the digital USD stablecoin asset for organization payroll, settlement, and escrow contracts in PayD. It mirrors Stellar's native asset trustline flags (`auth_required`, `auth_revocable`, `clawback_enabled`) directly at the Soroban smart contract layer:
- **Admin-Gated Minting**: Only the authorized organization administrator can mint new supply.
- **KYC Authorization**: Account holders must be authorized before receiving tokens.
- **Regulatory Freeze**: Suspends transfers for specific addresses under regulatory hold.
- **Clawback**: Enables administrative recovery of funds in dispute or regulatory compliance scenarios.
- **SEP-0001 Metadata**: Synchronizes on-chain asset properties with `.well-known/stellar.toml`.

---

## Interface

### Public Functions

| Function | Parameters | Return Type | Access Control | Description |
|---|---|---|---|---|
| `initialize` | `env: Env, admin: Address` | `Result<(), OrgUsdError>` | Admin Auth (Once) | Initializes contract administrator and zero total supply. |
| `name` | `env: Env` | `String` | Public | Returns asset name (`ORGUSD`). |
| `version` | `env: Env` | `String` | Public | Returns contract version string (SEP-0034). |
| `author` | `env: Env` | `String` | Public | Returns package author metadata. |
| `sep1_metadata` | `env: Env` | `Sep1AssetMetadata` | Public | Returns SEP-0001 asset metadata matching `stellar.toml`. |
| `verify_sep1_metadata` | `env: Env, code: String, issuer: String, home_domain: String, display_decimals: u32, anchor_asset: String` | `bool` | Public | Verifies externally supplied metadata against on-chain expected values. |
| `total_supply` | `env: Env` | `Result<i128, OrgUsdError>` | Public | Returns current total minted supply of ORGUSD. |
| `balance` | `env: Env, account: Address` | `Result<i128, OrgUsdError>` | Public | Returns token balance of `account`. |
| `is_authorized` | `env: Env, account: Address` | `Result<bool, OrgUsdError>` | Public | Returns `true` if `account` is authorized to hold ORGUSD. |
| `is_frozen` | `env: Env, account: Address` | `Result<bool, OrgUsdError>` | Public | Returns `true` if `account` is currently frozen. |
| `authorize` | `env: Env, account: Address` | `Result<(), OrgUsdError>` | Admin Auth | Authorizes `account` to hold ORGUSD. |
| `revoke` | `env: Env, account: Address` | `Result<(), OrgUsdError>` | Admin Auth | Revokes `account`'s authorization. |
| `freeze` | `env: Env, account: Address` | `Result<(), OrgUsdError>` | Admin Auth | Freezes `account`, halting all incoming/outgoing transfers. |
| `unfreeze` | `env: Env, account: Address` | `Result<(), OrgUsdError>` | Admin Auth | Restores full transfer capabilities for `account`. |
| `mint` | `env: Env, to: Address, amount: i128` | `Result<(), OrgUsdError>` | Admin Auth | Mints new ORGUSD tokens into authorized account `to`. |
| `transfer` | `env: Env, from: Address, to: Address, amount: i128` | `Result<(), OrgUsdError>` | Sender Auth | Transfers tokens between two active, authorized accounts. |
| `burn` | `env: Env, from: Address, amount: i128` | `Result<(), OrgUsdError>` | Sender Auth | Caller burns their own tokens, reducing total supply. |
| `clawback` | `env: Env, from: Address, amount: i128` | `Result<(), OrgUsdError>` | Admin Auth | Admin forcibly reclaims tokens from `from`, reducing total supply. |

---

## Storage Layout

State is stored in Soroban `Instance` and `Persistent` storage.

| Key | Storage Domain | Value Type | Description / Key Pattern |
|---|---|---|---|
| `DataKey::Admin` | Instance | `Address` | Contract administrator address. |
| `DataKey::TotalSupply` | Instance | `i128` | Total outstanding ORGUSD token supply. |
| `DataKey::Balance(Address)` | Persistent | `i128` | Per-account token balance. |
| `DataKey::Authorized(Address)` | Persistent | `bool` | Account authorization flag. |
| `DataKey::Frozen(Address)` | Persistent | `bool` | Account regulatory freeze flag. |

---

## Security Considerations

1. **Minting & Supply Control**:
   - Only `Admin` can call `mint` or `clawback`.
   - Minting requires destination `to` to be `is_authorized = true` and `is_frozen = false`.
2. **Self-Transfer Guards**:
   - `transfer` rejects `from == to` early to conserve gas and prevent empty event pollution.
3. **Double-Spend & Compliance Checks**:
   - Every `transfer` validates that both `from` and `to` are authorized and unfrozen.
4. **Overflow Protection**:
   - All balance arithmetic (`checked_add`, `checked_sub`) guards against `i128` integer overflow/underflow.

---

## Usage Examples

### Authorizing an Account & Minting ORGUSD (`Soroban CLI`)

```bash
# Step 1: Admin authorizes recipient
soroban contract invoke \
  --id <ORGUSD_CONTRACT_ID> \
  --source ADMIN_SECRET_KEY \
  -- \
  authorize \
  --account <EMPLOYEE_ADDRESS>

# Step 2: Admin mints 1,000 ORGUSD (100000 with 2 decimals)
soroban contract invoke \
  --id <ORGUSD_CONTRACT_ID> \
  --source ADMIN_SECRET_KEY \
  -- \
  mint \
  --to <EMPLOYEE_ADDRESS> \
  --amount 100000
```

---

## Cross-References

- **`bulk_payment`**: Uses ORGUSD for batch payroll payments.
- **`vesting_escrow`**: Escrows ORGUSD for employee equity/token vesting schedules.
- **`revenue_split`**: Distributes ORGUSD revenue among stakeholders.
