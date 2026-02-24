# Multi-Tenant Architecture

## Overview

This backend implements a robust multi-tenant architecture with strict data isolation between organizations using PostgreSQL Row-Level Security (RLS). Each organization's data is completely isolated at the database level, preventing any cross-tenant data access.

## Architecture Components

### 1. Row-Level Security (RLS)

PostgreSQL RLS policies enforce data isolation at the database level:

- **employees** table: Isolated by `organization_id`
- **transactions** table: Isolated by `organization_id`
- **tenant_configurations** table: Isolated by `organization_id`

### 2. Tenant Context Middleware

Three middleware functions handle tenant identification and validation:

- `extractTenantId`: Extracts organization ID from URL params or headers
- `validateTenant`: Verifies the organization exists
- `setTenantContext`: Sets PostgreSQL session variable for RLS

### 3. Database Session Variables

Each request sets `app.current_tenant_id` in the PostgreSQL session, which RLS policies use to filter data.

## Implementation Details

### Database Migrations

Run migrations in order:

```bash
psql -d payd -f src/db/migrations/001_create_tables.sql
psql -d payd -f src/db/migrations/002_extend_employee_profiles.sql
psql -d payd -f src/db/migrations/003_multi_tenant_rls.sql
psql -d payd -f src/db/migrations/004_tenant_configurations.sql
```

### Middleware Usage

Apply tenant context to all routes requiring isolation:

```typescript
import { requireTenantContext } from '../middleware/tenantContext';

router.get(
  '/organizations/:organizationId/employees',
  requireTenantContext,
  controller.getEmployees
);
```

### API Request Format

Include organization ID in URL:

```bash
GET /api/employees/organizations/123/
GET /api/search/organizations/123/employees?query=john
```

Or use header:

```bash
curl -H "X-Organization-Id: 123" http://localhost:3000/api/...
```

## Security Features

### 1. Automatic Data Filtering

RLS policies automatically filter all queries by tenant:

```sql
SELECT * FROM employees;  -- Only returns current tenant's employees
```

### 2. Cross-Tenant Protection

Attempts to access other tenants' data return empty results:

```sql
-- Tenant 1 context set
SELECT * FROM employees WHERE id = 999;  -- Returns nothing if 999 belongs to Tenant 2
```

### 3. Insert/Update Protection

Cannot insert or update data with wrong `organization_id`:

```sql
-- Tenant 1 context set
INSERT INTO employees (organization_id, ...) VALUES (2, ...);  -- FAILS
```

### 4. Referential Integrity

Triggers validate cross-table references stay within tenant boundaries.

## Tenant-Specific Configurations

Each tenant can have custom settings:

```typescript
import tenantConfigService from './services/tenantConfigService';

// Get payment settings
const settings = await tenantConfigService.getPaymentSettings(orgId);

// Update branding
await tenantConfigService.updateBrandingSettings(orgId, {
  primary_color: '#FF5733',
  logo_url: 'https://example.com/logo.png',
});
```

### Available Configuration Types

- **payment_settings**: Currency, approval thresholds
- **notification_settings**: Email, SMS, webhooks
- **security_settings**: 2FA, session timeout, IP whitelist
- **branding**: Logo, colors, company name

## Testing

### Unit Tests

Test middleware functions:

```bash
npm test -- tenantContext.test.ts
```

### Integration Tests

Verify data isolation:

```bash
npm test -- multiTenantIsolation.test.ts
```

These tests verify:

- Employees are isolated by tenant
- Transactions are isolated by tenant
- Cross-tenant queries return no data
- Updates/deletes don't affect other tenants
- Search results are tenant-scoped

## Best Practices

### 1. Always Use Middleware

Never bypass tenant context middleware on protected routes.

### 2. Validate Organization ID

The middleware validates the organization exists before processing requests.

### 3. Use Service Layer

Services automatically respect RLS policies when using the pool.

### 4. Monitor Tenant Context

Development mode logs tenant ID for each request.

### 5. Test Isolation

Always write tests that verify data isolation for new features.

## Troubleshooting

### No Data Returned

Check that `app.current_tenant_id` is set:

```sql
SHOW app.current_tenant_id;
```

### Permission Denied

Ensure RLS policies are enabled:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

### Cross-Tenant Access

Review middleware chain and ensure `requireTenantContext` is applied.
