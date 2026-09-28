# Revenue Split Contract

## Overview
Distributes incoming token amounts across multiple recipients based on configurable basis-point shares (1 basis point = 0.01%).

## Mainnet Readiness Audit (Issues #1606-#1611)

### Version Metadata (#1606)
- **Status**: ✅ Implemented
- **Implementation**: `version()` function returns `(1, 0, 0)`
- **Test Coverage**: `test_version_metadata()`

### Configurable Max Batch Size (#1607)
- **Status**: N/A
- **Rationale**: This contract processes single distributions, not batches

### Error Message Review (#1611)
- **Status**: ✅ Verified Safe
- **Findings**: All panic and `.expect()` messages reviewed
- **Assessment**: No information leakage:
  - ✅ `"Already initialized"` - Safe
  - ✅ `"Shares must sum to 10000 basis points"` - Safe validation message
  - ✅ `"Admin entry unavailable; restore and retry"` - Safe archival guidance
  - ✅ `"Recipients entry unavailable; restore and retry"` - Safe archival guidance

### Authorization Coverage Audit (#1610)
- **Status**: ✅ Complete
- **Findings**: All fund-moving and state-changing functions properly protected

| Function | Authorization | Status |
|----------|--------------|--------|
| `init` | None (first-time only) | ✅ Safe - checked via `AlreadyInitialized` |
| `set_admin` | `admin.require_auth()` | ✅ Protected |
| `update_recipients` | `admin.require_auth()` | ✅ Protected |
| `bump_ttl` | `admin.require_auth()` | ✅ Protected |
| `distribute` | `from.require_auth()` | ✅ Protected - sender must authorize distribution |

**Critical Security Properties**:
- Share configuration immutable except by admin
- All shares must sum to exactly 10,000 basis points (100%)
- Remainder from rounding always goes to the **last** recipient (tested in `test_distribution_rounding_remainder_absorbed_by_last_recipient`)
- No fund leakage: sum of distributed amounts always equals input amount exactly

## Testing
Run all tests:
```bash
cargo test
```
