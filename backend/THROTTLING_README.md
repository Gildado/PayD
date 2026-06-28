# Transaction Throttling Feature

## Overview

The Transaction Throttling feature provides system-level rate limiting for Stellar network transactions, preventing rate limit errors and managing transaction submission flow efficiently.

## Quick Links

- [Full Documentation](./TRANSACTION_THROTTLING.md)
- [Migration Guide](./THROTTLING_MIGRATION_GUIDE.md)
- [Examples](./src/examples/throttlingExample.ts)

## Quick Start

### 1. Configuration

Add to your `.env` file:

```bash
THROTTLING_TPM=100
THROTTLING_MAX_QUEUE_SIZE=1000
THROTTLING_REFILL_INTERVAL_MS=1000
```

### 2. Basic Usage

```typescript
import { StellarServiceWithThrottling } from './services/stellarServiceWithThrottling';

// Create and sign transaction
const transaction = await StellarServiceWithThrottling.createPaymentTransaction(
  sourceKeypair,
  destinationPublicKey,
  '100'
);

StellarServiceWithThrottling.signTransaction(transaction, sourceKeypair);

// Submit with automatic throttling
const result = await StellarServiceWithThrottling.submitTransactionThrottled(transaction);
```

### 3. Advanced Usage

```typescript
import { StellarThrottlingService } from './services/stellarThrottlingService';

const throttlingService = StellarThrottlingService.getInstance();

const result = await throttlingService.submitTransaction(transaction, {
  priority: true, // Jump the queue
  retryOnFailure: true, // Auto-retry on failure
  maxRetries: 3, // Max retry attempts
  retryDelayMs: 1000, // Initial retry delay
  metadata: {
    // Custom tracking data
    userId: '123',
    operation: 'payment',
  },
});
```

## Features

✅ **Token Bucket Algorithm** - Smooth rate limiting  
✅ **Configurable TPM** - Adjust transaction rate limits  
✅ **Queue Buffering** - Handle burst traffic  
✅ **Priority Queue** - High-priority transactions  
✅ **Auto Retry** - Configurable retry logic  
✅ **Real-time Metrics** - Comprehensive monitoring  
✅ **Event System** - Integration hooks  
✅ **REST API** - Management endpoints

## API Endpoints

| Endpoint                                | Method | Description           |
| --------------------------------------- | ------ | --------------------- |
| `/api/stellar-throttling/status`        | GET    | Current status        |
| `/api/stellar-throttling/metrics`       | GET    | Performance metrics   |
| `/api/stellar-throttling/config`        | GET    | Current configuration |
| `/api/stellar-throttling/config`        | PUT    | Update configuration  |
| `/api/stellar-throttling/queue/clear`   | POST   | Clear queue           |
| `/api/stellar-throttling/metrics/reset` | POST   | Reset metrics         |
| `/api/stellar-throttling/health`        | GET    | Health check          |

## Monitoring

### Check Status

```bash
curl http://localhost:4000/api/stellar-throttling/status
```

### View Metrics

```bash
curl http://localhost:4000/api/stellar-throttling/metrics
```

### Update Configuration

```bash
curl -X PUT http://localhost:4000/api/stellar-throttling/config \
  -H "Content-Type: application/json" \
  -d '{"tpm": 200, "maxQueueSize": 2000}'
```

## Testing

```bash
# Run unit tests
npm test -- stellarThrottlingService.test.ts

# Run controller tests
npm test -- stellarThrottlingController.test.ts

# Run all throttling tests
npm test -- throttling
```

## Architecture

```
Application → StellarThrottlingService → ThrottlingService → StellarService → Horizon
                      ↓                         ↓
                  Metrics                  Token Bucket
                  Events                   Queue Management
```

## Performance

- **Overhead**: < 1ms for immediate execution
- **Memory**: ~1-2 KB per queued transaction
- **Throughput**: Configurable up to 10,000 TPM
- **Latency**: 50-500ms average for queued transactions

## Best Practices

1. Start with conservative TPM (60-100)
2. Monitor metrics regularly
3. Use priority sparingly
4. Enable retry for network errors
5. Size queue for peak traffic

## Troubleshooting

### Queue Full Errors

Increase `THROTTLING_MAX_QUEUE_SIZE` or `THROTTLING_TPM`

### High Wait Times

Increase `THROTTLING_TPM` or use priority flag

### Low Success Rate

Enable retry logic and check network connectivity

## Support

- Documentation: [TRANSACTION_THROTTLING.md](./TRANSACTION_THROTTLING.md)
- Migration: [THROTTLING_MIGRATION_GUIDE.md](./THROTTLING_MIGRATION_GUIDE.md)
- Examples: [throttlingExample.ts](./src/examples/throttlingExample.ts)
- Issues: [GitHub Issues](https://github.com/your-repo/issues)

## License

Same as project license
