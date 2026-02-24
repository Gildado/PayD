# Multi-Tenant Architecture Setup Guide

## Quick Start

### 1. Run Database Migrations

Apply the multi-tenant migrations to enable Row-Level Security:

```bash
# From the backend directory
psql -d payd -f src/db/migrations/003_multi_tenant_rls.sql
psql -d payd -f src/db/migrations/004_tenant_configurations.sql
```

### 2. Verify RLS is Enabled

```sql
-- Connect to your database
psql -d payd

-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('employees', 'transactions', 'tenant_configurations');

-- Should show rowsecurity = true for all tables
```

### 3. Test the Implementation

```bash
# Start the server
npm run dev

# In another terminal, run the test script
./test-multi-tenant.sh
```

### 4. Run Automated Tests

```bash
# Run all tests
npm test

# Run only multi-tenant tests
npm test -- multiTenantIsolation.test.ts
npm test -- tenantContext.test.ts
```

## What Was Implemented

### Database Layer

1. **RLS Policies** (003_multi_tenant_rls.sql)
   - Enabled RLS on employees, transactions tables
   - Created policies for SELECT, INSERT, UPDATE, DELETE
   - Added validation triggers for referential integrity
   - Created helper functions for tenant context

2. **Tenant Configurations** (004_tenant_configurations.sql)
   - New table for tenant-specific settings
   - RLS policies for configuration isolation
   - Default configurations for all tenants
   - Helper functions for config management

### Application Layer

1. **Tenant Context Middleware** (middleware/tenantContext.ts)
   - `extractTenantId`: Extracts org ID from URL/headers
   - `validateTenant`: Verifies organization exists
   - `setTenantContext`: Sets PostgreSQL session variable
   - `requireTenantContext`: Combined middleware chain

2. **Tenant Config Service** (services/tenantConfigService.ts)
   - Manage payment settings
   - Manage notification preferences
   - Manage security settings
   - Manage branding customization

3. **Updated Routes**
   - All employee routes use `requireTenantContext`
   - All search routes use `requireTenantContext`
   - Automatic tenant isolation on all queries

### Testing

1. **Unit Tests** (middleware/**tests**/tenantContext.test.ts)
   - Middleware validation
   - Error handling
   - Edge cases

2. **Integration Tests** (**tests**/multiTenantIsolation.test.ts)
   - Employee data isolation
   - Transaction data isolation
   - Cross-tenant access prevention
   - Search isolation
   - Insert/update/delete protection

## Acceptance Criteria Status

✅ **Data isolation verified across all API endpoints**

- RLS policies enforce isolation at database level
- Integration tests verify no cross-tenant access

✅ **Tenant ID included in all database queries**

- Middleware sets `app.current_tenant_id` session variable
- RLS policies automatically filter by tenant

✅ **Automated tests verify no data leaks between orgs**

- 20+ test cases in multiTenantIsolation.test.ts
- Tests cover SELECT, INSERT, UPDATE, DELETE operations
- Tests verify search isolation

✅ **Support for tenant-specific configurations**

- tenant_configurations table with RLS
- TenantConfigService for managing settings
- Support for payment, notification, security, and branding configs

## API Usage Examples

### With URL Parameter (Recommended)

```bash
# Get employees for organization 1
GET /api/employees/organizations/1

# Search employees in organization 2
GET /api/search/organizations/2/employees?query=john&status=active
```

### With Header

```bash
curl -H "X-Organization-Id: 1" \
  http://localhost:3000/api/employees/organizations/1
```

## Security Guarantees

1. **Database-Level Isolation**: RLS policies prevent any SQL query from accessing other tenants' data
2. **Automatic Filtering**: No code changes needed - isolation is transparent
3. **Insert Protection**: Cannot insert data with wrong organization_id
4. **Update Protection**: Cannot update other tenants' records
5. **Delete Protection**: Cannot delete other tenants' records
6. **Search Isolation**: Full-text search respects tenant boundaries
7. **Referential Integrity**: Triggers prevent cross-tenant references

## Monitoring

Development mode logs tenant context:

```
[2024-01-15T10:30:00.000Z] GET /api/employees/organizations/1 - Tenant: 1
[2024-01-15T10:30:05.000Z] GET /api/search/organizations/2/employees - Tenant: 2
```

## Next Steps

1. **Authentication**: Integrate JWT tokens with tenant claims
2. **Audit Logging**: Track all tenant data access
3. **Rate Limiting**: Per-tenant rate limits
4. **Metrics**: Per-tenant usage analytics
5. **Backup**: Tenant-specific backup strategies
