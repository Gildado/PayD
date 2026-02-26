# Contract Address Registry API

## Overview

The Contract Address Registry API provides a centralized endpoint for retrieving deployed Soroban smart contract addresses across different networks (testnet/mainnet). This feature decouples contract deployment information from the frontend build process, enabling hot-swappable contract deployments without requiring frontend rebuilds.

## API Endpoint

### GET /api/contracts

Returns all deployed contract addresses with metadata.

**Response Format:**

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
  "timestamp": "2026-02-25T14:30:00.000Z",
  "count": 4
}
```

**Headers:**

- `Content-Type: application/json`
- `Cache-Control: public, max-age=3600` (1 hour cache)

## Configuration

### Option 1: environments.toml (Recommended)

Add contracts to the `staging.contracts` section for testnet and `production.contracts` section for mainnet:

```toml
[staging.contracts]
bulk_payment = { id = "CABC...", version = "1.0.0", deployed_at = 12345 }
vesting_escrow = { id = "CDEF...", version = "1.0.0", deployed_at = 12346 }

[production.contracts]
bulk_payment = { id = "CXYZ...", version = "1.0.0", deployed_at = 54321 }
```

### Option 2: Environment Variables

Set environment variables following this pattern:

```bash
# Pattern: {CONTRACT_TYPE}_{NETWORK}_CONTRACT_ID
BULK_PAYMENT_TESTNET_CONTRACT_ID=CABC...
BULK_PAYMENT_TESTNET_VERSION=1.0.0
BULK_PAYMENT_TESTNET_DEPLOYED_AT=12345

BULK_PAYMENT_MAINNET_CONTRACT_ID=CXYZ...
BULK_PAYMENT_MAINNET_VERSION=1.0.0
BULK_PAYMENT_MAINNET_DEPLOYED_AT=54321
```

## Frontend Usage

### Initialize the Service

```typescript
import { contractService } from "./services/contracts";

// Initialize on app startup
await contractService.initialize();
```

### Get Contract IDs

```typescript
// Get a specific contract ID
const contractId = contractService.getContractId("bulk_payment", "testnet");

// Get all contracts
const registry = contractService.getAllContracts();

// Manually refresh the cache
await contractService.refreshRegistry();
```

### Migration from Hardcoded Addresses

Replace hardcoded contract addresses with dynamic fetching:

**Before:**

```typescript
const BULK_PAYMENT_CONTRACT = "CABC...";
```

**After:**

```typescript
const contractId = contractService.getContractId("bulk_payment", "testnet");
```

## Features

- **Configuration-Driven**: Add new contracts by updating config files, no code changes needed
- **Automatic Caching**: Frontend caches contract data for 1 hour to minimize API calls
- **Retry Logic**: Automatic retry with exponential backoff (3 attempts: 1s, 2s, 4s delays)
- **Hot-Swappable**: Update contract deployments without frontend rebuilds
- **Type-Safe**: Full TypeScript support with type definitions
- **Error Handling**: Comprehensive error handling and logging

## Supported Contracts

- `bulk_payment`
- `vesting_escrow`
- `revenue_split`
- `cross_asset_payment`

## Adding New Contracts

1. Add the contract to `environments.toml`:

   ```toml
   [staging.contracts]
   my_new_contract = { id = "CNEW...", version = "1.0.0", deployed_at = 99999 }
   ```

2. That's it! The API will automatically include the new contract in responses.

3. Update the TypeScript types if needed:
   ```typescript
   // frontend/src/services/contracts.types.ts
   export type ContractType =
     | "bulk_payment"
     | "vesting_escrow"
     | "revenue_split"
     | "cross_asset_payment"
     | "my_new_contract"; // Add here
   ```

## Testing

Start the backend server and test the endpoint:

```bash
# Start backend
cd backend
npm run dev

# Test the endpoint
curl http://localhost:3000/api/contracts
```

## Architecture

```
Configuration (TOML/Env Vars)
    ↓
ContractConfigService (parses config)
    ↓
ContractValidator (validates entries)
    ↓
ContractController (formats response)
    ↓
Express Router (/api/contracts)
    ↓
Frontend ContractService (fetches & caches)
    ↓
React Components (access contract IDs)
```

## Performance

- Backend response time: < 500ms
- Frontend cache TTL: 1 hour
- Auto-refresh on cache expiration
- No network requests for cached data

## Error Handling

- Missing configuration: Falls back to environment variables
- Invalid contract IDs: Filtered from response with warning logs
- Network errors: Automatic retry with exponential backoff
- Cache expiration: Automatic refresh on next access
