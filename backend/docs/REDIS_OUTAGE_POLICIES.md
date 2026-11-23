# Redis Outage Policies

| Feature | Redis unavailable | Policy | Result |
| --- | --- | --- | --- |
| Rate limiting | Client disabled or Redis operation fails | Fail open with process-local fallback | Requests continue. Local counters still enforce each configured tier, but limits are no longer shared across application instances. |
| Idempotency | Redis unavailable | No effect; the idempotency store is PostgreSQL-backed. If that store is unavailable while processing a keyed request, fail closed. | The middleware returns `503` without invoking the route. A completed response is not sent until it has been persisted; an in-flight duplicate receives `409`. Strict endpoints require a UUID v4 key, while existing optional-key endpoints continue without idempotency when the header is absent. |
| Response caching | Client disabled or Redis operation fails | Fail open | With no client at startup, the service uses a process-local cache. Runtime read errors are treated as misses and write/invalidation errors are logged; the request continues to the origin handler. |

The process-local rate-limit and cache fallbacks are not distributed. Cache invalidation during a Redis outage is best effort, so a stale Redis entry can remain available to other instances until its TTL expires after service recovery. Keep cache TTLs appropriate for the data being cached.

The policies are exercised without connecting to Redis by constructing the rate-limit and cache services with a disabled (`null`) client. Idempotency tests separately simulate an unavailable PostgreSQL-backed store, because Redis is not its persistence backend.
