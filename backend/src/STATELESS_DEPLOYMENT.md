# Stateless Deployment Guide

This document outlines how to run PayD backend services stateless for horizontal scaling behind a load balancer.

## Architecture Overview

The backend is designed to be stateless, with all persistent state stored in external services:
- **Database**: PostgreSQL (multi-instance safe)
- **Cache**: Redis (centralized)
- **Queues**: BullMQ on Redis (distributed)
- **WebSocket State**: Redis adapter for Socket.IO (when scaled)

## Key Principles

1. **No in-process state**: All application state must be persisted externally
2. **Load balancer friendly**: Can add/remove instances without coordination
3. **Crash-resilient**: Restarting an instance does not lose data
4. **Session-less**: Each request can be handled by any instance

## In-Process State Management

### Graceful Shutdown Tracking

The lifecycle module tracks in-flight requests for graceful shutdown:

```typescript
// lifecycle.ts - Tracks in-flight requests only
let inFlightRequests = 0;
let shuttingDown = false;
```

This state is **instance-local and intentional** because:
- It tracks request lifecycle during graceful shutdown
- Not shared across instances
- Lost on restart (graceful shutdown gives pending requests time to complete)
- Not used in routing decisions

**Do NOT** use this state in application logic.

### Socket.IO Considerations

If using Socket.IO for real-time updates across multiple instances:

```typescript
// socketService.ts - Currently single-instance only
let io: SocketIOServer | null = null;
```

For horizontal scaling with Socket.IO:

1. **Use Socket.IO Redis adapter**:
   ```typescript
   import { createAdapter } from '@socket.io/redis-adapter';
   
   const pubClient = redis.createClient();
   const subClient = pubClient.duplicate();
   
   io.adapter(createAdapter(pubClient, subClient));
   ```

2. **Or use sticky sessions** with load balancer to route clients to same instance

3. **Or replace WebSocket with Server-Sent Events (SSE)** polling Redis for updates

## Database Connections

- Connection pooling is handled by `pg` package
- Each instance maintains its own pool to the database
- Database is the single source of truth
- No cross-instance session state in database

## Redis Connections

- Centralized Redis instance serves all backend instances
- Handles cache, queues, locks, and rate limiting
- Ensure Redis is highly available (persistence, replication)

## Queue System (BullMQ)

- Jobs in queues are processed by any available worker
- Dead-letter queues persist failed jobs for investigation
- No affinity between job and worker instance
- Multiple instances can process from same queue safely

## Load Balancer Configuration

### Required Settings

- **Connection draining**: 30-60 seconds for graceful shutdown
- **Health check**: GET /health endpoint should return 200 when ready
- **No sticky sessions**: Unless using Socket.IO without adapter
- **No affinity**: Route each request independently

### Recommended Health Checks

```
GET /health
- Returns 200 OK when service is operational
- Returns 503 Service Unavailable during shutdown
```

## Deployment Checklist

- [ ] Redis instance is configured and available
- [ ] PostgreSQL database is accessible from all instances
- [ ] Load balancer is configured without sticky sessions
- [ ] Health check endpoint is responding
- [ ] Logs are aggregated (not stored locally)
- [ ] Socket.IO adapter or session strategy is configured
- [ ] No local files are used for persistence
- [ ] Environment variables are set identically across instances

## Common Pitfalls

1. **Storing session data in-process**: Use Redis instead
2. **Local file uploads**: Use cloud storage (S3, etc)
3. **In-memory caches without TTL**: Data grows unbounded
4. **Shared database connections**: Each instance pools separately
5. **Assuming request affinity**: Load balancer can route to any instance

## Testing Statelessness

1. Start multiple backend instances
2. Simulate one instance failing
3. Verify other instances continue serving requests
4. Verify no data is lost
5. Restart failed instance
6. Verify it joins the cluster automatically
