# Redis Caching Strategy

This document outlines the caching strategy for PayD's backend services to ensure optimal performance and data freshness.

## Cache Tiers

The backend uses standardized TTL tiers for different types of data:

- **SHORT (60s)**: Highly dynamic data (real-time balances, active transactions)
- **MEDIUM (5m)**: User-facing data that changes occasionally (organization settings, employee lists)
- **LONG (1h)**: Reference data that rarely changes (asset configurations, tax rules)
- **VERY_LONG (24h)**: Static lookup tables (country codes, currency mappings)

## Cache Keys

All cache keys follow this pattern: `{keyPrefix}:{domain}:{entity}:{id}`

Examples:
- `cache:organization:settings:123`
- `cache:employee:profile:456`
- `cache:balance:xlm:GXXXXX`

## Cache Invalidation

### Pattern-Based Invalidation
When data changes, use prefix invalidation to clear all related entries:

```typescript
// Clear all employee caches for an organization
await cacheService.invalidatePrefix('cache:employee:*');

// Clear all balance caches
await cacheService.invalidatePrefix('cache:balance:*');
```

### Event-Driven Invalidation
Webhooks and queue jobs should trigger cache invalidation when data changes:

```typescript
// On employee update
await cacheService.invalidatePrefix(`cache:employee:*`);

// On balance change
await cacheService.delete(`cache:balance:${assetCode}:${walletAddress}`);
```

## Cache Warming

Pre-populate cache for frequently accessed data:

```typescript
// Warm common lookups on startup
await cacheService.warmCache(
  'cache:assets:all',
  () => fetchAllAssets(),
  CacheTier.LONG
);
```

## Best Practices

1. **Always set TTL**: Use explicit TTL to prevent unbounded memory growth
2. **Validate cache hits**: Treat cached data as potentially stale; validate before use in critical paths
3. **Use remember() for fetch-through**: Avoid double-checks with the remember() pattern
4. **Monitor cache hits**: Track cache hit rates per key prefix via metrics
5. **Clear on deploy**: Flush cache after data model changes

## Monitoring

Cache operations are tracked via Prometheus metrics:
- `cache_operations_total`: Incremented per operation (get/set/delete) and result
- `cache_query_duration_seconds`: Histogram of cache operation latencies

## Migration Path

For stateless horizontal scaling:
- Cache is backed by Redis (primary) with in-memory fallback
- Use dedicated Redis instance per environment
- Ensure Redis persistence for critical caches
- Monitor Redis memory usage per prefix
