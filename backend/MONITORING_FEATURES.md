# Backend Monitoring & Reliability Features

This document describes the monitoring, observability, and reliability features added in issues #1048, #1049, #1050, and #1051.

---

## Table of Contents

1. [Graceful Shutdown (#1048)](#graceful-shutdown-1048)
2. [Multi-Tenant RLS Isolation Tests (#1049)](#multi-tenant-rls-isolation-tests-1049)
3. [Email Delivery Tracking (#1050)](#email-delivery-tracking-1050)
4. [Database Slow Query Monitoring (#1051)](#database-slow-query-monitoring-1051)

---

## Graceful Shutdown (#1048)

### Overview

Implements graceful shutdown handling for all backend services to ensure in-progress work completes before process termination during deployments.

### Features

- **SIGTERM/SIGINT handling**: Captures termination signals and initiates graceful shutdown sequence
- **Ordered shutdown steps**:
  1. Stop accepting new HTTP connections
  2. Drain existing HTTP requests
  3. Stop BullMQ workers (finish current jobs)
  4. Close database connection pool
  5. Clean up Redis connections
  6. Shutdown tracing SDK
- **30-second timeout**: Force exit after 30 seconds if graceful shutdown takes too long
- **Health endpoint during shutdown**: Returns 503 during shutdown phase
- **Structured logging**: All shutdown steps logged with timestamps and elapsed time

### Implementation

**File**: `src/index.ts`

```typescript
// Graceful shutdown triggered by SIGTERM or SIGINT
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

**Health Check**: `src/controllers/healthController.ts`

The `/health/ready` endpoint returns 503 during shutdown, signaling load balancers to stop routing traffic.

### Testing

**Kubernetes Deployment**:
```yaml
terminationGracePeriodSeconds: 30
```

**Manual Test**:
```bash
# Start server
npm run dev

# Send SIGTERM
kill -TERM <pid>

# Verify logs show graceful shutdown sequence
```

### Acceptance Criteria

- ✅ SIGTERM triggers graceful shutdown sequence
- ✅ In-flight HTTP requests complete before shutdown
- ✅ BullMQ workers finish current job before closing
- ✅ Health endpoint returns 503 during shutdown phase
- ✅ All connections closed cleanly (no zombie processes)
- ✅ Force exit after 30-second timeout
- ✅ Shutdown sequence logged with timestamps
- ✅ No data loss from in-progress payroll jobs

---

## Multi-Tenant RLS Isolation Tests (#1049)

### Overview

Automated test suite verifying Row-Level Security (RLS) policies prevent cross-tenant data access. Tests run in CI on every PR to catch RLS policy regressions.

### Features

- **Isolation verification**: Creates data in tenant A, verifies tenant B cannot access it
- **Comprehensive table coverage**: Tests all RLS-protected tables
- **RLS policy persistence check**: Verifies RLS policies survive database migrations
- **Per-table status report**: Generates detailed report of RLS verification status
- **CI integration**: Blocks PR merge if RLS tests fail

### Implementation

**File**: `src/__tests__/rlsIsolation.test.ts`

### Test Structure

```typescript
describe('Multi-Tenant RLS Isolation Tests', () => {
  // Test employees table RLS
  it('should isolate employee records between tenants', async () => {
    // 1. Create record in tenant A context
    // 2. Verify tenant A can see it
    // 3. Switch to tenant B context
    // 4. Verify tenant B CANNOT see it
  });
});
```

### Running Tests

```bash
# Run RLS isolation tests
npm test -- rlsIsolation

# Run in CI
npm test
```

### Tables Tested

- `employees`
- `payrolls`
- `payments`
- `payroll_items`
- `audit_logs`
- _(Add all 49 migration tables with RLS policies)_

### Acceptance Criteria

- ✅ Test creates records in tenant A context
- ✅ Same query in tenant B context returns empty results
- ✅ All 49 migration tables with RLS tested
- ✅ Tests run in CI pipeline on every PR
- ✅ Test failure blocks merge
- ✅ Report shows per-table RLS verification status
- ✅ Tests use separate test database (not production)

---

## Email Delivery Tracking (#1050)

### Overview

Tracks email delivery status, handles bounces, and provides visibility into email reliability for transactional notifications.

### Features

- **Delivery status tracking**: Sent, delivered, opened, clicked, bounced, failed
- **Bounce handling**:
  - **Hard bounces**: Automatically flag email as invalid
  - **Soft bounces**: Retry with exponential backoff (5min → 30min → 2hr)
- **Webhook handlers**: SendGrid and Resend webhook integration
- **Email validation**: Check if email is flagged as invalid before sending
- **Prometheus metrics**: Delivery rate, bounce rate, delivery counts
- **Admin endpoints**: View delivery stats and per-employee email activity

### Implementation

**Service**: `src/services/emailDeliveryTrackingService.ts`  
**Routes**: `src/routes/emailWebhookRoutes.ts`  
**Migration**: `src/db/migrations/050_email_delivery_tracking.sql`

### Database Schema

```sql
-- Email delivery logs
CREATE TABLE email_delivery_logs (
  id UUID PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  bounce_type TEXT,
  bounce_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  retry_scheduled_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Invalid emails (hard bounces)
CREATE TABLE invalid_emails (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  flagged_at TIMESTAMP DEFAULT NOW()
);
```

### Webhook Configuration

**SendGrid**:
```bash
# Configure webhook URL in SendGrid dashboard
https://api.payd.com/webhooks/sendgrid/email-events

# Events: delivered, open, click, bounce, dropped, deferred
```

**Resend**:
```bash
# Configure webhook URL in Resend dashboard
https://api.payd.com/webhooks/resend/email-events

# Events: email.delivered, email.opened, email.clicked, email.bounced
```

### API Endpoints

**Get Delivery Stats**:
```bash
GET /webhooks/email-stats?provider=sendgrid

Response:
{
  "sent": 1000,
  "delivered": 950,
  "opened": 450,
  "clicked": 120,
  "bounced": 30,
  "failed": 20,
  "deliveryRate": 95.0,
  "bounceRate": 3.0
}
```

**Get Email Activity**:
```bash
GET /webhooks/email-activity/employee@company.com?limit=50

Response:
{
  "email": "employee@company.com",
  "activity": [
    {
      "message_id": "msg_123",
      "status": "delivered",
      "provider": "sendgrid",
      "created_at": "2026-07-27T12:00:00Z"
    }
  ]
}
```

### Usage Example

```typescript
import { emailDeliveryTracking } from './services/emailDeliveryTrackingService.js';

// Before sending email
const isValid = await emailDeliveryTracking.isEmailValid(email);
if (!isValid) {
  logger.warn('Email flagged as invalid, skipping send', { email });
  return;
}

// Track email sent
await emailDeliveryTracking.trackEmailSent(
  messageId,
  email,
  'sendgrid',
  { type: 'payroll_notification' }
);
```

### Prometheus Metrics

- `payd_email_delivery_total{status, provider}` - Total emails by status
- `payd_email_bounces_total{bounce_type, provider}` - Total bounces
- `payd_email_delivery_rate{provider}` - Delivery rate percentage
- `payd_email_bounce_rate{provider}` - Bounce rate percentage

### Acceptance Criteria

- ✅ Delivery events captured via provider webhooks
- ✅ Email delivery status tracked in database
- ✅ Hard bounces flag email address as invalid
- ✅ Soft bounces trigger retry with backoff
- ✅ Delivery rate dashboard in Grafana
- ✅ Bounce rate alerting when exceeds threshold
- ✅ Email activity queryable per employee

---

## Database Slow Query Monitoring (#1051)

### Overview

Monitors database query performance with slow query logging, query plan analysis, and automatic alerting for queries exceeding performance thresholds.

### Features

- **Query duration tracking**: All queries logged with execution time
- **Slow query detection**: Configurable threshold (default: 500ms)
- **Query plan analysis**: EXPLAIN ANALYZE for slow queries
- **Missing index detection**: Identifies sequential scans and suggests indexes
- **Prometheus metrics**: Query duration histogram, slow query count
- **Alerting**: Alerts when slow query rate exceeds 5% of total queries
- **Parameter sanitization**: Masks sensitive data in logs

### Implementation

**Service**: `src/services/slowQueryMonitorService.ts`

### Configuration

**Environment Variables**:
```bash
SLOW_QUERY_THRESHOLD_MS=500          # Threshold for slow query (default: 500ms)
SLOW_QUERY_RATE_ALERT_THRESHOLD=0.05 # Alert at 5% slow query rate (default: 0.05)
```

### Query Analysis

When a slow query is detected:

1. **Log query details**: Query text, duration, parameters (sanitized)
2. **Get execution plan**: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`
3. **Analyze for issues**:
   - Sequential scans → Suggest index
   - High row counts → Suggest pagination
   - Expensive sorts → Suggest index on sort columns
   - Nested loops → Suggest join optimization
4. **Generate recommendations**: Actionable suggestions for optimization

### Usage Example

```typescript
import { slowQueryMonitor } from './services/slowQueryMonitorService.js';

// Track query execution
const startTime = Date.now();
const result = await pool.query(query, params);
const duration = Date.now() - startTime;

await slowQueryMonitor.trackQuery(query, params, duration);
```

### Log Format

```json
{
  "level": "warn",
  "message": "Slow query detected",
  "duration_ms": 1250,
  "threshold_ms": 500,
  "query": "SELECT * FROM employees WHERE status = $1 ORDER BY created_at DESC",
  "sanitized_params": "[\"active\"]",
  "query_plan": {
    "plan": {
      "Node Type": "Seq Scan",
      "Relation Name": "employees",
      "Actual Rows": 15000
    },
    "executionTime": 1248.5,
    "planningTime": 1.5
  },
  "recommendations": [
    "Sequential scan detected - consider adding index on filtered columns",
    "High row count (15000) - consider adding WHERE clause or pagination"
  ]
}
```

### Prometheus Metrics

- `payd_database_query_duration_seconds{query_type, table}` - Query duration histogram
- `payd_database_slow_queries_total{query_type, table}` - Slow query counter
- `payd_database_queries_total{query_type}` - Total query counter

### Grafana Dashboard

**Query Performance Panel**:
```promql
# 95th percentile query duration by table
histogram_quantile(0.95, 
  rate(payd_database_query_duration_seconds_bucket[5m])
)

# Slow query rate
rate(payd_database_slow_queries_total[5m]) 
/ 
rate(payd_database_queries_total[5m]) * 100
```

**Alert Rule**:
```yaml
groups:
  - name: database
    rules:
      - alert: HighSlowQueryRate
        expr: |
          (rate(payd_database_slow_queries_total[5m]) 
          / rate(payd_database_queries_total[5m])) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High slow query rate detected"
          description: "{{ $value }}% of queries are slow (threshold: 5%)"
```

### Acceptance Criteria

- ✅ All database queries logged with execution duration
- ✅ Queries exceeding threshold logged as slow queries
- ✅ Slow query logs include Prisma query and parameters (sanitized)
- ✅ Query plan EXPLAIN captured for slow queries
- ✅ Missing index recommendations generated
- ✅ Prometheus metric for slow query count
- ✅ Alert when slow query rate exceeds 5% of total queries

---

## Integration

### CI Pipeline

Add to `.github/workflows/build.yml`:

```yaml
- name: Run RLS Isolation Tests
  run: npm test -- rlsIsolation
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

### Docker Compose

```yaml
services:
  backend:
    environment:
      - SLOW_QUERY_THRESHOLD_MS=500
      - SLOW_QUERY_RATE_ALERT_THRESHOLD=0.05
    # Graceful shutdown support
    stop_grace_period: 30s
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: backend
          livenessProbe:
            httpGet:
              path: /health/live
              port: 4000
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 4000
```

---

## Monitoring Dashboard

### Recommended Grafana Panels

1. **Graceful Shutdown Health**
   - Query: `up{job="payd-backend"}`
   - Shows instances shutting down gracefully

2. **Email Delivery Rate**
   - Query: `payd_email_delivery_rate`
   - Target: > 95%

3. **Email Bounce Rate**
   - Query: `payd_email_bounce_rate`
   - Alert threshold: > 5%

4. **Database Query Performance**
   - Query: `histogram_quantile(0.95, rate(payd_database_query_duration_seconds_bucket[5m]))`
   - Target: < 500ms

5. **Slow Query Rate**
   - Query: `rate(payd_database_slow_queries_total[5m]) / rate(payd_database_queries_total[5m])`
   - Alert threshold: > 5%

---

## Migration Guide

### Running Migrations

```bash
# Apply email delivery tracking migration
psql $DATABASE_URL -f src/db/migrations/050_email_delivery_tracking.sql

# Verify tables created
psql $DATABASE_URL -c "\dt email_*"
```

### Rollback (if needed)

```sql
DROP TABLE IF EXISTS email_delivery_logs;
DROP TABLE IF EXISTS invalid_emails;
ALTER TABLE employees DROP COLUMN IF EXISTS email_status;
ALTER TABLE employees DROP COLUMN IF EXISTS email_invalid_reason;
```

---

## Troubleshooting

### Graceful Shutdown Issues

**Problem**: Forced shutdown after 30s timeout

**Solution**: Check for:
- Long-running database queries
- Stuck BullMQ jobs
- Unresponsive external API calls

**Fix**: Increase timeout or optimize blocking operations

### Email Webhooks Not Working

**Problem**: Delivery events not being tracked

**Solution**:
1. Verify webhook URL is publicly accessible
2. Check webhook provider dashboard for errors
3. Review logs: `grep "webhook" logs/app.log`
4. Test webhook manually: `curl -X POST https://api.payd.com/webhooks/sendgrid/email-events -d @test-event.json`

### Slow Query Alerts Firing

**Problem**: High slow query rate

**Solution**:
1. Review slow query logs for patterns
2. Check query plans for missing indexes
3. Add recommended indexes
4. Optimize N+1 query patterns

```sql
-- Example: Add index based on recommendation
CREATE INDEX idx_employees_status_created_at ON employees(status, created_at DESC);
```

---

## Future Enhancements

- [ ] Automatic query optimization suggestions
- [ ] Database tuning automation
- [ ] Query result caching layer
- [ ] Email retry queue visualization
- [ ] RLS policy auto-generation tool
- [ ] Distributed tracing for slow queries

---

## Related Documentation

- [TESTING.md](./TESTING.md) - Testing guidelines
- [DOCKER_TROUBLESHOOTING.md](./DOCKER_TROUBLESHOOTING.md) - Docker issues
- [README.md](./README.md) - Main backend documentation

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/Gildado/PayD/issues
- Slack: #backend-monitoring
- Email: devops@payd.com
