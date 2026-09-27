# Backup Restore Drill

PayD mainnet readiness requires proving that a backup can be restored, not only that `pg_dump` can create a file.

## Drill Procedure

1. Create or locate a custom-format backup produced by the migration runner.
2. Create an isolated restore database, for example `payd_restore_drill_YYYYMMDD`.
3. Restore the dump with `pg_restore --clean --if-exists --no-owner --no-privileges`.
4. Run integrity checks against the source and restored databases:
   - public table count must match,
   - check and foreign-key constraints must validate,
   - critical table row counts must match for `employees`, `payroll_runs`, `payroll_items`, and `users`.
5. Record the result in the backup verification log or incident tracker.
6. Drop the isolated restore database after evidence is captured.

## Code Support

`src/db/backupRestoreDrill.ts` contains the restore command builder and integrity-check routine used by the drill. The command builder intentionally uses `execFile` arguments instead of shell pipelines so backup paths and credentials are not interpolated into a shell command.

Example command shape:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges \
  --host db.example.com --port 5432 --username payd \
  --dbname payd_restore_drill_20260926 \
  /var/backups/payd/pre-migration.dump
```

The drill is successful only when restore completes and all integrity checks pass. A created backup file without a successful restore does not satisfy the launch-readiness requirement.
