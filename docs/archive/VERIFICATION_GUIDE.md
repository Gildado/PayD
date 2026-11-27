# Contract Address Registry API - Verification Guide

## Quick Verification Steps

### 1. Verify Backend Implementation

Check that all required files exist:

```bash
# Backend files
ls -la backend/src/controllers/contractController.ts
ls -la backend/src/services/contractConfigService.ts
ls -la backend/src/utils/contractValidator.ts
ls -la backend/src/routes/contractRoutes.ts

# Frontend files
ls -la frontend/src/services/contracts.ts
ls -la frontend/src/services/contracts.types.ts

# Configuration
ls -la environments.toml
```

### 2. Test the API Endpoint

Start the backend server:

```bash
cd backend
npm run dev
```

In another terminal, test the endpoint:

```bash
# Basic test
curl http://localhost:4000/api/contracts

# Pretty print with jq
curl http://localhost:4000/api/contracts | jq '.'

# Check headers
curl -I http://localhost:4000/api/contracts
```

Expected response structure:

```json
{
  "contracts": [
    {
      "contractId": "CABC123456789012345678901234567890123456789012345678901234",
      "network": "testnet",
      "contractType": "bulk_payment",
      "version": "1.0.0",
      "deployedAt": 12345
    }
  ],
  "timestamp": "2026-03-23T...",
  "count": 8
}
```

Expected headers:

- `Content-Type: application/json`
- `Cache-Control: public, max-age=3600`

### 3. Verify Configuration Sources

The API should read from `environments.toml` by default. You can verify this by:

1. Check the server logs when starting - should show: "Loaded X contracts from TOML configuration"
2. Modify a contract ID in `environments.toml` and restart the server
3. Verify the API returns the updated contract ID

### 4. Test Environment Variable Fallback

To test the fallback mechanism:

```bash
# Temporarily rename environments.toml
mv environments.toml environments.toml.backup

# Set environment variables
export BULK_PAYMENT_TESTNET_CONTRACT_ID=CTEST123456789012345678901234567890123456789012345678901234
export BULK_PAYMENT_TESTNET_VERSION=2.0.0
export BULK_PAYMENT_TESTNET_DEPLOYED_AT=99999

# Start server
cd backend
npm run dev

# Test endpoint - should return contract from env vars
curl http://localhost:4000/api/contracts | jq '.contracts[] | select(.contractType=="bulk_payment")'

# Restore environments.toml
mv environments.toml.backup environments.toml
```

### 5. Frontend Service Verification

Create a test file to verify the frontend service:

```typescript
// test-contract-service.ts
import { contractService } from "./frontend/src/services/contracts";

async function test() {
  try {
    // Initialize the service
    console.log("Initializing contract service...");
    await contractService.initialize();

    // Get a specific contract
    const bulkPaymentId = contractService.getContractId(
      "bulk_payment",
      "testnet",
    );
    console.log("Bulk Payment (testnet):", bulkPaymentId);

    // Get all contracts
    const registry = contractService.getAllContracts();
    console.log("Total contracts:", registry?.count);
    console.log("All contracts:", registry?.contracts);

    // Test cache
    console.log("Cache valid:", contractService.isCacheValid());
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
```

### 6. Verify Dynamic Contract Addition

Test that new contracts can be added without code changes:

1. Add a new contract to `environments.toml`:

   ```toml
   [staging.contracts]
   test_contract = { id = "CTEST123456789012345678901234567890123456789012345678901234", version = "1.0.0", deployed_at = 11111 }
   ```

2. Restart the backend server

3. Verify the new contract appears in the API response:

   ```bash
   curl http://localhost:4000/api/contracts | jq '.contracts[] | select(.contractType=="test_contract")'
   ```

4. No code changes should be needed!

## Acceptance Criteria Verification

| Criteria                                                               | Status | Verification Method                        |
| ---------------------------------------------------------------------- | ------ | ------------------------------------------ |
| Endpoint returns structured JSON with contractId, network, and version | ✅     | `curl http://localhost:4000/api/contracts` |
| Values sourced from environments.toml or env vars                      | ✅     | Check server logs, test both sources       |
| Frontend service fetches and caches registry                           | ✅     | Test frontend service initialization       |
| Adding new contract requires only config change                        | ✅     | Add contract to TOML, verify in response   |
| Response includes deployedAt ledger sequence                           | ✅     | Check API response structure               |

## Known Issues

- Unit tests need mock fixes (tests exist but mocking needs adjustment)
- Property-based tests are optional and not yet implemented
- Frontend integration into main app startup is not yet wired up

## Next Steps

1. **Fix Unit Tests**: Update mocks in `contractController.test.ts`
2. **Wire Frontend**: Add `contractService.initialize()` to app startup
3. **Optional**: Implement property-based tests with fast-check
4. **Optional**: Add integration tests

## Files Modified/Created

All files were created in previous commits on main branch:

- `backend/src/controllers/contractController.ts`
- `backend/src/services/contractConfigService.ts`
- `backend/src/utils/contractValidator.ts`
- `backend/src/routes/contractRoutes.ts`
- `frontend/src/services/contracts.ts`
- `frontend/src/services/contracts.types.ts`
- `docs/CONTRACT_REGISTRY_API.md`

## Documentation

- API Documentation: `docs/CONTRACT_REGISTRY_API.md`
- Issue: `docs/issues/078-contract-address-registry-api.md`
- Requirements: `docs/specs/contract-address-registry-api/requirements.md`
- Design: `docs/specs/contract-address-registry-api/design.md`
- Tasks: `docs/specs/contract-address-registry-api/tasks.md`
