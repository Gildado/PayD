# Contract Registry API - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐         ┌─────────────────────────────────┐  │
│  │   App.tsx    │────────▶│  contractService.initialize()   │  │
│  │  (Startup)   │         │  - Fetches on mount             │  │
│  └──────────────┘         │  - Caches for 1 hour            │  │
│                            │  - Retry with backoff           │  │
│                            └─────────────┬───────────────────┘  │
│                                          │                       │
│  ┌──────────────────────────────────────▼───────────────────┐  │
│  │         contracts.ts (Service)                            │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  Cache (1 hour TTL)                                 │ │  │
│  │  │  - contracts: ContractEntry[]                       │ │  │
│  │  │  - timestamp: string                                │ │  │
│  │  │  - lastFetch: number                                │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  Methods:                                                  │  │
│  │  - getContractId(type, network) → string                  │  │
│  │  - getAllContracts() → ContractRegistry                   │  │
│  │  - refreshRegistry() → Promise<void>                      │  │
│  └────────────────────────────┬───────────────────────────────┘  │
│                                │                                  │
└────────────────────────────────┼──────────────────────────────────┘
                                 │
                                 │ HTTP GET /api/contracts
                                 │
┌────────────────────────────────▼──────────────────────────────────┐
│                        Backend (Express)                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  app.ts                                                       │ │
│  │  app.use('/api', contractRoutes)                             │ │
│  └────────────────────────────┬─────────────────────────────────┘ │
│                                │                                   │
│  ┌────────────────────────────▼─────────────────────────────────┐ │
│  │  contractRoutes.ts                                            │ │
│  │  router.get('/contracts', ContractController.getContracts)   │ │
│  └────────────────────────────┬─────────────────────────────────┘ │
│                                │                                   │
│  ┌────────────────────────────▼─────────────────────────────────┐ │
│  │  contractController.ts                                        │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │ 1. Fetch entries from ConfigService                  │   │ │
│  │  │ 2. Validate each entry                               │   │ │
│  │  │ 3. Filter invalid entries                            │   │ │
│  │  │ 4. Format response                                   │   │ │
│  │  │ 5. Set headers (Cache-Control, Content-Type)        │   │ │
│  │  │ 6. Return JSON                                       │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────┬─────────────────────────────────┘ │
│                                │                                   │
│  ┌────────────────────────────▼─────────────────────────────────┐ │
│  │  contractConfigService.ts                                     │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │ getContractEntries()                                 │   │ │
│  │  │   ├─▶ parseTomlConfig()                              │   │ │
│  │  │   │    └─▶ Read environments.toml                    │   │ │
│  │  │   │         ├─▶ [staging.contracts] → testnet        │   │ │
│  │  │   │         └─▶ [production.contracts] → mainnet     │   │ │
│  │  │   │                                                   │   │ │
│  │  │   └─▶ parseEnvVarConfig() (fallback)                 │   │ │
│  │  │        └─▶ Read process.env                          │   │ │
│  │  │             └─▶ {TYPE}_{NETWORK}_CONTRACT_ID         │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────┬─────────────────────────────────┘ │
│                                │                                   │
│  ┌────────────────────────────▼─────────────────────────────────┐ │
│  │  contractValidator.ts                                         │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │ validateContractEntry()                              │   │ │
│  │  │   ├─▶ validateContractId() → /^C[A-Z0-9]{56}$/      │   │ │
│  │  │   ├─▶ validateNetwork() → testnet|mainnet           │   │ │
│  │  │   ├─▶ validateDeployedAt() → integer > 0            │   │ │
│  │  │   └─▶ validateVersion() → semver format             │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ Reads from
                                 │
┌────────────────────────────────▼──────────────────────────────────┐
│                      Configuration Sources                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  environments.toml (Primary)                                  │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │ [staging.contracts]                                  │   │ │
│  │  │ bulk_payment = {                                     │   │ │
│  │  │   id = "CABC...",                                    │   │ │
│  │  │   version = "1.0.0",                                 │   │ │
│  │  │   deployed_at = 12345                                │   │ │
│  │  │ }                                                     │   │ │
│  │  │                                                       │   │ │
│  │  │ [production.contracts]                               │   │ │
│  │  │ bulk_payment = {                                     │   │ │
│  │  │   id = "CXYZ...",                                    │   │ │
│  │  │   version = "1.0.0",                                 │   │ │
│  │  │   deployed_at = 54321                                │   │ │
│  │  │ }                                                     │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Environment Variables (Fallback)                             │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │ BULK_PAYMENT_TESTNET_CONTRACT_ID=CABC...            │   │ │
│  │  │ BULK_PAYMENT_TESTNET_VERSION=1.0.0                  │   │ │
│  │  │ BULK_PAYMENT_TESTNET_DEPLOYED_AT=12345              │   │ │
│  │  │                                                       │   │ │
│  │  │ BULK_PAYMENT_MAINNET_CONTRACT_ID=CXYZ...            │   │ │
│  │  │ BULK_PAYMENT_MAINNET_VERSION=1.0.0                  │   │ │
│  │  │ BULK_PAYMENT_MAINNET_DEPLOYED_AT=54321              │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Startup Flow

```
Frontend App Loads
       │
       ├─▶ useEffect() hook triggers
       │
       ├─▶ contractService.initialize()
       │
       ├─▶ HTTP GET /api/contracts
       │
       ├─▶ Backend reads environments.toml
       │
       ├─▶ Validates contract entries
       │
       ├─▶ Returns JSON response
       │
       ├─▶ Frontend caches response (1 hour)
       │
       └─▶ Ready for use
```

### 2. Contract Lookup Flow

```
Component needs contract ID
       │
       ├─▶ contractService.getContractId('bulk_payment', 'testnet')
       │
       ├─▶ Check cache validity
       │   ├─▶ Valid: Return from cache
       │   └─▶ Stale: Refresh in background
       │
       └─▶ Return contract ID or null
```

### 3. Configuration Update Flow

```
Update environments.toml
       │
       ├─▶ No code changes needed
       │
       ├─▶ No frontend rebuild needed
       │
       ├─▶ Backend reads new config on next request
       │
       ├─▶ Frontend cache expires after 1 hour
       │
       └─▶ New contracts available
```

## Response Format

```json
{
  "contracts": [
    {
      "contractId": "CABC123456789012345678901234567890123456789012345678901234",
      "network": "testnet",
      "contractType": "bulk_payment",
      "version": "1.0.0",
      "deployedAt": 12345
    },
    {
      "contractId": "CDEF123456789012345678901234567890123456789012345678901234",
      "network": "testnet",
      "contractType": "vesting_escrow",
      "version": "1.0.0",
      "deployedAt": 12346
    }
  ],
  "timestamp": "2026-02-26T14:30:00.000Z",
  "count": 2
}
```

## Caching Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Cache                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Time 0:00  ─▶ Fetch from API ─▶ Cache for 1 hour          │
│  Time 0:30  ─▶ Read from cache (valid)                      │
│  Time 1:00  ─▶ Cache expired                                │
│  Time 1:01  ─▶ Fetch from API ─▶ Cache for 1 hour          │
│                                                              │
│  Manual refresh: contractService.refreshRegistry()          │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Backend Cache                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  HTTP Header: Cache-Control: public, max-age=3600           │
│  - Browsers can cache for 1 hour                            │
│  - CDNs can cache for 1 hour                                │
│  - Reduces backend load                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Scenarios                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Backend Unavailable                                      │
│     ├─▶ Retry 3 times with exponential backoff              │
│     ├─▶ 1s, 2s, 4s delays                                   │
│     └─▶ Log error, return null                              │
│                                                              │
│  2. Invalid Contract ID                                      │
│     ├─▶ Validator catches format error                      │
│     ├─▶ Entry filtered out                                  │
│     └─▶ Warning logged                                      │
│                                                              │
│  3. Missing Configuration                                    │
│     ├─▶ Returns empty array                                 │
│     ├─▶ Warning logged                                      │
│     └─▶ Frontend handles gracefully                         │
│                                                              │
│  4. Network Error                                            │
│     ├─▶ Retry logic kicks in                                │
│     ├─▶ Use stale cache if available                        │
│     └─▶ Log error to console                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Security Considerations

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Measures                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✓ Input Validation                                          │
│    - Contract IDs validated against Stellar format           │
│    - Network types restricted to testnet/mainnet            │
│    - Ledger sequences must be positive integers             │
│                                                              │
│  ✓ No Sensitive Data                                         │
│    - Contract addresses are public information              │
│    - No authentication required                             │
│    - Safe to cache publicly                                 │
│                                                              │
│  ✓ Rate Limiting                                             │
│    - Frontend caching reduces requests                      │
│    - Backend can add rate limiting if needed                │
│                                                              │
│  ✓ Error Messages                                            │
│    - Generic error messages to clients                      │
│    - Detailed errors logged server-side                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```
