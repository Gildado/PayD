# #012: Design & Migrate PostgreSQL Schema for Payroll Entities

**Status:** ✅ DONE

**Category:** [BACKEND]
**Difficulty:** ● MEDIUM
**Tags:** `postgresql`, `migrations`, `schema`

## Description

Create DB migrations for: organizations, employees, wallets, payroll_runs, transactions, and audit_logs tables. Define foreign keys, indexes on wallet_address and org_id, and timestamp defaults.

## Acceptance Criteria

- [x] Migrations created for all core entities.
- [x] Foreign key relationships and indexes correctly defined.
- [x] Schema handles organization and employee data effectively.
