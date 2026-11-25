# RLS tenant table policy gaps

`backend/src/__tests__/rlsOrganizationPolicyCoverage.test.ts` statically enumerates every migration-defined table with an `organization_id` column and requires that table to have at least one `CREATE POLICY ... ON <table>` statement in migrations.

## Current gaps

The following tenant-scoped tables currently have `organization_id` but no RLS policy defined in migrations. They are explicitly listed in the coverage test so new/unlisted gaps fail review; each gap should be fixed with an appropriate policy migration or intentionally reclassified with justification.

| Table | Status |
| --- | --- |
| `admin_audit_log` | Gap: no RLS policy in migrations |
| `auto_refund_log` | Gap: no RLS policy in migrations |
| `batch_archive` | Gap: no RLS policy in migrations |
| `bulk_payment_batches` | Gap: no RLS policy in migrations |
| `claimable_balances` | Gap: no RLS policy in migrations |
| `invites` | Gap: no RLS policy in migrations |
| `notification_configs` | Gap: no RLS policy in migrations |
| `notifications` | Gap: no RLS policy in migrations |
| `orchestration_records` | Gap: no RLS policy in migrations |
| `org_audit_log` | Gap: no RLS policy in migrations |
| `org_query_throughput` | Gap: no RLS policy in migrations |
| `payroll_audit_logs` | Gap: no RLS policy in migrations |
| `payroll_runs` | Gap: no RLS policy in migrations |
| `payroll_schedules` | Gap: no RLS policy in migrations |
| `report_agents` | Gap: no RLS policy in migrations |
| `report_executions` | Gap: no RLS policy in migrations |
| `sep31_cross_border_transactions` | Gap: no RLS policy in migrations |
| `tax_reports` | Gap: no RLS policy in migrations |
| `tax_rules` | Gap: no RLS policy in migrations |
| `users` | Gap: no RLS policy in migrations |
| `webhook_subscriptions` | Gap: no RLS policy in migrations |

## Policy-covered tenant tables

Tables with `organization_id` and at least one policy in migrations: `audit_logs`, `employees`, `tenant_configurations`, `transactions`, `wallets`.

When adding a policy for a listed table, remove it from `KNOWN_POLICY_GAPS` in the coverage test and from this document.
