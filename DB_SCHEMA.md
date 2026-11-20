# PayD Database Schema

This document provides a comprehensive map of the PostgreSQL database schema used by PayD, including table relationships, key fields, indexing strategy, and data retention policies.

## Table of Contents

- [Overview](#overview)
- [Core Tables](#core-tables)
- [Payroll Tables](#payroll-tables)
- [Wallet & Asset Tables](#wallet--asset-tables)
- [Contract & Blockchain Tables](#contract--blockchain-tables)
- [Audit & Logging Tables](#audit--logging-tables)
- [Webhook & Integration Tables](#webhook--integration-tables)
- [Indexing Strategy](#indexing-strategy)
- [Data Retention Policies](#data-retention-policies)
- [Entity Relationship Diagram](#entity-relationship-diagram)

## Overview

PayD uses PostgreSQL 15+ with the following design principles:

- **Multi-tenancy**: All tables include `organization_id` for tenant isolation via Row-Level Security (RLS)
- **Audit trails**: Critical tables have append-only audit logs
- **Full-text search**: Employee and transaction tables support PostgreSQL `tsvector` for fast searching
- **Soft deletes**: Sensitive entities use `deleted_at` timestamps instead of hard deletes
- **Timezone safety**: All timestamps use `TIMESTAMPTZ` for UTC consistency
- **Immutability**: Blockchain-related data is append-only

## Core Tables

### organizations

Represents a company or entity using PayD for payroll.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | SERIAL | PRIMARY KEY | Unique organization identifier |
| `name` | VARCHAR(255) | NOT NULL, UNIQUE | Organization legal name |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last modification timestamp |
| `deleted_at` | TIMESTAMPTZ | NULL | Soft delete marker |

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (name)`

**Relationships:**
- One-to-many: employees, transactions, payroll_runs, wallets, webhook_subscriptions

---

### employees

Represents an employee or contractor within an organization.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | SERIAL | PRIMARY KEY | Unique employee identifier |
| `organization_id` | INTEGER | NOT NULL, FK | Parent organization |
| `first_name` | VARCHAR(100) | NOT NULL | Employee first name |
| `last_name` | VARCHAR(100) | NOT NULL | Employee last name |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Unique email address |
| `wallet_address` | VARCHAR(56) | NULL | Stellar G-address (optional) |
| `status` | VARCHAR(20) | CHECK IN ('active', 'inactive', 'pending') | Employment status |
| `position` | VARCHAR(100) | NULL | Job title |
| `department` | VARCHAR(100) | NULL | Department name |
| `salary` | DECIMAL(20, 7) | NULL | Base salary in XLM |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last modification timestamp |
| `deleted_at` | TIMESTAMPTZ | NULL | Soft delete marker |
| `search_vector` | tsvector | GENERATED ALWAYS | Full-text search index |

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (email)`
- `idx_employees_org_id (organization_id)`
- `idx_employees_status (status)`
- `idx_employees_wallet (wallet_address)`
- `idx_employees_search (search_vector) USING GIN`
- `idx_employees_created_at (created_at)`

**Relationships:**
- Many-to-one: organizations
- One-to-many: transactions, payroll_items, wallets

**Full-Text Search:**
The `search_vector` column combines first_name (weight A), last_name (weight A), email (weight B), position (weight C), and department (weight C) for fast employee lookup.

---

### users

Represents system users (admins, payroll managers) with authentication credentials.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | SERIAL | PRIMARY KEY | Unique user identifier |
| `organization_id` | INTEGER | NOT NULL, FK | Parent organization |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Login email |
| `password_hash` | VARCHAR(255) | NULL | Bcrypt hash (NULL if OAuth) |
| `role` | VARCHAR(20) | CHECK IN ('admin', 'manager', 'viewer') | Access level |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last modification timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (email)`
- `idx_users_org_id (organization_id)`

**Relationships:**
- Many-to-one: organizations
- One-to-many: audit_logs

---

## Payroll Tables

### payroll_runs

Represents a batch of payroll payments for a specific period.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | SERIAL | PRIMARY KEY | Unique payroll run identifier |
| `organization_id` | INTEGER | NOT NULL, FK | Parent organization |
| `batch_id` | VARCHAR(64) | UNIQUE, NOT NULL | Unique batch identifier |
| `status` | VARCHAR(20) | CHECK IN ('draft', 'pending', 'processing', 'completed', 'failed') | Processing status |
| `period_start` | DATE | NOT NULL | Payroll period start date |
| `period_end` | DATE | NOT NULL | Payroll period end date |
| `total_base_amount` | DECIMAL(20, 7) | DEFAULT 0 | Sum of base salaries |
| `total_bonus_amount` | DECIMAL(20, 7) | DEFAULT 0 | Sum of bonuses |
| `total_amount` | DECIMAL(20, 7) | DEFAULT 0 | Total payout amount |
| `asset_code` | VARCHAR(12) | DEFAULT 'XLM' | Asset being paid (XLM, USDC, etc.) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last modification timestamp |
| `processed_at` | TIMESTAMPTZ | NULL | Completion timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (batch_id)`
- `idx_payroll_runs_org_id (organization_id)`
- `idx_payroll_runs_status (status)`
- `idx_payroll_runs_period (period_start, period_end)`

**Relationships:**
- Many-to-one: organizations
- One-to-many: payroll_items

---

### payroll_items

Individual payment line items within a payroll run.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | SERIAL | PRIMARY KEY | Unique item identifier |
| `payroll_run_id` | INTEGER | NOT NULL, FK | Parent payroll run |
| `employee_id` | INTEGER | NOT NULL, FK | Employee receiving payment |
| `item_type` | VARCHAR(20) | CHECK IN ('base', 'bonus') | Payment type |
| `amount` | DECIMAL(20, 7) | NOT NULL | Payment amount in stroops |
| `description` | TEXT | NULL | Payment description |
| `tx_hash` | VARCHAR(64) | NULL | Stellar transaction hash |
| `status` | VARCHAR(20) | CHECK IN ('pending', 'completed', 'failed') | Payment status |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last modification timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `idx_payroll_items_run_id (payroll_run_id)`
- `idx_payroll_items_employee_id (employee_id)`
- `idx_payroll_items_type (item_type)`

**Relationships:**
- Many-to-one: payroll_runs, employees

---

### payroll_schedules

Recurring payroll schedule configuration.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | SERIAL | PRIMARY KEY | Unique schedule identifier |
| `organization_id` | INTEGER | NOT NULL, FK | Parent organization |
| `frequency` | VARCHAR(20) | CHECK IN ('weekly', 'biweekly', 'monthly') | Payment frequency |
| `day_of_week` | INTEGER | NULL | Day for weekly schedules (0-6) |
| `day_of_month` | INTEGER | NULL | Day for monthly schedules (1-31) |
| `is_active` | BOOLEAN | DEFAULT TRUE | Whether schedule is active |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last modification timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `idx_payroll_schedules_org_id (organization_id)`

**Relationships:**
- Many-to-one: organizations

---

## Wallet & Asset Tables

### wallets

Represents a Stellar account (G-address) and its trustlines for different assets.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PRIMARY KEY | Unique wallet identifier |
| `organization_id` | INTEGER | NOT NULL, FK | Parent organization |
| `employee_id` | INTEGER | NULL, FK | Associated employee (NULL for org wallets) |
| `wallet_address` | VARCHAR(56) | NOT NULL | Stellar G-address |
| `wallet_type` | VARCHAR(20) | CHECK IN ('employee', 'organization', 'escrow', 'treasury') | Wallet purpose |
| `asset_code` | VARCHAR(12) | DEFAULT 'XLM' | Asset code (XLM, USDC, etc.) |
| `asset_issuer` | VARCHAR(56) | DEFAULT '' | Asset issuer G-address (empty for XLM) |
| `balance` | DECIMAL(20, 7) | DEFAULT 0, CHECK >= 0 | Cached balance in stroops |
| `is_active` | BOOLEAN | DEFAULT TRUE | Whether wallet is active |
| `is_frozen` | BOOLEAN | DEFAULT FALSE | Whether trustline is frozen |
| `last_synced_at` | TIMESTAMPTZ | NULL | Last balance sync timestamp |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last modification timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (wallet_address, asset_code, asset_issuer)`
- `idx_wallets_org_id (organization_id)`
- `idx_wallets_employee_id (employee_id) WHERE employee_id IS NOT NULL`
- `idx_wallets_wallet_address (wallet_address)`
- `idx_wallets_org_asset (organization_id, asset_code)`
- `idx_wallets_frozen (organization_id, is_frozen) WHERE is_frozen = TRUE`
- `idx_wallets_last_synced_at (last_synced_at ASC NULLS FIRST)`

**Relationships:**
- Many-to-one: organizations, employees
- One-to-many: transactions

**Note:** Balance is cached from Horizon/SDS for analytics. Always query Horizon for authoritative balance before disbursements.

---

## Contract & Blockchain Tables

### contract_registry

Registry of deployed Soroban smart contracts.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | SERIAL | PRIMARY KEY | Unique registry entry |
| `name` | VARCHAR(100) | UNIQUE, NOT NULL | Contract name (e.g., "Bulk Payment") |
| `description` | TEXT | NULL | Contract purpose |
| `network` | VARCHAR(20) | CHECK IN ('TESTNET', 'MAINNET') | Stellar network |
| `contract_id` | VARCHAR(255) | UNIQUE, NOT NULL | On-chain C-address |
| `current_wasm_hash` | VARCHAR(64) | NOT NULL | SHA-256 of deployed WASM |
| `version` | VARCHAR(50) | DEFAULT '1.0.0' | Semantic version |
| `last_upgraded_at` | TIMESTAMPTZ | NULL | Last upgrade timestamp |
| `last_upgraded_by` | VARCHAR(255) | NULL | Admin who performed upgrade |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (name)`
- `UNIQUE (contract_id)`
- `idx_contract_registry_network (network, created_at DESC)`

**Relationships:**
- One-to-many: contract_upgrade_logs

---

### contract_upgrade_logs

Append-only audit trail of contract upgrades.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | BIGSERIAL | PRIMARY KEY | Unique log entry |
| `registry_id` | INTEGER | NOT NULL, FK | Contract being upgraded |
| `previous_wasm_hash` | VARCHAR(64) | NOT NULL | Previous WASM hash |
| `new_wasm_hash` | VARCHAR(64) | NOT NULL | New WASM hash |
| `status` | VARCHAR(30) | CHECK IN ('pending', 'simulated', 'confirmed', 'executing', 'completed', 'failed', 'cancelled') | Upgrade status |
| `simulation_result` | JSONB | NULL | Soroban RPC simulation response |
| `tx_hash` | VARCHAR(255) | NULL | On-chain transaction hash |
| `migration_steps` | JSONB | DEFAULT '[]' | Post-upgrade migration steps |
| `initiated_by` | VARCHAR(255) | NOT NULL | Admin wallet address |
| `notes` | TEXT | NULL | Upgrade notes/changelog |
| `error_message` | TEXT | NULL | Error details on failure |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `completed_at` | TIMESTAMPTZ | NULL | Completion timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `idx_upgrade_logs_registry_id (registry_id, created_at DESC)`
- `idx_upgrade_logs_active_status (status, created_at DESC) WHERE status IN ('pending', 'simulated', 'confirmed', 'executing')`
- `idx_upgrade_logs_created_at_brin (created_at) USING BRIN`

**Relationships:**
- Many-to-one: contract_registry

---

### contract_events

Events emitted by deployed contracts.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | BIGSERIAL | PRIMARY KEY | Unique event identifier |
| `contract_id` | VARCHAR(255) | NOT NULL | Contract C-address |
| `event_type` | VARCHAR(100) | NOT NULL | Event name |
| `category` | VARCHAR(50) | NULL | Event category (e.g., 'payment', 'approval') |
| `data` | JSONB | NOT NULL | Event data payload |
| `tx_hash` | VARCHAR(64) | NOT NULL | Transaction hash |
| `ledger_sequence` | BIGINT | NOT NULL | Ledger number |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Event timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `idx_contract_events_contract_id (contract_id, created_at DESC)`
- `idx_contract_events_type (event_type)`
- `idx_contract_events_category (category)`

---

### claimable_balances

Tracks Stellar claimable balances for escrow and conditional payments.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | SERIAL | PRIMARY KEY | Unique balance identifier |
| `organization_id` | INTEGER | NOT NULL, FK | Parent organization |
| `claimable_balance_id` | VARCHAR(255) | UNIQUE, NOT NULL | Stellar CB ID |
| `asset_code` | VARCHAR(12) | NOT NULL | Asset code |
| `asset_issuer` | VARCHAR(56) | NULL | Asset issuer |
| `amount` | DECIMAL(20, 7) | NOT NULL | Balance amount |
| `sponsor` | VARCHAR(56) | NOT NULL | Sponsor address |
| `claimant` | VARCHAR(56) | NOT NULL | Claimant address |
| `status` | VARCHAR(20) | CHECK IN ('active', 'claimed', 'expired') | Balance status |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `claimed_at` | TIMESTAMPTZ | NULL | Claim timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (claimable_balance_id)`
- `idx_claimable_balances_org_id (organization_id)`
- `idx_claimable_balances_claimant (claimant)`
- `idx_claimable_balances_status (status)`

**Relationships:**
- Many-to-one: organizations

---

## Audit & Logging Tables

### transactions

Represents Stellar transactions initiated by PayD.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | SERIAL | PRIMARY KEY | Unique transaction identifier |
| `organization_id` | INTEGER | NOT NULL, FK | Parent organization |
| `employee_id` | INTEGER | NULL, FK | Associated employee |
| `tx_hash` | VARCHAR(64) | UNIQUE, NOT NULL | Stellar transaction hash |
| `amount` | DECIMAL(20, 7) | NOT NULL | Transaction amount |
| `asset_code` | VARCHAR(12) | NOT NULL | Asset code |
| `status` | VARCHAR(20) | CHECK IN ('pending', 'completed', 'failed') | Transaction status |
| `transaction_type` | VARCHAR(20) | CHECK IN ('payment', 'refund', 'bonus') | Transaction type |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last modification timestamp |
| `search_vector` | tsvector | GENERATED ALWAYS | Full-text search index |

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (tx_hash)`
- `idx_transactions_org_id (organization_id)`
- `idx_transactions_employee_id (employee_id)`
- `idx_transactions_status (status)`
- `idx_transactions_search (search_vector) USING GIN`
- `idx_transactions_created_at (created_at)`
- `idx_transactions_amount (amount)`

**Relationships:**
- Many-to-one: organizations, employees

---

### transaction_audit_logs

Append-only audit trail for all transaction state changes.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | BIGSERIAL | PRIMARY KEY | Unique log entry |
| `transaction_id` | INTEGER | NOT NULL, FK | Transaction being audited |
| `action` | VARCHAR(50) | NOT NULL | Action performed (created, updated, failed) |
| `previous_state` | JSONB | NULL | Previous transaction state |
| `new_state` | JSONB | NOT NULL | New transaction state |
| `actor` | VARCHAR(255) | NOT NULL | User or system that made change |
| `reason` | TEXT | NULL | Reason for change |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Audit timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `idx_transaction_audit_logs_tx_id (transaction_id, created_at DESC)`
- `idx_transaction_audit_logs_action (action)`

**Relationships:**
- Many-to-one: transactions

---

### payroll_audit_logs

Append-only audit trail for payroll run changes.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | BIGSERIAL | PRIMARY KEY | Unique log entry |
| `payroll_run_id` | INTEGER | NOT NULL, FK | Payroll run being audited |
| `action` | VARCHAR(50) | NOT NULL | Action performed |
| `previous_state` | JSONB | NULL | Previous state |
| `new_state` | JSONB | NOT NULL | New state |
| `actor` | VARCHAR(255) | NOT NULL | User or system |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Audit timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `idx_payroll_audit_logs_run_id (payroll_run_id, created_at DESC)`

**Relationships:**
- Many-to-one: payroll_runs

---

### audit_logs

General-purpose audit log for all system actions.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | BIGSERIAL | PRIMARY KEY | Unique log entry |
| `organization_id` | INTEGER | NOT NULL, FK | Parent organization |
| `user_id` | INTEGER | NULL, FK | User who performed action |
| `action` | VARCHAR(100) | NOT NULL | Action description |
| `resource_type` | VARCHAR(50) | NOT NULL | Resource type (employee, payroll, etc.) |
| `resource_id` | VARCHAR(255) | NOT NULL | Resource identifier |
| `changes` | JSONB | NULL | Changed fields |
| `ip_address` | VARCHAR(45) | NULL | IP address of requester |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Audit timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `idx_audit_logs_org_id (organization_id, created_at DESC)`
- `idx_audit_logs_user_id (user_id)`
- `idx_audit_logs_resource (resource_type, resource_id)`

**Relationships:**
- Many-to-one: organizations, users

---

## Webhook & Integration Tables

### webhook_subscriptions

Webhook endpoint subscriptions for event notifications.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | TEXT | PRIMARY KEY | Unique subscription identifier |
| `organization_id` | INTEGER | NOT NULL, FK | Parent organization |
| `url` | TEXT | NOT NULL | Webhook endpoint URL |
| `secret` | TEXT | NOT NULL | HMAC secret for signature verification |
| `events` | TEXT[] | DEFAULT ARRAY['*'] | Subscribed event types |
| `is_active` | BOOLEAN | DEFAULT TRUE | Whether subscription is active |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last modification timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `idx_webhook_subscriptions_org (organization_id)`
- `idx_webhook_subscriptions_active (organization_id, is_active)`

**Relationships:**
- Many-to-one: organizations
- One-to-many: webhook_delivery_logs

---

### webhook_delivery_logs

Delivery attempt logs for webhook events.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | SERIAL | PRIMARY KEY | Unique delivery log |
| `subscription_id` | TEXT | NOT NULL, FK | Webhook subscription |
| `event_type` | TEXT | NOT NULL | Event type delivered |
| `payload` | JSONB | NOT NULL | Event payload |
| `response_status` | INTEGER | NULL | HTTP response status |
| `response_body` | TEXT | NULL | HTTP response body |
| `error_message` | TEXT | NULL | Delivery error message |
| `attempt_number` | INTEGER | DEFAULT 1 | Retry attempt number |
| `delivered_at` | TIMESTAMPTZ | DEFAULT NOW() | Delivery timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `idx_webhook_delivery_logs_sub (subscription_id, delivered_at DESC)`

**Relationships:**
- Many-to-one: webhook_subscriptions

---

### notifications

User notifications for payroll events.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | SERIAL | PRIMARY KEY | Unique notification |
| `organization_id` | INTEGER | NOT NULL, FK | Parent organization |
| `user_id` | INTEGER | NOT NULL, FK | Recipient user |
| `type` | VARCHAR(50) | NOT NULL | Notification type |
| `title` | VARCHAR(255) | NOT NULL | Notification title |
| `message` | TEXT | NOT NULL | Notification message |
| `is_read` | BOOLEAN | DEFAULT FALSE | Read status |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `read_at` | TIMESTAMPTZ | NULL | Read timestamp |

**Indexes:**
- `PRIMARY KEY (id)`
- `idx_notifications_user_id (user_id, is_read)`
- `idx_notifications_created_at (created_at DESC)`

**Relationships:**
- Many-to-one: organizations, users

---

## Indexing Strategy

### Index Types Used

1. **B-tree** (default): General-purpose indexes for equality and range queries
2. **GIN** (Generalized Inverted Index): Full-text search vectors
3. **BRIN** (Block Range Index): Large append-only tables (audit logs, upgrade logs)

### Indexing Principles

- **Foreign keys**: Always indexed for JOIN performance
- **Status columns**: Indexed for filtering queries
- **Timestamps**: Indexed for range queries and sorting
- **Search vectors**: GIN indexes for full-text search
- **Composite indexes**: Used for common multi-column predicates
- **Partial indexes**: Used for sparse data (e.g., frozen wallets)

### Query Performance Tips

```sql
-- Good: Uses index on (organization_id, status)
SELECT * FROM employees 
WHERE organization_id = 1 AND status = 'active';

-- Good: Uses GIN index on search_vector
SELECT * FROM employees 
WHERE search_vector @@ to_tsquery('english', 'john');

-- Bad: Full table scan (no index on department alone)
SELECT * FROM employees WHERE department = 'Engineering';
-- Better: Add index or use search_vector
```

---

## Data Retention Policies

### Retention by Table

| Table | Retention | Policy |
|-------|-----------|--------|
| organizations | Indefinite | Soft delete only |
| employees | Indefinite | Soft delete only |
| users | Indefinite | Soft delete only |
| payroll_runs | Indefinite | Immutable audit trail |
| transactions | Indefinite | Immutable audit trail |
| contract_events | 2 years | Archive to cold storage |
| audit_logs | 7 years | Compliance requirement |
| webhook_delivery_logs | 90 days | Auto-delete after 90 days |
| notifications | 30 days | Auto-delete after 30 days |

### Soft Delete Pattern

Tables with `deleted_at` column use soft deletes:

```sql
-- Logical delete (not removed from DB)
UPDATE employees SET deleted_at = NOW() WHERE id = 123;

-- Query active records only
SELECT * FROM employees WHERE deleted_at IS NULL;

-- Query deleted records
SELECT * FROM employees WHERE deleted_at IS NOT NULL;
```

### Archival Strategy

Large append-only tables (contract_events, audit_logs) should be archived:

```sql
-- Archive old events to cold storage
INSERT INTO contract_events_archive
SELECT * FROM contract_events 
WHERE created_at < NOW() - INTERVAL '2 years';

DELETE FROM contract_events 
WHERE created_at < NOW() - INTERVAL '2 years';
```

---

## Entity Relationship Diagram

```
┌─────────────────────┐
│  organizations      │
│  ─────────────────  │
│  id (PK)            │
│  name               │
│  created_at         │
│  deleted_at         │
└──────────┬──────────┘
           │
    ┌──────┴──────┬──────────┬──────────┬──────────┐
    │             │          │          │          │
    ▼             ▼          ▼          ▼          ▼
┌─────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────┐
│employees│  │users   │  │wallets │  │payroll │  │webhooks  │
│         │  │        │  │        │  │_runs   │  │_subscr   │
└────┬────┘  └────┬───┘  └────┬───┘  └───┬────┘  └──────────┘
     │            │           │          │
     │            │           │          ▼
     │            │           │      ┌──────────┐
     │            │           │      │payroll   │
     │            │           │      │_items    │
     │            │           │      └──────────┘
     │            │           │
     │            │           ▼
     │            │       ┌──────────┐
     │            │       │transactions
     │            │       └──────────┘
     │            │
     │            ▼
     │        ┌──────────┐
     │        │audit_logs│
     │        └──────────┘
     │
     ▼
┌──────────────────┐
│contract_registry │
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│contract_upgrade_logs │
└──────────────────────┘
```

---

## Migration Management

All schema changes are managed through migrations in `backend/src/db/migrations/`:

```bash
# Run all pending migrations
npm run db:migrate

# Dry-run migrations (preview changes)
npm run db:migrate:dry-run
```

Each migration file follows the naming convention: `NNN_description.sql`

---

## Performance Monitoring

Monitor query performance:

```sql
-- Find slow queries
SELECT query, calls, mean_time, max_time 
FROM pg_stat_statements 
WHERE mean_time > 100 
ORDER BY mean_time DESC;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;

-- Find missing indexes
SELECT schemaname, tablename, attname 
FROM pg_stat_user_tables t 
JOIN pg_attribute a ON a.attrelid = t.relid 
WHERE seq_scan > idx_scan;
```

---

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Stellar Documentation](https://developers.stellar.org/)
- [PayD Architecture Diagram](ARCHITECTURE_DIAGRAM.md)
- [Contract Storage Layout](docs/CONTRACT_STORAGE_LAYOUT.md)

---

<!-- BEGIN:GENERATED-SCHEMA (do not edit by hand; run npm run db:schema-doc) -->

## Generated Schema Reference

This section lists every table and column in the `public` schema after applying all migrations. It is checked in CI: if it is out of date, run `npm run db:schema-doc` and commit the result.

Tables: 60

### account_freeze_logs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('account_freeze_logs_id_seq'::regclass)` |
| `target_account` | character varying(56) | NO |  |
| `asset_code` | character varying(12) | NO |  |
| `asset_issuer` | character varying(56) | NO |  |
| `action` | character varying(10) | NO |  |
| `scope` | character varying(10) | NO | `'account'::character varying` |
| `tx_hash` | character varying(64) | YES |  |
| `initiated_by` | character varying(56) | NO |  |
| `reason` | text | YES |  |
| `created_at` | timestamp without time zone | NO | `now()` |

### admin_audit_log

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('admin_audit_log_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `action_type` | character varying(80) | NO |  |
| `resource_type` | character varying(50) | NO |  |
| `resource_id` | character varying(100) | YES |  |
| `old_state` | jsonb | YES |  |
| `new_state` | jsonb | YES |  |
| `actor_id` | integer | YES |  |
| `actor_email` | character varying(255) | YES |  |
| `actor_ip` | inet | YES |  |
| `user_agent` | text | YES |  |
| `request_id` | character varying(64) | YES |  |
| `severity` | character varying(20) | NO | `'info'::character varying` |
| `metadata` | jsonb | YES |  |
| `created_at` | timestamp with time zone | NO | `now()` |

### api_latency_histogram

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('api_latency_histogram_id_seq'::regclass)` |
| `endpoint` | text | NO |  |
| `method` | character varying(10) | NO | `'GET'::character varying` |
| `bucket_ms` | integer | NO |  |
| `observations` | bigint | NO | `1` |
| `window_start` | timestamp with time zone | NO |  |
| `window_end` | timestamp with time zone | NO |  |
| `recorded_at` | timestamp with time zone | NO | `now()` |

### audit_log_actions

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `action` | character varying(100) | NO |  |

### audit_log_entity_types

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `entity_type` | character varying(50) | NO |  |

### audit_logs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('audit_logs_id_seq'::regclass)` |
| `organization_id` | integer | YES |  |
| `entity_type` | character varying(50) | NO |  |
| `entity_id` | character varying(255) | NO |  |
| `action` | character varying(100) | NO |  |
| `actor_type` | character varying(20) | NO | `'system'::character varying` |
| `actor_id` | character varying(255) | YES |  |
| `actor_email` | character varying(255) | YES |  |
| `actor_ip` | inet | YES |  |
| `old_values` | jsonb | YES |  |
| `new_values` | jsonb | YES |  |
| `metadata` | jsonb | NO | `'{}'::jsonb` |
| `severity` | character varying(10) | NO | `'info'::character varying` |
| `created_at` | timestamp with time zone | NO | `now()` |

### auto_refund_log

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('auto_refund_log_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `distribution_account` | character varying(56) | NO |  |
| `funding_source` | character varying(56) | NO |  |
| `asset_code` | character varying(12) | NO |  |
| `amount` | numeric(20,7) | NO |  |
| `balance_before` | numeric(20,7) | NO |  |
| `balance_after` | numeric(20,7) | NO |  |
| `tx_hash` | character varying(128) | YES |  |
| `status` | character varying(20) | NO | `'completed'::character varying` |
| `created_at` | timestamp with time zone | NO | `now()` |

### batch_archive

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('batch_archive_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `batch_id` | bigint | NO |  |
| `payment_count` | integer | NO |  |
| `success_count` | integer | NO | `0` |
| `fail_count` | integer | NO | `0` |
| `total_sent` | numeric(20,7) | NO | `0` |
| `asset_code` | character varying(12) | NO |  |
| `status_data` | bytea | YES |  |
| `archived_at` | timestamp with time zone | NO | `now()` |

### bulk_payment_batches

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('bulk_payment_batches_id_seq'::regclass)` |
| `batch_id` | uuid | NO | `gen_random_uuid()` |
| `organization_id` | integer | YES |  |
| `source_account` | character varying(56) | NO |  |
| `total_items` | integer | NO |  |
| `successful_items` | integer | NO | `0` |
| `failed_items` | integer | NO | `0` |
| `status` | character varying(20) | NO | `'pending'::character varying` |
| `asset_code` | character varying(12) | NO |  |
| `asset_issuer` | character varying(56) | YES |  |
| `created_at` | timestamp without time zone | YES | `now()` |
| `completed_at` | timestamp without time zone | YES |  |

### bulk_payment_items

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('bulk_payment_items_id_seq'::regclass)` |
| `batch_id` | uuid | NO |  |
| `envelope_index` | integer | NO |  |
| `destination` | character varying(56) | NO |  |
| `amount` | numeric(20,7) | NO |  |
| `reference_id` | character varying(255) | YES |  |
| `tx_hash` | character varying(64) | YES |  |
| `status` | character varying(20) | NO | `'pending'::character varying` |
| `error_message` | text | YES |  |
| `created_at` | timestamp without time zone | YES | `now()` |

### circuit_breaker_events

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('circuit_breaker_events_id_seq'::regclass)` |
| `breaker_name` | text | NO |  |
| `event_type` | text | NO |  |
| `from_state` | text | YES |  |
| `to_state` | text | YES |  |
| `failure_count` | integer | YES |  |
| `message` | text | YES |  |
| `recorded_at` | timestamp with time zone | NO | `now()` |

### circuit_breaker_state

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `name` | text | NO |  |
| `state` | text | NO | `'CLOSED'::text` |
| `failure_count` | integer | NO | `0` |
| `success_count` | integer | NO | `0` |
| `last_failure_at` | timestamp with time zone | YES |  |
| `opened_at` | timestamp with time zone | YES |  |
| `updated_at` | timestamp with time zone | NO | `now()` |

### claimable_balances

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('claimable_balances_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `employee_id` | integer | YES |  |
| `payroll_run_id` | integer | YES |  |
| `payroll_item_id` | integer | YES |  |
| `balance_id` | character varying(128) | NO |  |
| `claimant_public_key` | character varying(56) | YES |  |
| `amount` | numeric(20,7) | NO |  |
| `asset_code` | character varying(12) | NO |  |
| `asset_issuer` | character varying(56) | YES |  |
| `status` | character varying(20) | YES | `'pending'::character varying` |
| `sponsor_public_key` | character varying(56) | NO |  |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `claimed_at` | timestamp without time zone | YES |  |
| `expires_at` | timestamp without time zone | YES |  |
| `notification_sent` | boolean | YES | `false` |
| `notification_sent_at` | timestamp without time zone | YES |  |
| `claim_instructions` | text | YES |  |
| `updated_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |

### clawback_audit_logs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('clawback_audit_logs_id_seq'::regclass)` |
| `transaction_hash` | character varying(64) | NO |  |
| `asset_code` | character varying(12) | NO |  |
| `amount` | numeric(20,7) | NO |  |
| `from_account` | character varying(56) | NO |  |
| `issuer_account` | character varying(56) | NO |  |
| `reason` | text | YES |  |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |

### contract_event_index_state

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('contract_event_index_state_id_seq'::regclass)` |
| `state_key` | text | NO |  |
| `last_ledger_sequence` | bigint | NO | `0` |
| `updated_at` | timestamp with time zone | NO | `now()` |

### contract_events

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('contract_events_id_seq'::regclass)` |
| `event_id` | text | NO |  |
| `contract_id` | text | NO |  |
| `event_type` | text | NO |  |
| `payload` | jsonb | NO | `'{}'::jsonb` |
| `ledger_sequence` | bigint | NO |  |
| `tx_hash` | text | YES |  |
| `created_at` | timestamp with time zone | NO | `now()` |
| `category` | text | YES |  |

### contract_registry

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('contract_registry_id_seq'::regclass)` |
| `name` | character varying(100) | NO |  |
| `description` | text | YES |  |
| `network` | character varying(20) | NO | `'TESTNET'::character varying` |
| `contract_id` | character varying(255) | NO |  |
| `current_wasm_hash` | character varying(64) | NO |  |
| `version` | character varying(50) | NO | `'1.0.0'::character varying` |
| `last_upgraded_at` | timestamp with time zone | YES |  |
| `last_upgraded_by` | character varying(255) | YES |  |
| `created_at` | timestamp with time zone | NO | `now()` |

### contract_upgrade_logs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('contract_upgrade_logs_id_seq'::regclass)` |
| `registry_id` | integer | NO |  |
| `previous_wasm_hash` | character varying(64) | NO |  |
| `new_wasm_hash` | character varying(64) | NO |  |
| `status` | character varying(30) | NO | `'pending'::character varying` |
| `simulation_result` | jsonb | YES |  |
| `tx_hash` | character varying(255) | YES |  |
| `migration_steps` | jsonb | NO | `'[]'::jsonb` |
| `initiated_by` | character varying(255) | NO |  |
| `notes` | text | YES |  |
| `error_message` | text | YES |  |
| `created_at` | timestamp with time zone | NO | `now()` |
| `completed_at` | timestamp with time zone | YES |  |

### db_deadlock_history

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('db_deadlock_history_id_seq'::regclass)` |
| `detected_at` | timestamp with time zone | NO | `now()` |
| `pid1` | integer | YES |  |
| `pid2` | integer | YES |  |
| `relation` | text | YES |  |
| `query1` | text | YES |  |
| `query2` | text | YES |  |
| `resolved` | boolean | NO | `false` |
| `notes` | text | YES |  |

### db_pool_health

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('db_pool_health_id_seq'::regclass)` |
| `total_conns` | integer | NO |  |
| `idle_conns` | integer | NO |  |
| `waiting_clients` | integer | NO | `0` |
| `recorded_at` | timestamp with time zone | NO | `now()` |

### db_pool_utilisation

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('db_pool_utilisation_id_seq'::regclass)` |
| `sampled_at` | timestamp with time zone | NO | `now()` |
| `total_conns` | integer | NO | `0` |
| `active_conns` | integer | NO | `0` |
| `idle_conns` | integer | NO | `0` |
| `waiting_conns` | integer | NO | `0` |
| `max_conns` | integer | NO | `0` |
| `utilisation_pct` | numeric(5,2) | YES | `
CASE
    WHEN (max_conns > 0) THEN round((((active_conns)::numeric / (max_conns)::numeric) * (100)::numeric), 2)
    ELSE (0)::numeric
END` |

### db_query_plan_cache

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('db_query_plan_cache_id_seq'::regclass)` |
| `query_hash` | text | NO |  |
| `query_text` | text | NO |  |
| `plan_calls` | bigint | NO | `0` |
| `plan_resets` | bigint | NO | `0` |
| `last_plan_reset` | timestamp with time zone | YES |  |
| `recorded_at` | timestamp with time zone | NO | `now()` |

### db_query_stats

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('db_query_stats_id_seq'::regclass)` |
| `endpoint` | text | NO |  |
| `query_hash` | text | NO |  |
| `execution_ms` | integer | NO |  |
| `rows_returned` | integer | NO | `0` |
| `cache_hit` | boolean | NO | `false` |
| `recorded_at` | timestamp with time zone | NO | `now()` |

### email_delivery_logs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `message_id` | text | NO |  |
| `email` | text | NO |  |
| `status` | text | NO |  |
| `provider` | text | NO |  |
| `bounce_type` | text | YES |  |
| `bounce_reason` | text | YES |  |
| `retry_count` | integer | YES | `0` |
| `retry_scheduled_at` | timestamp without time zone | YES |  |
| `metadata` | jsonb | YES | `'{}'::jsonb` |
| `created_at` | timestamp without time zone | NO | `now()` |
| `updated_at` | timestamp without time zone | NO | `now()` |

### employee_trustlines

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('employee_trustlines_id_seq'::regclass)` |
| `employee_id` | integer | NO |  |
| `wallet_address` | character varying(56) | NO |  |
| `asset_code` | character varying(12) | NO | `'ORGUSD'::character varying` |
| `asset_issuer` | character varying(56) | NO |  |
| `status` | character varying(20) | NO | `'none'::character varying` |
| `last_checked_at` | timestamp without time zone | YES | `now()` |
| `created_at` | timestamp without time zone | YES | `now()` |
| `updated_at` | timestamp without time zone | YES | `now()` |

### employees

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('employees_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `first_name` | character varying(100) | NO |  |
| `last_name` | character varying(100) | NO |  |
| `email` | character varying(255) | NO |  |
| `wallet_address` | character varying(56) | YES |  |
| `status` | character varying(20) | YES | `'active'::character varying` |
| `position` | character varying(100) | YES |  |
| `department` | character varying(100) | YES |  |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `deleted_at` | timestamp without time zone | YES |  |
| `phone` | character varying(20) | YES |  |
| `job_title` | character varying(100) | YES |  |
| `hire_date` | date | YES |  |
| `date_of_birth` | date | YES |  |
| `address_line1` | character varying(255) | YES |  |
| `address_line2` | character varying(255) | YES |  |
| `city` | character varying(100) | YES |  |
| `state_province` | character varying(100) | YES |  |
| `postal_code` | character varying(20) | YES |  |
| `country` | character varying(100) | YES |  |
| `emergency_contact_name` | character varying(200) | YES |  |
| `emergency_contact_phone` | character varying(20) | YES |  |
| `withdrawal_preference` | character varying(50) | YES | `'bank'::character varying` |
| `bank_name` | character varying(100) | YES |  |
| `bank_account_number` | character varying(50) | YES |  |
| `bank_routing_number` | character varying(50) | YES |  |
| `mobile_money_provider` | character varying(50) | YES |  |
| `mobile_money_account` | character varying(50) | YES |  |
| `notes` | text | YES |  |
| `base_salary` | numeric(20,7) | YES | `0` |
| `base_currency` | character varying(12) | YES | `'USDC'::character varying` |
| `search_vector` | tsvector | YES | `(((((((setweight(to_tsvector('english'::regconfig, (COALESCE(first_name, ''::character varying))::text), 'A'::"char") \|\| setweight(to_tsvector('english'::regconfig, (COALESCE(last_name, ''::character varying))::text), 'A'::"char")) \|\| setweight(to_tsvector('english'::regconfig, (COALESCE(email, ''::character varying))::text), 'B'::"char")) \|\| setweight(to_tsvector('english'::regconfig, (COALESCE("position", ''::character varying))::text), 'C'::"char")) \|\| setweight(to_tsvector('english'::regconfig, (COALESCE(department, ''::character varying))::text), 'C'::"char")) \|\| setweight(to_tsvector('english'::regconfig, (COALESCE(job_title, ''::character varying))::text), 'C'::"char")) \|\| setweight(to_tsvector('english'::regconfig, (COALESCE(base_currency, ''::character varying))::text), 'C'::"char")) \|\| setweight(to_tsvector('english'::regconfig, (COALESCE(phone, ''::character varying))::text), 'D'::"char"))` |
| `locale` | character varying(10) | YES | `'en'::character varying` |
| `email_status` | text | YES | `'valid'::text` |
| `email_invalid_reason` | text | YES |  |

### in_app_notifications

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `user_id` | integer | NO |  |
| `type` | character varying(100) | NO |  |
| `title` | character varying(255) | NO |  |
| `message` | text | NO |  |
| `payload` | jsonb | YES |  |
| `read` | boolean | YES | `false` |
| `read_at` | timestamp with time zone | YES |  |
| `created_at` | timestamp with time zone | YES | `now()` |
| `updated_at` | timestamp with time zone | YES | `now()` |

### invalid_emails

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `email` | text | NO |  |
| `reason` | text | NO |  |
| `flagged_at` | timestamp without time zone | NO | `now()` |
| `created_at` | timestamp without time zone | NO | `now()` |

### invites

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('invites_id_seq'::regclass)` |
| `token` | character varying(128) | NO |  |
| `organization_id` | integer | NO |  |
| `role` | character varying(32) | NO | `'EMPLOYEE'::character varying` |
| `expires_at` | timestamp with time zone | NO |  |
| `used_at` | timestamp with time zone | YES |  |
| `used_by_wallet_address` | character varying(255) | YES |  |
| `created_at` | timestamp with time zone | NO | `now()` |

### multisig_configs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('multisig_configs_id_seq'::regclass)` |
| `issuer_public_key` | character varying(56) | NO |  |
| `low_threshold` | integer | NO | `1` |
| `med_threshold` | integer | NO | `2` |
| `high_threshold` | integer | NO | `3` |
| `master_weight` | integer | NO | `1` |
| `configured_at` | timestamp with time zone | YES | `now()` |
| `configured_by` | character varying(256) | YES |  |

### multisig_signers

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('multisig_signers_id_seq'::regclass)` |
| `config_id` | integer | NO |  |
| `signer_public_key` | character varying(56) | NO |  |
| `weight` | integer | NO | `1` |
| `added_at` | timestamp with time zone | YES | `now()` |

### notification_configs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('notification_configs_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `email_enabled` | boolean | YES | `true` |
| `push_enabled` | boolean | YES | `false` |
| `email_provider` | character varying(20) | NO | `'resend'::character varying` |
| `from_email` | character varying(255) | NO |  |
| `from_name` | character varying(255) | NO |  |
| `locale` | character varying(10) | YES | `'en'::character varying` |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |

### notifications

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('notifications_id_seq'::regclass)` |
| `transaction_id` | integer | NO |  |
| `employee_id` | integer | NO |  |
| `organization_id` | integer | NO |  |
| `notification_type` | character varying(20) | NO |  |
| `status` | character varying(20) | NO |  |
| `message_id` | character varying(255) | YES |  |
| `error_message` | text | YES |  |
| `sent_at` | timestamp without time zone | YES |  |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |

### orchestration_records

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO |  |
| `organization_id` | integer | NO |  |
| `kind` | text | NO |  |
| `reference` | text | NO |  |
| `status` | text | NO |  |
| `data` | jsonb | NO | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |

### org_audit_log

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('org_audit_log_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `change_type` | character varying(50) | NO |  |
| `config_key` | character varying(100) | YES |  |
| `old_value` | jsonb | YES |  |
| `new_value` | jsonb | YES |  |
| `actor_id` | integer | YES |  |
| `actor_email` | character varying(255) | YES |  |
| `actor_ip` | inet | YES |  |
| `created_at` | timestamp with time zone | NO | `now()` |

### org_query_throughput

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | bigint | NO | `nextval('org_query_throughput_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `window_start` | timestamp with time zone | NO |  |
| `window_end` | timestamp with time zone | NO |  |
| `query_count` | bigint | NO | `0` |
| `error_count` | bigint | NO | `0` |
| `avg_latency_ms` | numeric(10,3) | YES |  |
| `p95_latency_ms` | numeric(10,3) | YES |  |
| `recorded_at` | timestamp with time zone | NO | `now()` |

### organizations

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('organizations_id_seq'::regclass)` |
| `name` | character varying(255) | NO |  |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `tenant_id` | integer | YES |  |
| `public_key` | character varying(56) | YES |  |
| `deleted_at` | timestamp without time zone | YES |  |
| `issuer_account` | character varying(56) | YES |  |

### payroll_audit_logs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('payroll_audit_logs_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `payroll_run_id` | integer | YES |  |
| `payroll_item_id` | integer | YES |  |
| `action` | character varying(50) | NO |  |
| `actor_type` | character varying(20) | NO |  |
| `actor_id` | character varying(255) | YES |  |
| `actor_email` | character varying(255) | YES |  |
| `employee_id` | integer | YES |  |
| `tx_hash` | character varying(64) | YES |  |
| `stellar_ledger` | integer | YES |  |
| `amount` | numeric(20,7) | YES |  |
| `asset_code` | character varying(12) | YES |  |
| `old_status` | character varying(20) | YES |  |
| `new_status` | character varying(20) | YES |  |
| `metadata` | jsonb | YES | `'{}'::jsonb` |
| `error_message` | text | YES |  |
| `ip_address` | character varying(45) | YES |  |
| `user_agent` | text | YES |  |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |

### payroll_items

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('payroll_items_id_seq'::regclass)` |
| `payroll_run_id` | integer | NO |  |
| `employee_id` | integer | NO |  |
| `item_type` | character varying(20) | NO |  |
| `amount` | numeric(20,7) | NO |  |
| `description` | text | YES |  |
| `tx_hash` | character varying(64) | YES |  |
| `status` | character varying(20) | YES | `'pending'::character varying` |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `metadata` | text | YES |  |
| `bonus_type` | character varying(50) | YES | `NULL::character varying` |
| `performance_score` | numeric(5,2) | YES | `NULL::numeric` |

### payroll_runs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('payroll_runs_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `batch_id` | character varying(64) | NO |  |
| `status` | character varying(20) | YES | `'draft'::character varying` |
| `period_start` | date | NO |  |
| `period_end` | date | NO |  |
| `total_base_amount` | numeric(20,7) | YES | `0` |
| `total_bonus_amount` | numeric(20,7) | YES | `0` |
| `total_amount` | numeric(20,7) | YES | `0` |
| `asset_code` | character varying(12) | NO | `'XLM'::character varying` |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `processed_at` | timestamp without time zone | YES |  |

### payroll_schedules

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('payroll_schedules_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `name` | character varying(255) | NO |  |
| `frequency` | character varying(20) | NO |  |
| `cron_expression` | character varying(100) | NO |  |
| `timezone` | character varying(100) | NO | `'UTC'::character varying` |
| `asset_code` | character varying(12) | NO | `'XLM'::character varying` |
| `is_active` | boolean | NO | `true` |
| `last_run_at` | timestamp with time zone | YES |  |
| `next_run_at` | timestamp with time zone | YES |  |
| `missed_runs_count` | integer | NO | `0` |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |

### push_tokens

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('push_tokens_id_seq'::regclass)` |
| `employee_id` | integer | NO |  |
| `token` | character varying(512) | NO |  |
| `platform` | character varying(20) | NO |  |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |

### report_access_policies

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `agent_id` | uuid | NO |  |
| `name` | character varying(255) | NO |  |
| `description` | text | YES |  |
| `rules` | jsonb | NO |  |
| `row_level_security` | jsonb | YES |  |
| `created_at` | timestamp with time zone | YES | `now()` |
| `updated_at` | timestamp with time zone | YES | `now()` |

### report_agents

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `organization_id` | integer | NO |  |
| `agent_id` | character varying(255) | NO |  |
| `name` | character varying(255) | NO |  |
| `description` | text | YES |  |
| `query_type` | character varying(50) | NO |  |
| `output_schema` | jsonb | NO |  |
| `input_filters` | jsonb | YES |  |
| `created_by` | integer | NO |  |
| `created_at` | timestamp with time zone | YES | `now()` |
| `updated_at` | timestamp with time zone | YES | `now()` |

### report_delivery_configs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `agent_id` | uuid | NO |  |
| `channel` | character varying(50) | NO |  |
| `enabled` | boolean | YES | `true` |
| `config` | jsonb | NO |  |
| `retry_policy` | jsonb | YES |  |
| `created_at` | timestamp with time zone | YES | `now()` |
| `updated_at` | timestamp with time zone | YES | `now()` |

### report_delivery_logs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `execution_id` | uuid | NO |  |
| `channel` | character varying(50) | NO |  |
| `recipient` | character varying(255) | YES |  |
| `status` | character varying(50) | NO |  |
| `error_message` | text | YES |  |
| `attempt_count` | integer | YES | `1` |
| `next_retry_at` | timestamp with time zone | YES |  |
| `delivered_at` | timestamp with time zone | YES |  |
| `created_at` | timestamp with time zone | YES | `now()` |
| `updated_at` | timestamp with time zone | YES | `now()` |

### report_executions

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `agent_id` | uuid | NO |  |
| `organization_id` | integer | NO |  |
| `status` | character varying(50) | NO | `'PENDING'::character varying` |
| `filters` | jsonb | YES |  |
| `started_at` | timestamp with time zone | NO | `now()` |
| `completed_at` | timestamp with time zone | YES |  |
| `error_message` | text | YES |  |
| `row_count` | integer | YES |  |
| `file_size` | integer | YES |  |
| `file_path` | character varying(1000) | YES |  |
| `executed_by` | integer | NO |  |
| `created_at` | timestamp with time zone | YES | `now()` |
| `updated_at` | timestamp with time zone | YES | `now()` |

### report_results

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `execution_id` | uuid | NO |  |
| `format` | character varying(50) | NO |  |
| `data` | jsonb | YES |  |
| `summary` | jsonb | NO |  |
| `metadata` | jsonb | NO |  |
| `checksum` | character varying(64) | YES |  |
| `created_at` | timestamp with time zone | YES | `now()` |

### sep31_cross_border_transactions

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('sep31_cross_border_transactions_id_seq'::regclass)` |
| `organization_id` | integer | YES |  |
| `sender_public_key` | character varying(56) | NO |  |
| `anchor_domain` | character varying(255) | NO |  |
| `anchor_transaction_id` | character varying(255) | YES |  |
| `stellar_transaction_id` | character varying(128) | YES |  |
| `hop_ledger` | jsonb | NO | `'[]'::jsonb` |
| `status` | character varying(64) | YES |  |
| `request_payload` | jsonb | YES |  |
| `anchor_response_init` | jsonb | YES |  |
| `anchor_response_latest` | jsonb | YES |  |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |

### social_identities

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('social_identities_id_seq'::regclass)` |
| `user_id` | integer | NO |  |
| `provider` | character varying(50) | NO |  |
| `provider_id` | character varying(255) | NO |  |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |

### tax_reports

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('tax_reports_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `employee_id` | integer | YES |  |
| `transaction_id` | integer | YES |  |
| `tax_rule_id` | integer | NO |  |
| `gross_amount` | numeric(20,7) | NO |  |
| `tax_amount` | numeric(20,7) | NO |  |
| `net_amount` | numeric(20,7) | NO |  |
| `period_start` | date | YES |  |
| `period_end` | date | YES |  |
| `generated_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |

### tax_rules

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('tax_rules_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `name` | character varying(255) | NO |  |
| `type` | character varying(20) | NO |  |
| `value` | numeric(20,7) | NO |  |
| `description` | text | YES |  |
| `is_active` | boolean | YES | `true` |
| `priority` | integer | YES | `0` |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |

### tenant_configurations

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('tenant_configurations_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `config_key` | character varying(100) | NO |  |
| `config_value` | jsonb | NO |  |
| `description` | text | YES |  |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |

### transaction_audit_logs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('transaction_audit_logs_id_seq'::regclass)` |
| `tx_hash` | character varying(64) | NO |  |
| `ledger_sequence` | bigint | NO |  |
| `stellar_created_at` | timestamp without time zone | NO |  |
| `envelope_xdr` | text | NO |  |
| `result_xdr` | text | NO |  |
| `source_account` | character varying(56) | NO |  |
| `fee_charged` | bigint | NO |  |
| `operation_count` | integer | NO |  |
| `memo` | text | YES |  |
| `successful` | boolean | NO |  |
| `created_at` | timestamp without time zone | YES | `now()` |
| `metadata` | jsonb | YES |  |

### transactions

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('transactions_id_seq'::regclass)` |
| `organization_id` | integer | NO |  |
| `employee_id` | integer | YES |  |
| `tx_hash` | character varying(64) | NO |  |
| `amount` | numeric(20,7) | NO |  |
| `asset_code` | character varying(12) | NO |  |
| `status` | character varying(20) | YES | `'pending'::character varying` |
| `transaction_type` | character varying(20) | YES | `'payment'::character varying` |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `search_vector` | tsvector | YES | `((setweight(to_tsvector('english'::regconfig, (COALESCE(tx_hash, ''::character varying))::text), 'A'::"char") \|\| setweight(to_tsvector('english'::regconfig, (COALESCE(asset_code, ''::character varying))::text), 'B'::"char")) \|\| setweight(to_tsvector('english'::regconfig, (COALESCE(status, ''::character varying))::text), 'C'::"char"))` |

### users

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('users_id_seq'::regclass)` |
| `email` | character varying(255) | YES |  |
| `name` | character varying(255) | YES |  |
| `role` | character varying(50) | YES | `'EMPLOYEE'::character varying` |
| `wallet_address` | character varying(56) | YES |  |
| `organization_id` | integer | YES |  |
| `totp_secret` | character varying(255) | YES |  |
| `is_2fa_enabled` | boolean | YES | `false` |
| `recovery_codes` | text[] | YES |  |
| `created_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp without time zone | YES | `CURRENT_TIMESTAMP` |
| `refresh_token` | text | YES |  |
| `password_hash` | text | YES |  |
| `failed_login_attempts` | integer | NO | `0` |
| `locked_until` | timestamp without time zone | YES |  |
| `email_verified` | boolean | NO | `false` |
| `verification_token` | character varying(128) | YES |  |
| `verification_token_expires_at` | timestamp without time zone | YES |  |

### wallets

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `organization_id` | integer | NO |  |
| `employee_id` | integer | YES |  |
| `wallet_address` | character varying(56) | NO |  |
| `wallet_type` | character varying(20) | NO | `'employee'::character varying` |
| `asset_code` | character varying(12) | NO | `'XLM'::character varying` |
| `asset_issuer` | character varying(56) | NO | `''::character varying` |
| `balance` | numeric(20,7) | NO | `0` |
| `is_active` | boolean | NO | `true` |
| `is_frozen` | boolean | NO | `false` |
| `last_synced_at` | timestamp with time zone | YES |  |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |

### webhook_delivery_logs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('webhook_delivery_logs_id_seq'::regclass)` |
| `subscription_id` | text | NO |  |
| `event_type` | text | NO |  |
| `payload` | jsonb | NO |  |
| `response_status` | integer | YES |  |
| `response_body` | text | YES |  |
| `error_message` | text | YES |  |
| `attempt_number` | integer | NO | `1` |
| `delivered_at` | timestamp with time zone | YES | `CURRENT_TIMESTAMP` |

### webhook_event_types

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | integer | NO | `nextval('webhook_event_types_id_seq'::regclass)` |
| `name` | text | NO |  |
| `description` | text | NO |  |
| `category` | text | NO |  |
| `example_payload` | jsonb | YES |  |
| `created_at` | timestamp with time zone | YES | `CURRENT_TIMESTAMP` |

### webhook_subscriptions

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | text | NO |  |
| `organization_id` | integer | NO |  |
| `url` | text | NO |  |
| `secret` | text | NO |  |
| `events` | text[] | NO | `ARRAY['*'::text]` |
| `is_active` | boolean | NO | `true` |
| `created_at` | timestamp with time zone | YES | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp with time zone | YES | `CURRENT_TIMESTAMP` |

<!-- END:GENERATED-SCHEMA -->
