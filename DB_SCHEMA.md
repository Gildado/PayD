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
