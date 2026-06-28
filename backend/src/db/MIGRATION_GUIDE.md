# PayD Database Migration Guide

> **Canonical reference for all contributors who work with the database layer.**
> Keep this document up to date whenever the migration workflow changes.

---

## Table of Contents

1. [The Golden Rule](#1-the-golden-rule)
2. [How the Migration Runner Works](#2-how-the-migration-runner-works)
3. [How to Create a New Migration](#3-how-to-create-a-new-migration)
4. [How to Create a Rollback File](#4-how-to-create-a-rollback-file)
5. [The Re-Sequencing Script](#5-the-re-sequencing-script)
6. [Troubleshooting](#6-troubleshooting)
7. [PR Checklist for Migration Authors](#7-pr-checklist-for-migration-authors)
8. [Quick Reference](#8-quick-reference)

---

## 1. The Golden Rule

> ### ⛔ Never edit a migration file after it has been committed to `main`.

A migration file is **immutable from the moment it is merged**. The runner stores a SHA-256 checksum of every file it applies. If that file's bytes ever change — even a single added space or comment — the runner will detect the mismatch and abort:

```
[migrate] DRIFT DETECTED: "017_create_schema_migrations.sql" was previously
applied with checksum abc123... but the file now has checksum def456...
Aborting to protect database integrity.
```

**If you need to alter the database schema, always create a new migration file** with the next available number. Never modify an existing one.

---

## 2. How the Migration Runner Works

The runner lives at `backend/src/db/migrate.ts`. Here is what it does on every invocation:

```
Start
  │
  ├─ 1. Connect to DATABASE_URL
  ├─ 2. Bootstrap schema_migrations table (CREATE TABLE IF NOT EXISTS)
  ├─ 3. Read all *.sql files from migrations/ — sorted lexicographically
  ├─ 4. Guard: assert no two files share the same numeric prefix  ◄── NEW
  ├─ 5. Fetch already-applied set from schema_migrations
  │
  └─ For each migration file:
       ├─ Already applied?
       │    ├─ Checksum matches? → SKIP (safe)
       │    └─ Checksum differs? → ABORT (drift detected)
       └─ Not applied?
            └─ Execute SQL in SERIALIZABLE transaction
               └─ On success: record (filename, checksum, execution_ms)
               └─ On error:   ROLLBACK → re-throw → exit 1
```

### Key Properties

| Property | Behaviour |
|---|---|
| **Sort order** | Strict lexicographic on filename. `001_` always runs before `002_`, etc. |
| **Idempotency** | Already-applied files are silently skipped. Safe to re-run at any time. |
| **Atomicity** | Each migration runs in its own `SERIALIZABLE` transaction. Partial failure leaves the DB unchanged. |
| **Checksum guard** | SHA-256 of the file's byte content. Any change to an applied file causes immediate abort. |
| **Duplicate guard** | Runner aborts at startup if any two files share the same numeric prefix. |

---

## 3. How to Create a New Migration

### Step 1 — Find the next available number

```bash
# List the current highest number in use
ls backend/src/db/migrations/*.sql \
  | sed 's/.*\///' \
  | grep -oP '^\d+' \
  | sort -n \
  | tail -1
# Example output: 038
# Your new migration should be: 039
```

### Step 2 — Create the migration file

Name it: `NNN_short_description_of_change.sql` — use zero-padded, three-digit numbers.

```
backend/src/db/migrations/039_add_tax_region_to_employees.sql
```

### Step 3 — Write the SQL

Follow these rules inside the file:

- **Start with a header comment** explaining the purpose and any design decisions.
- **Use `IF NOT EXISTS` / `IF EXISTS`** on every DDL statement to keep the file idempotent.
- **Use uppercase** for SQL keywords (`ALTER TABLE`, `ADD COLUMN`, `CREATE INDEX`).
- **Use lowercase** for all identifiers (table names, column names, index names).
- **End index names with the table and column** they cover (e.g., `idx_employees_tax_region`).

```sql
-- =============================================================================
-- Migration 039: Add tax_region column to employees
-- Purpose : Allow per-employee tax region overrides for multi-jurisdiction payroll.
-- Design  : VARCHAR(10) covers all ISO 3166-2 region codes with room to spare.
-- =============================================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS tax_region VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_employees_tax_region
  ON employees (tax_region)
  WHERE tax_region IS NOT NULL;
```

### Step 4 — Create the matching rollback file (required)

See [Section 4](#4-how-to-create-a-rollback-file). **Your PR will not be approved without it.**

### Step 5 — Test locally before pushing

```bash
cd backend

# Dry-run: confirm the file is detected and valid
npm run db:migrate:dry-run

# Live run on your local dev database
npm run db:migrate
```

### Step 6 — Verify idempotency

Run the migration a second time. It must complete with `Applied: 0, Skipped: N`. If it errors, you have a non-idempotent DDL statement — fix it before committing.

---

## 4. How to Create a Rollback File

Every migration **must** have a corresponding rollback file in `backend/src/db/rollbacks/`. The filenames must match exactly.

| Migration | Rollback |
|---|---|
| `migrations/039_add_tax_region_to_employees.sql` | `rollbacks/039_add_tax_region_to_employees.sql` |

### What to write in a rollback

The rollback is the **exact inverse** of the migration. Drop what the migration added, in reverse order.

```sql
-- =============================================================================
-- Rollback 039: Undo "Add tax_region column to employees"
-- Pairs with : 039_add_tax_region_to_employees.sql
-- Warning    : This will permanently delete all stored tax_region values.
-- =============================================================================

DROP INDEX IF EXISTS idx_employees_tax_region;

ALTER TABLE employees
  DROP COLUMN IF EXISTS tax_region;
```

### Rollback commands

```bash
cd backend

# Roll back the most recently applied migration
npx ts-node src/db/migrate.ts --rollback

# Roll back the last 3 migrations
npx ts-node src/db/migrate.ts --rollback 3

# Dry-run a rollback
npx ts-node src/db/migrate.ts --rollback --dry-run
```

---

## 5. The Re-Sequencing Script

Located at `scripts/resequence-migrations.mjs` (repo root).

### When to use it

Run this script **only when** the migrations directory has developed duplicate or out-of-order numeric prefixes — typically when two PRs were merged that both created migrations with the same number.

The migration runner will self-diagnose this condition and tell you to run the script:

```
[migrate] FATAL: Duplicate migration prefix(es) detected.
[migrate]   Prefix "018_" shared by:
[migrate]     - 018_create_social_identities.sql
[migrate]     - 018_create_webhook_subscriptions.sql
[migrate] Fix: run the re-sequencing script from the repo root:
[migrate]   node scripts/resequence-migrations.mjs --dry-run
[migrate]   node scripts/resequence-migrations.mjs
```

### How the script works

1. Reads all `*.sql` files from both `migrations/` and `rollbacks/`, sorting them **lexicographically** (identical to the runner's sort).
2. Assigns new monotonic numbers `001, 002, 003…` to each file in that order.
3. Preserves the descriptive stem of every filename exactly — **zero SQL content is changed**.
4. Validates the full rename map for conflicts before touching any file.
5. Executes all renames using a two-phase temp-name strategy (safe on case-insensitive file systems).
6. Verifies the result: no duplicates, no gaps.

### Usage

```bash
# From the repository root:

# Step 1 — preview what will change (no files touched)
node scripts/resequence-migrations.mjs --dry-run

# Step 2 — execute the renames
node scripts/resequence-migrations.mjs

# Step 3 — commit the result
git add backend/src/db/migrations/ backend/src/db/rollbacks/
git commit -m "chore(db): re-sequence migrations to eliminate duplicates"
git push
```

### After running the script

After re-sequencing, every contributor must re-normalise their local git index for SQL files (required once because of the `.gitattributes` LF rule):

```bash
git add --renormalize backend/src/db/
```

---

## 6. Troubleshooting

### `DRIFT DETECTED` error

**Symptom:**
```
[migrate] DRIFT DETECTED: "NNN_some_migration.sql" was previously applied
with checksum <old> but the file now has checksum <new>.
```

**Cause:** The content of an already-applied migration file was modified.

**Fix:**
1. Use `git log -p -- backend/src/db/migrations/NNN_some_migration.sql` to find when the file changed.
2. Use `git revert` or `git checkout <last-clean-commit> -- backend/src/db/migrations/NNN_some_migration.sql` to restore the original content.
3. Create a **new** migration file with the next available number for any schema changes you intended.

---

### `FATAL: Duplicate migration prefix(es) detected`

**Symptom:**
```
[migrate] FATAL: Duplicate migration prefix(es) detected.
[migrate]   Prefix "026_" shared by:
[migrate]     - 026_add_password_hash_to_users.sql
[migrate]     - 026_create_payroll_schedules.sql
```

**Cause:** Two migration files have the same numeric prefix.

**Fix:**
```bash
node scripts/resequence-migrations.mjs --dry-run   # preview
node scripts/resequence-migrations.mjs             # execute
```

---

### `Missing rollback file` error

**Symptom:**
```
Error: Missing rollback file for "038_add_metadata_to_transaction_audit_logs.sql".
Expected: .../rollbacks/038_add_metadata_to_transaction_audit_logs.sql
```

**Cause:** A rollback was attempted but no matching file exists in `rollbacks/`.

**Fix:** Create the rollback SQL file (see [Section 4](#4-how-to-create-a-rollback-file)).

---

### Line-ending / checksum drift on Windows

**Symptom:** Migrations that pass on Linux CI fail on a Windows developer's machine (or vice versa) with a checksum mismatch, despite the file appearing unchanged.

**Cause:** git's `core.autocrlf` setting converted LF↔CRLF silently.

**Fix:** The `.gitattributes` file now enforces `eol=lf` for all `*.sql` files. Run this once to re-normalise tracked files:

```bash
git add --renormalize .
git commit -m "chore: renormalise SQL file line endings to LF"
```

---

## 7. PR Checklist for Migration Authors

Copy this into your PR description when your PR includes a migration:

```markdown
### Database Migration Checklist

- [ ] Migration file follows naming convention: `NNN_short_description.sql`
- [ ] Migration number is the next available number (no duplicates with existing files)
- [ ] Migration header comment explains purpose and design decisions
- [ ] All DDL uses `IF NOT EXISTS` / `IF EXISTS` for idempotency
- [ ] Matching rollback file created in `backend/src/db/rollbacks/`
- [ ] Rollback reverses the migration cleanly (drop what was added, in reverse order)
- [ ] `npm run db:migrate:dry-run` passes locally
- [ ] `npm run db:migrate` applies cleanly on a fresh database
- [ ] Running `npm run db:migrate` a second time shows `Applied: 0, Skipped: N` (idempotency verified)
- [ ] No existing migration file was modified (new file only)
```

---

## 8. Quick Reference

```bash
# Apply all pending migrations
cd backend && npm run db:migrate

# Dry-run (preview only, no DB changes)
cd backend && npm run db:migrate:dry-run

# Roll back the last applied migration
cd backend && npx ts-node src/db/migrate.ts --rollback

# Roll back N migrations
cd backend && npx ts-node src/db/migrate.ts --rollback <N>

# Find the next available migration number
ls backend/src/db/migrations/*.sql | sed 's/.*\///' | grep -oP '^\d+' | sort -n | tail -1

# Check for duplicate prefixes
ls backend/src/db/migrations/*.sql | sed 's/.*\///' | grep -oP '^\d+' | sort | uniq -d

# Check for sequence gaps
ls backend/src/db/migrations/*.sql | sed 's/.*\///' | grep -oP '^\d+' | \
  awk 'NR>1 && $1 != prev+1 { print "GAP after " prev } { prev=$1 }'

# Re-sequence the migrations directory (dry-run)
node scripts/resequence-migrations.mjs --dry-run

# Re-sequence the migrations directory (live)
node scripts/resequence-migrations.mjs

# Renormalise line endings after .gitattributes change
git add --renormalize backend/src/db/
```
