# Vesting Escrow Contract

## Overview
Time-locked token vesting contract with cliff periods, linear vesting, and clawback capability for unvested tokens.

## Mainnet Readiness Audit (Issues #1606-#1611)

### Version Metadata (#1606)
- **Status**: ✅ Implemented
- **Implementation**: `version()` function returns `(1, 0, 0)`
- **Test Coverage**: `test_version_metadata()`

### Configurable Max Batch Size (#1607)
- **Status**: N/A
- **Rationale**: This contract does not process batches

### Error Message Review (#1611)
- **Status**: ✅ Verified Safe
- **Findings**: All panic and `.expect()` messages reviewed
- **Assessment**: No information leakage. Messages are minimal and descriptive:
  - ✅ `"Already initialized"` - Safe
  - ✅ `"Duration must be greater than or equal to cliff"` - Safe validation message
  - ✅ `"Amount must be positive"` - Safe validation message
  - ✅ `"Already revoked/inactive"` - Safe state check
  - ✅ `"Config entry unavailable; restore and retry"` - Safe archival guidance

### Authorization Coverage Audit (#1610)
- **Status**: ✅ Complete
- **Findings**: All fund-moving and state-changing functions properly protected

| Function | Authorization | Status |
|----------|--------------|--------|
| `initialize` | `funder.require_auth()` | ✅ Protected - funder must authorize token transfer |
| `claim` | `beneficiary.require_auth()` | ✅ Protected - only beneficiary can claim |
| `clawback` | `clawback_admin.require_auth()` | ✅ Protected - only admin can claw back |
| `bump_ttl` | `clawback_admin.require_auth()` | ✅ Protected |
| `get_*` (read-only) | None | ✅ Safe - read-only operations |

**Security Properties**:
- Vested amounts are immutable and calculated trustlessly based on ledger timestamp
- Clawback can only return **unvested** tokens to admin
- Beneficiary can only claim what has vested
- No fund bypass paths

## Testing
Run all tests:
```bash
cargo test
```
