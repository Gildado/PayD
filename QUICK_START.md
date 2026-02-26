# Contract Registry API - Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Configure Your Contracts

Edit `environments.toml` and add your contract addresses:

```toml
[staging.contracts]
bulk_payment = { id = "CABC123456789012345678901234567890123456789012345678901234", version = "1.0.0", deployed_at = 12345 }
vesting_escrow = { id = "CDEF123456789012345678901234567890123456789012345678901234", version = "1.0.0", deployed_at = 12346 }
revenue_split = { id = "CGHI123456789012345678901234567890123456789012345678901234", version = "1.0.0", deployed_at = 12347 }
cross_asset_payment = { id = "CJKL123456789012345678901234567890123456789012345678901234", version = "1.0.0", deployed_at = 12348 }

[production.contracts]
bulk_payment = { id = "CXYZ123456789012345678901234567890123456789012345678901234", version = "1.0.0", deployed_at = 54321 }
# ... add mainnet contracts
```

### 2. Start the Backend

```bash
cd backend
npm install  # if not already done
npm run dev
```

### 3. Test the Endpoint

```bash
# Option 1: Use curl
curl http://localhost:3000/api/contracts | jq

# Option 2: Use the test script
./test-contract-endpoint.sh
```

## 📖 Usage Examples

### In a React Component

```typescript
import { useEffect, useState } from 'react';
import { contractService } from './services/contracts';

function MyComponent() {
  const [contractId, setContractId] = useState<string | null>(null);

  useEffect(() => {
    // Get contract ID for bulk_payment on testnet
    const id = contractService.getContractId('bulk_payment', 'testnet');
    setContractId(id);
  }, []);

  return <div>Contract: {contractId}</div>;
}
```

### Get All Contracts

```typescript
const registry = contractService.getAllContracts();
console.log(`Found ${registry?.count} contracts`);
```

### Manually Refresh

```typescript
await contractService.refreshRegistry();
```

## 🔧 Adding a New Contract

1. Add to `environments.toml`:

```toml
[staging.contracts]
my_new_contract = { id = "CNEW...", version = "1.0.0", deployed_at = 99999 }
```

2. Use in frontend:

```typescript
const contractId = contractService.getContractId("my_new_contract", "testnet");
```

That's it! No code changes needed.

## 📚 More Information

- **Full API Docs**: `docs/CONTRACT_REGISTRY_API.md`
- **Implementation Details**: `CONTRACT_REGISTRY_IMPLEMENTATION.md`
- **Usage Examples**: `frontend/src/services/contracts.example.tsx`
- **Summary**: `IMPLEMENTATION_SUMMARY.md`

## ✅ Verify It's Working

1. Backend server running: `curl http://localhost:3000/health`
2. Contracts endpoint: `curl http://localhost:3000/api/contracts`
3. Frontend console: Should see "Contract registry fetched successfully"

## 🐛 Troubleshooting

**No contracts returned?**

- Check `environments.toml` is in project root
- Verify contract IDs start with 'C' and are 57 characters long
- Check backend logs for parsing errors

**Frontend not fetching?**

- Verify `VITE_API_BASE_URL` environment variable
- Check browser console for errors
- Ensure backend is running

**Cache not refreshing?**

- Cache TTL is 1 hour
- Manually refresh: `contractService.refreshRegistry()`
- Restart frontend to clear cache
