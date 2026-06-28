# FX Rate Fetching Logic

The FX (Foreign Exchange) rate fetching logic provides critical conversion capabilities between the platform's nominal stable asset (`ORGUSD`) and fiat currencies like standard `USD`. Because `ORGUSD` acts as a 1:1 backed synthetic dollar, exchange rates relative to `ORGUSD` mirror standard USD conversions.

This document describes the architectural flow in `backend/src/services/fxRateService.ts`.

## Architecture & Data Flow

When a client or internal job requests the current conversion rates (`getOrgUsdRates()`), the service executes the following flow:

### 1. Redis Cache Check (Fast-Path)
The service utilizes Redis as the primary cache storage mechanism using the key `payd:fx:rates:orgusd`. If an unexpired entry exists (cached as an `OrgUsdRatesPayload` JSON string), it returns it immediately.

### 2. In-Memory Fallback Check
If Redis is disconnected, unavailable, or throws an error during the `get` operation, the system gracefully falls back to a short-lived node in-memory object cache.
If the payload is present and has not passed its eviction timestamp (`expiresAt`), it returns the value directly from RAM.

### 3. Primary Rate Provider (`open.er-api.com`)
If there's a cache miss (both Redis and memory are empty/expired), the system initiates a live HTTP request to `open.er-api.com`. This is a free endpoint requiring no authentication keys, making it a reliable primary source for public fiat conversions.

### 4. Secondary Rate Provider Fallback (`api.coinbase.com`)
If the primary provider returns a non-200 HTTP status, malformed JSON, or fails at the network level, the service immediately traps the error and falls back to Coinbase's public exchange-rate API (`api.coinbase.com`). This ensures high availability.

### 5. Normalization & Cache Population
Regardless of which provider succeeds, the returned mappings are sanitized and normalized into an `OrgUsdRatesPayload`.
The service then attempts to:
- **Set the Redis key** (`payd:fx:rates:orgusd`) with a TTL of 300 seconds (5 minutes).
- **Set the Memory Cache** with the equivalent expiration timestamp.

If setting Redis fails, the error is swallowed and logged as a warning; only the memory cache is updated.

### 6. Catastrophic Fallback
In extreme scenarios where both primary and secondary rate providers are down (or network connectivity is completely severed), the system will look at its `memoryFallback.payload`. If stale data exists from a previous successful run, it will return the stale data rather than halting payment operations entirely. If everything fails and no previous data exists, it throws the underlying fetch error.

---

### Payload Structure

```typescript
export interface OrgUsdRatesPayload {
  base: 'ORGUSD';               // The base nominal asset
  quoteBase: 'USD';             // The fiat peg
  fetchedAt: string;            // ISO8601 timestamp of provider fetch
  provider: string;             // The provider that successfully answered
  rates: Record<string, number>;// Discovered rates (e.g. { "EUR": 0.92, "USD": 1 ... })
  cacheTtlSeconds: number;      // Constant: 300
}
```
