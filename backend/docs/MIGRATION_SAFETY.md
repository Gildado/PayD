# Migration Safety and Rollback Guide

This document describes how to ensure all Prisma migrations have safe, tested rollback paths for mainnet deployment.

## Overview

Database migrations are critical for production. Every migration must have:
1. Forward migration (upgrade path)
2. Rollback migration (downgrade path)
3. Tests for both paths
4. Documentation of business impact

## Migration Naming Convention

All migrations must follow this pattern:

```
prisma/migrations/YYYYMMDDHHMMSS_<descriptive-name>/migration.sql
```

Example: `20260927120000_add_organization_rls_policies/migration.sql`

## Migration Checklist

Before committing a migration, verify:

### Backward Compatibility
- [ ] Doesn't remove columns without deprecation period
- [ ] Doesn't change column types without data migration
- [ ] Doesn't add NOT NULL columns without defaults
- [ ] Doesn't remove indexes on high-traffic queries

### Forward Path
- [ ] All schema changes are idempotent
- [ ] Foreign key constraints are valid
- [ ] Indexes are created on foreign key columns
- [ ] No data loss in transformations

### Rollback Path
- [ ] Rollback doesn't leave orphaned data
- [ ] Rollback restores schema to exact previous state
- [ ] Rollback is tested before commit

### Testing
- [ ] Test forward migration on clean database
- [ ] Test forward migration on existing data
- [ ] Test rollback on migrated database
- [ ] Test forward -> rollback -> forward cycle

## Migration Template

Create new migrations using this template:

```sql
-- Forward migration: Add organization isolation
BEGIN;

-- Create RLS policies
CREATE POLICY org_isolation_employees
  ON employees
  AS RESTRICTIVE
  FOR ALL
  USING (organization_id = current_setting('app.current_tenant_id')::integer);

-- Add constraint if needed
ALTER TABLE employees
  ADD CONSTRAINT employees_org_id_not_null
  CHECK (organization_id IS NOT NULL);

COMMIT;
```

## Rollback Implementation

Each migration requires a rollback script. Store in the same migration directory:

```sql
-- Rollback migration: Remove organization isolation

BEGIN;

-- Drop policies
DROP POLICY org_isolation_employees ON employees;

-- Drop constraint
ALTER TABLE employees
  DROP CONSTRAINT employees_org_id_not_null;

COMMIT;
```

## Testing Migrations

### Unit Test Pattern

```typescript
import { pool } from '../config/database.js';

describe('Migration: Add organization RLS', () => {
  test('should create RLS policies', async () => {
    const result = await pool.query(
      `SELECT * FROM pg_policies WHERE tablename = 'employees'`
    );
    expect(result.rows.length).toBeGreaterThan(0);
  });

  test('should enforce RLS isolation', async () => {
    await pool.query(`SET app.current_tenant_id = '123'`);
    const result = await pool.query(
      `SELECT * FROM employees WHERE organization_id = 456`
    );
    expect(result.rows.length).toBe(0); // RLS blocks access
  });

  test('rollback should remove policies', async () => {
    // After running rollback script...
    const result = await pool.query(
      `SELECT * FROM pg_policies WHERE tablename = 'employees'`
    );
    expect(result.rows.length).toBe(0);
  });
});
```

## Production Migration Runbook

### Before Deployment
1. [ ] All migrations tested in staging
2. [ ] Rollback scripts verified
3. [ ] Backup strategy documented
4. [ ] Estimated migration time confirmed
5. [ ] No concurrent DML operations during migration

### During Deployment
1. [ ] Database backup taken
2. [ ] Migration runs on primary (not replica)
3. [ ] Monitor migration progress (duration < 30 minutes for <1GB)
4. [ ] Verify no locked connections blocking migration

### After Deployment
1. [ ] Schema verification query passes
2. [ ] Application health checks pass
3. [ ] Error logs show no migration-related errors
4. [ ] Query plans unchanged for critical queries

### Rollback Procedure (if needed)
1. [ ] Stop application (prevents new queries)
2. [ ] Run rollback script
3. [ ] Verify schema matches previous version
4. [ ] Restart application
5. [ ] Monitor error logs

## Automated Checks

The migration audit script (`backend/scripts/audit-migrations.ts`) performs:

1. **Syntax validation**: All SQL is valid PostgreSQL
2. **Idempotence check**: Migration can run multiple times safely
3. **Naming validation**: Follows naming convention
4. **Constraint validation**: Foreign keys reference valid tables
5. **Rollback validation**: Rollback script exists and is syntactically valid

Run before each commit:

```bash
npm run db:migrate:audit
```

## Multi-Tenant Migration Safety

For migrations affecting multi-tenant tables:

1. **Ensure isolation**: Use `app.current_tenant_id` in any conditional logic
2. **Test per-tenant**: Verify migration works for organization A and B independently
3. **No cross-tenant leaks**: Ensure migration doesn't expose data between organizations

Example:

```sql
-- Safe: Scoped to current tenant
UPDATE employees
SET is_active = false
WHERE organization_id = current_setting('app.current_tenant_id')::integer
  AND termination_date IS NOT NULL;
```

## Common Pitfalls

| Issue | Impact | Solution |
|-------|--------|----------|
| Missing NOT NULL default | Downtime | Add default before constraint |
| Changing column type | Data loss | Use intermediate column |
| Removing index early | Performance degradation | Keep index during rollback period |
| Concurrent migrations | Deadlocks | Run migrations serially |
| Missing rollback script | Can't rollback | Create rollback before committing |

## References

- Prisma Migrations: https://www.prisma.io/docs/concepts/components/prisma-migrate
- PostgreSQL Transactions: https://www.postgresql.org/docs/current/tutorial-transactions.html
- Zero-downtime Migrations: https://guides.rubyonrails.org/v6.0/active_record_migrations.html
