# Transaction Throttling Migration Guide

This guide helps you migrate existing code to use the new transaction throttling mechanism.

## Quick Start

### Option 1: Use StellarServiceWithThrottling (Recommended)

Replace your existing `StellarService` imports with `StellarServiceWithThrottling`:

**Before:**

```typescript
import { StellarService } from './services/stellarService';

const transaction = await StellarService.createPaymentTransaction(/* ... */);
StellarService.signTransaction(transaction, keypair);
const result = await StellarService.submitTransaction(transaction);
```

**After:**

```typescript
import { StellarServiceWithThrottling } from './services/stellarServiceWithThrottling';

const transaction = await StellarServiceWithThrottling.createPaymentTransaction(/* ... */);
StellarServiceWithThrottling.signTransaction(transaction, keypair);
const result = await StellarServiceWithThrottling.submitTransactionThrottled(transaction);
```

### Option 2: Use StellarThrottlingService Directly

For more control over throttling options:

```typescript
import { StellarThrottlingService } from './services/stellarThrottlingService';
import { StellarService } from './services/stellarService';

const throttlingService = StellarThrottlingService.getInstance();

const transaction = await StellarService.createPaymentTransaction(/* ... */);
StellarService.signTransaction(transaction, keypair);

const result = await throttlingService.submitTransaction(transaction, {
  priority: true,
  retryOnFailure: true,
  maxRetries: 3,
  metadata: { userId: '123' },
});
```

## Migration Examples

### Example 1: Simple Payment

**Before:**

```typescript
async function sendPayment(destination: string, amount: string) {
  const transaction = await StellarService.createPaymentTransaction(
    sourceKeypair,
    destination,
    amount
  );

  StellarService.signTransaction(transaction, sourceKeypair);
  return await StellarService.submitTransaction(transaction);
}
```

**After:**

```typescript
async function sendPayment(destination: string, amount: string) {
  const transaction = await StellarServiceWithThrottling.createPaymentTransaction(
    sourceKeypair,
    destination,
    amount
  );

  StellarServiceWithThrottling.signTransaction(transaction, sourceKeypair);
  return await StellarServiceWithThrottling.submitTransactionThrottled(transaction);
}
```

### Example 2: Bulk Payments with Priority

**Before:**

```typescript
async function processBulkPayments(payments: Payment[]) {
  const results = [];

  for (const payment of payments) {
    const transaction = await StellarService.createPaymentTransaction(
      sourceKeypair,
      payment.destination,
      payment.amount
    );

    StellarService.signTransaction(transaction, sourceKeypair);
    const result = await StellarService.submitTransaction(transaction);
    results.push(result);
  }

  return results;
}
```

**After:**

```typescript
async function processBulkPayments(payments: Payment[]) {
  const throttlingService = StellarThrottlingService.getInstance();
  const results = [];

  for (const payment of payments) {
    const transaction = await StellarService.createPaymentTransaction(
      sourceKeypair,
      payment.destination,
      payment.amount
    );

    StellarService.signTransaction(transaction, sourceKeypair);

    // Use throttling with retry logic
    const result = await throttlingService.submitTransaction(transaction, {
      priority: payment.isUrgent,
      retryOnFailure: true,
      maxRetries: 3,
      metadata: {
        paymentId: payment.id,
        userId: payment.userId,
      },
    });

    results.push(result);
  }

  return results;
}
```

### Example 3: Payroll Worker

**Before:**

```typescript
// In payrollWorker.ts
const result = await StellarService.submitTransaction(tx);
logger.info(`Chunk ${i + 1} submitted successfully. Tx Hash: ${result.hash}`);
```

**After:**

```typescript
// In payrollWorker.ts
import { StellarThrottlingService } from '../services/stellarThrottlingService';

const throttlingService = StellarThrottlingService.getInstance();

const result = await throttlingService.submitTransaction(tx, {
  priority: false, // Payroll can be queued
  retryOnFailure: true,
  maxRetries: 3,
  metadata: {
    chunkIndex: i,
    totalChunks: itemChunks.length,
    scheduleId: schedule.id,
  },
});

logger.info(`Chunk ${i + 1} submitted successfully. Tx Hash: ${result.hash}`);
```

### Example 4: Multi-Sig Operations

**Before:**

```typescript
async function setupMultiSig(config: MultiSigConfig) {
  const transaction = await StellarService.setupMultiSig(issuerKeypair, config);
  StellarService.signTransaction(transaction, issuerKeypair);
  return StellarService.submitTransaction(transaction);
}
```

**After:**

```typescript
async function setupMultiSig(config: MultiSigConfig) {
  const throttlingService = StellarThrottlingService.getInstance();

  const transaction = await StellarService.setupMultiSig(issuerKeypair, config);
  StellarService.signTransaction(transaction, issuerKeypair);

  // Multi-sig setup is critical, use priority
  return throttlingService.submitTransaction(transaction, {
    priority: true,
    retryOnFailure: true,
    maxRetries: 2,
  });
}
```

### Example 5: Asset Operations

**Before:**

```typescript
// In assetService.ts
try {
  await server.submitTransaction(transaction);
  console.log(`Successfully issued ${amount} ORGUSD`);
  return orgUsdAsset;
} catch (error) {
  console.error('Failed to issue asset:', error);
  throw error;
}
```

**After:**

```typescript
// In assetService.ts
import { StellarThrottlingService } from './stellarThrottlingService';

const throttlingService = StellarThrottlingService.getInstance();

try {
  const result = await throttlingService.submitTransaction(transaction, {
    priority: true, // Asset operations are critical
    retryOnFailure: true,
    maxRetries: 3,
    metadata: {
      operation: 'asset_issuance',
      assetCode: 'ORGUSD',
      amount,
    },
  });

  console.log(`Successfully issued ${amount} ORGUSD. Hash: ${result.hash}`);
  return orgUsdAsset;
} catch (error) {
  console.error('Failed to issue asset:', error);
  throw error;
}
```

## When to Use Throttling vs Direct Submission

### Use Throttling (Default)

- Regular payments
- Bulk operations
- Scheduled transactions
- Non-critical operations
- Any operation that can tolerate slight delays

### Use Direct Submission (Bypass Throttling)

- Emergency operations
- System-critical transactions
- Operations with strict timing requirements
- When you're certain you won't hit rate limits

**Example of bypassing throttling:**

```typescript
// Only use when absolutely necessary
const result = await StellarServiceWithThrottling.submitTransactionDirect(transaction);
```

## Monitoring Your Migration

### 1. Check Throttling Status

```typescript
const status = StellarServiceWithThrottling.getThrottlingStatus();
console.log(`Queue size: ${status.queueSize}/${status.maxQueueSize}`);
console.log(`Available tokens: ${status.currentTokens}/${status.maxTokens}`);
```

### 2. Monitor Metrics

```typescript
const metrics = StellarServiceWithThrottling.getThrottlingMetrics();
console.log(
  `Success rate: ${((metrics.totalSuccessful / metrics.totalSubmitted) * 100).toFixed(2)}%`
);
console.log(`Average wait time: ${metrics.averageWaitTime}ms`);
```

### 3. Listen to Events

```typescript
const throttlingService = StellarThrottlingService.getInstance();

throttlingService.on('stellar:transaction:queued', (data) => {
  logger.info(`Transaction queued: ${data.id}`);
});

throttlingService.on('stellar:transaction:success', (data) => {
  logger.info(`Transaction successful: ${data.hash} (waited ${data.waitTime}ms)`);
});

throttlingService.on('stellar:transaction:error', (data) => {
  logger.error(`Transaction failed: ${data.transactionId} - ${data.error}`);
});
```

## Testing Your Migration

### Unit Tests

Update your tests to mock the throttling service:

```typescript
import { StellarThrottlingService } from '../services/stellarThrottlingService';

jest.mock('../services/stellarThrottlingService');

describe('Payment Service', () => {
  beforeEach(() => {
    const mockThrottlingService = {
      submitTransaction: jest.fn().mockResolvedValue({
        hash: 'test-hash',
        ledger: 12345,
        success: true,
      }),
    };

    (StellarThrottlingService.getInstance as jest.Mock).mockReturnValue(mockThrottlingService);
  });

  // Your tests...
});
```

### Integration Tests

Test with actual throttling:

```typescript
describe('Throttled Payments Integration', () => {
  it('should handle burst of transactions', async () => {
    const throttlingService = StellarThrottlingService.getInstance();

    // Submit 10 transactions rapidly
    const promises = Array.from({ length: 10 }, (_, i) =>
      throttlingService.submitTransaction(mockTransaction, {
        metadata: { index: i },
      })
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    expect(results.every((r) => r.success)).toBe(true);
  });
});
```

## Rollback Plan

If you need to rollback:

1. **Revert imports:**

   ```typescript
   // Change back to
   import { StellarService } from './services/stellarService';
   ```

2. **Revert method calls:**

   ```typescript
   // Change back to
   await StellarService.submitTransaction(transaction);
   ```

3. **Remove throttling routes from app.ts:**
   ```typescript
   // Remove this line
   app.use('/api/stellar-throttling', apiRateLimit(), stellarThrottlingRoutes);
   ```

## Common Issues and Solutions

### Issue: Queue Full Errors

**Solution:** Increase queue size or TPM

```bash
# In .env
THROTTLING_MAX_QUEUE_SIZE=2000
THROTTLING_TPM=200
```

### Issue: Transactions Taking Too Long

**Solution:** Use priority flag for time-sensitive operations

```typescript
await throttlingService.submitTransaction(transaction, {
  priority: true,
});
```

### Issue: High Failure Rate

**Solution:** Enable retry logic

```typescript
await throttlingService.submitTransaction(transaction, {
  retryOnFailure: true,
  maxRetries: 3,
  retryDelayMs: 1000,
});
```

## Best Practices

1. **Start with conservative TPM** (e.g., 60) and increase gradually
2. **Use priority sparingly** - only for truly critical operations
3. **Enable retry for network errors** but not for invalid transactions
4. **Monitor metrics regularly** to optimize configuration
5. **Add metadata** to transactions for better tracking
6. **Test under load** before deploying to production

## Support

If you encounter issues during migration:

- Check the [Transaction Throttling Documentation](./TRANSACTION_THROTTLING.md)
- Review the [API Reference](#api-endpoints)
- Open an issue on GitHub
- Contact the development team

## Checklist

- [ ] Updated imports to use throttling service
- [ ] Added retry logic where appropriate
- [ ] Set priority flags for critical operations
- [ ] Updated tests to mock throttling service
- [ ] Configured environment variables
- [ ] Set up monitoring and alerts
- [ ] Tested under load
- [ ] Documented any custom throttling logic
- [ ] Trained team on new patterns
