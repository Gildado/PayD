# migrations/

This directory contains the SQL migration files for the PayD backend database.

## The One Rule

> **Never edit a file in this directory after it has been merged to `main`.**

The migration runner stores a SHA-256 checksum of every file it applies. Modifying
a file after it has been applied — even adding a comment — will cause the runner to
abort with a `DRIFT DETECTED` error and break the CI/CD pipeline.

**To change the database schema, always create a new file here** with the next available number.

## File Naming

```
NNN_short_description.sql
```

- `NNN` — zero-padded, three-digit integer (e.g. `001`, `039`)
- `short_description` — snake_case, describes what the migration does
- Every file **must** have a matching file in `../rollbacks/` with the exact same name

## Current File Count

Run `ls *.sql | wc -l` to see how many migrations exist.

## Find the Next Number

```bash
ls *.sql | grep -oP '^\d+' | sort -n | tail -1
# Add 1 to the result for your new migration number
```

## Full Documentation

→ See [`../MIGRATION_GUIDE.md`](../MIGRATION_GUIDE.md) for the complete workflow,
  troubleshooting guide, and PR checklist.
