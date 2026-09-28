# Retry Logic Implementation

This document describes the retry logic implementation for handling connection failures in the PayD backend.

## Overview

The retry logic provides automatic recovery from transient connection failures, improving system resilience and reliability.

## Components

### 1. Retry Utilities (`backend/src/utils/retry.ts`)

Core retry functions with exponential backoff and jitter.

#### `withRetry<T>(fn, options?)`

Executes an async function with retry logic.

**Options:**
- `maxRetries` (default: 3): Maximum number of retry attempts
- `baseDelayMs` (default: 100): Initial delay between retries
- `maxDelayMs` (default: 30000): Maximum delay cap
- `backoffMultiplier` (default: 2): Multiplier for exponential backoff
- `retryableErrors`: Array of error patterns to retry on
- `onRetry`: Callback function called on each retry

**Example:**
```typescript
import { withRetry } from '../utils/retry.js';

const result = await withRetry(
  () => fetchData(),
  {
    maxRetries: 3,
    baseDelayMs: 1000,
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT'],
    onRetry: (attempt, error) => {
      logger.warn(`Retry attempt ${attempt}: ${error.message}`);
    }
  }
);
```

#### `withConnectionRetry<T>(fn, options?)`

Specialized wrapper that retries on connection-specific errors:
- `ECONNREFUSED`
- `ECONNRESET`
- `ETIMEDOUT`
- `Socket hang up`
- `Network request failed`
- And more...

**Example:**
```typescript
import { withConnectionRetry } from '../utils/retry.js';

const result = await withConnectionRetry(
  () => database.query('SELECT * FROM users'),
  { maxRetries: 3, baseDelayMs: 500 }
);
```

### 2. Connection Retry Service (`backend/src/services/connectionRetryService.ts`)

High-level service for managing retries with health tracking.

**Features:**
- Automatic retry with circuit breaker integration
- Health status tracking per service
- Consecutive failure monitoring

**Example:**
```typescript
import { connectionRetryService } from '../services/connectionRetryService.js';

const result = await connectionRetryService.executeWithRetry(
  {
    serviceName: 'database',
    circuitBreakerName: 'database',
    retryOptions: { maxRetries: 3 }
  },
  () => pool.query('SELECT 1')
);

// Check health status
const health = connectionRetryService.getHealth('database');
console.log(health?.healthy); // true/false
console.log(health?.consecutiveFailures); // number
```

## Integration Points

### Database Pool Service

The `dbPoolService.ts` now uses `withConnectionRetry` for database queries:

```typescript
const result = await withConnectionRetry(
  () => pool.query<T>(text, params),
  { maxRetries: 2, baseDelayMs: 500 }
);
```

### Stellar Service

The `stellarService.ts` continues to use `withRetry` for Horizon API calls:

```typescript
static async loadAccount(publicKey: string): Promise<Horizon.AccountResponse> {
  const server = this.getServer();
  return withRetry(() => server.loadAccount(publicKey));
}
```

## Error Handling

### Connection Error Detection

The retry logic automatically detects connection errors by matching against known patterns:

```typescript
const CONNECTION_ERROR_PATTERNS = [
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
  'SOCKET_TIMEOUT',
  'Connection refused',
  'Connection reset',
  'Connection terminated',
  'Socket hang up',
  'network timeout',
  'Network request failed',
];
```

### Non-Retryable Errors

The following errors are NOT retried by default:
- 4xx HTTP errors (except 429 Too Many Requests)
- Validation errors
- Authentication errors
- Business logic errors

## Configuration

### Environment Variables

```bash
# Database connection retry
DB_CONNECT_TIMEOUT_MS=5000
DB_POOL_MAX=20

# Stellar API retry
STELLAR_MAX_RETRIES=3
STELLAR_RETRY_DELAY_MS=1000
STELLAR_RETRY_DELAY_MAX_MS=10000
```

## Testing

Run the retry service tests:

```bash
cd backend
npm test -- --grep "ConnectionRetryService"
```

## Monitoring

### Health Endpoints

The connection retry service exposes health status:

```typescript
// Get health for a specific service
const health = connectionRetryService.getHealth('database');

// Get all service health statuses
const allHealth = connectionRetryService.getAllHealth();
```

### Logging

Retry attempts are logged with the following format:

```
[Retry] Attempt 1/4 failed: ECONNREFUSED. Retrying in 200ms...
[Retry] Attempt 2/4 failed: ECONNREFUSED. Retrying in 400ms...
```

Consecutive failures trigger error-level logs:

```
[ConnectionRetryService] database has 5 consecutive failures
```

## Best Practices

1. **Use appropriate retry counts**: 2-3 retries for most operations
2. **Set reasonable delays**: Start with 500ms-1s for connection retries
3. **Monitor health**: Use the health tracking to detect persistent issues
4. **Integrate with circuit breakers**: For production resilience
5. **Log retry attempts**: For debugging and monitoring
