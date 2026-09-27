# Multi-Tenant Data Isolation Safety Guide

This document describes how to ensure every query in PayD's backend scopes by organization/tenant ID, preventing cross-tenant data leaks on mainnet.

## Overview

PayD is a multi-tenant SaaS platform. Each organization's data must be completely isolated. A query from Organization A must never return data from Organization B.

Isolation is enforced at three levels:
1. **Application layer**: Routes verify org match
2. **Middleware layer**: `isolateOrganization` middleware checks org ID
3. **Database layer**: PostgreSQL Row-Level Security (RLS) policies

## Architecture

### Route Handler Pattern

All protected routes must use the `isolateOrganization` middleware:

```typescript
router.get(
  '/employees/:id',
  authenticateJWT,
  isolateOrganization,  // Required for multi-tenant protection
  cacheResponse({ ttlSeconds: 300 }),
  employeeController.getOne.bind(employeeController)
);
```

### Query Scoping Pattern

Every query must scope by organization ID. Use this pattern:

```typescript
async function getEmployee(employeeId: string, organizationId: number) {
  const result = await pool.query(
    'SELECT * FROM employees WHERE id = $1 AND organization_id = $2',
    [employeeId, organizationId]
  );
  return result.rows[0];
}
```

Never:
```typescript
// ❌ UNSAFE: Returns employee regardless of organization
const result = await pool.query(
  'SELECT * FROM employees WHERE id = $1',
  [employeeId]
);
```

## Audit Checklist

Before committing code, verify:

### Route Level
- [ ] All protected routes use `isolateOrganization` middleware
- [ ] POST/PATCH/DELETE endpoints validate org ID in request body
- [ ] Query parameters include org ID filtering
- [ ] Admin routes (if any) have explicit org scope

### Query Level
- [ ] Every SELECT query includes `WHERE organization_id = $X`
- [ ] Every UPDATE query includes `WHERE organization_id = $X`
- [ ] Every DELETE query includes `WHERE organization_id = $X`
- [ ] No queries using `IN` clause without org scoping
- [ ] No JOIN queries that could leak data across orgs

### Service Layer
- [ ] Repository methods accept `organizationId` parameter
- [ ] Database calls pass org ID to all queries
- [ ] No caching without org ID in cache key
- [ ] No batch operations that mix organizations

### Test Coverage
- [ ] Tests verify queries with wrong org ID return nothing
- [ ] Tests verify cross-org data access is blocked
- [ ] Tests cover edge cases (NULL org ID, invalid org ID)
- [ ] Load tests verify isolation under concurrent access

## Query Audit Examples

### Safe Queries

```typescript
// ✅ Single employee with org scope
pool.query('SELECT * FROM employees WHERE id = $1 AND organization_id = $2', [id, orgId]);

// ✅ List with org filter
pool.query('SELECT * FROM employees WHERE organization_id = $1 ORDER BY name', [orgId]);

// ✅ Update with org scope
pool.query(
  'UPDATE employees SET status = $1 WHERE id = $2 AND organization_id = $3',
  [status, id, orgId]
);

// ✅ Delete with org scope
pool.query('DELETE FROM employees WHERE id = $1 AND organization_id = $2', [id, orgId]);

// ✅ Join queries with both tables scoped
pool.query(
  'SELECT e.*, p.amount FROM employees e ' +
  'JOIN payments p ON e.id = p.employee_id ' +
  'WHERE e.organization_id = $1 AND p.organization_id = $1',
  [orgId]
);
```

### Unsafe Queries (DO NOT USE)

```typescript
// ❌ Missing org scope
pool.query('SELECT * FROM employees WHERE id = $1', [id]);

// ❌ Using OR logic that weakens isolation
pool.query(
  'SELECT * FROM employees WHERE id = $1 OR organization_id = $2',
  [id, orgId]
);

// ❌ Batch query with weak scoping
pool.query(
  'SELECT * FROM employees WHERE id = ANY($1)',  // Missing org scope!
  [employeeIds]
);

// ❌ Join without org scope on both tables
pool.query(
  'SELECT e.*, p.* FROM employees e JOIN payments p ON e.id = p.employee_id',
  // Missing WHERE organization_id scope
);
```

## Common Vulnerability Patterns

| Pattern | Risk | Fix |
|---------|------|-----|
| Missing WHERE org clause | Data leak | Always add `AND organization_id = $X` |
| Weak cache keys | Cache poisoning | Include org ID: `cache_key: "emp_${orgId}_${empId}"` |
| Admin bypass | Full breach | Verify even admin users have org scoping |
| Batch operations | Batch leak | Scope each item: `IN (...) AND org_id = $1` |
| External API calls | Data exposure | Never send unscoped data to external APIs |
| Logging | Log exposure | Redact org data in logs, or include org context |
| Search/filter | Search leak | Filter all search results by org ID |

## Multi-Tenant Testing

### Unit Test Pattern

```typescript
describe('Employee Service - Multi-tenant isolation', () => {
  test('getEmployee returns employee only for correct org', async () => {
    const orgA = await createOrg('OrgA');
    const orgB = await createOrg('OrgB');

    const empA = await createEmployee(orgA.id, { name: 'Alice' });
    await createEmployee(orgB.id, { name: 'Bob' });

    // OrgA should see their employee
    const result1 = await employeeService.getEmployee(empA.id, orgA.id);
    expect(result1).toBeDefined();
    expect(result1.name).toBe('Alice');

    // OrgB should NOT see OrgA's employee
    const result2 = await employeeService.getEmployee(empA.id, orgB.id);
    expect(result2).toBeUndefined();
  });

  test('listEmployees only returns org employees', async () => {
    const orgA = await createOrg('OrgA');
    const orgB = await createOrg('OrgB');

    await createEmployee(orgA.id, { name: 'Alice' });
    await createEmployee(orgA.id, { name: 'Charlie' });
    await createEmployee(orgB.id, { name: 'Bob' });

    // OrgA should see 2 employees
    const empA = await employeeService.listEmployees(orgA.id);
    expect(empA.length).toBe(2);

    // OrgB should see 1 employee
    const empB = await employeeService.listEmployees(orgB.id);
    expect(empB.length).toBe(1);
  });

  test('cross-org update is impossible', async () => {
    const orgA = await createOrg('OrgA');
    const orgB = await createOrg('OrgB');

    const empA = await createEmployee(orgA.id, { status: 'active' });

    // Attempt to update OrgA's employee as OrgB
    await expect(
      employeeService.updateEmployee(empA.id, { status: 'inactive' }, orgB.id)
    ).rejects.toThrow();

    // Verify employee wasn't updated
    const result = await employeeService.getEmployee(empA.id, orgA.id);
    expect(result.status).toBe('active');
  });
});
```

### Integration Test Pattern

```typescript
describe('API Multi-tenant isolation', () => {
  test('GET /api/employees/:id blocks cross-org access', async () => {
    const orgA = await createOrg('OrgA');
    const orgB = await createOrg('OrgB');

    const empA = await createEmployee(orgA.id, { name: 'Alice' });
    const tokenB = await getAuthToken(orgB.id);

    // OrgB token should not access OrgA's employee
    const response = await request(app)
      .get(`/api/employees/${empA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);

    expect(response.body.error).toContain('Access denied');
  });

  test('POST /api/employees validates org ownership', async () => {
    const orgA = await createOrg('OrgA');
    const orgB = await createOrg('OrgB');
    const tokenB = await getAuthToken(orgB.id);

    const response = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        name: 'Alice',
        organizationId: orgA.id,  // Trying to assign to OrgA
      })
      .expect(403);

    expect(response.body.error).toContain('Organization mismatch');
  });
});
```

## Production Verification

Before launching to mainnet:

1. **Code audit**: Review all queries for org scoping
2. **Automated checks**: Run multi-tenant isolation tests
3. **Load testing**: Verify isolation holds under concurrent load
4. **Manual verification**: Spot-check queries in staging with 2+ orgs

## Emergency Response

If a cross-org data leak is suspected:

1. **Isolate**: Stop the affected service instance
2. **Assess**: Query audit logs to identify scope of breach
3. **Notify**: Alert affected organizations immediately
4. **Patch**: Deploy fix to all instances
5. **Verify**: Re-run isolation tests on production replicas
6. **Restore**: Resume service only after verification

## References

- PostgreSQL Row-Level Security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- OWASP: Broken Access Control: https://owasp.org/Top10/A01_2021-Broken_Access_Control/
- Multi-tenancy: https://stripe.com/blog/guide-to-multi-tenancy
