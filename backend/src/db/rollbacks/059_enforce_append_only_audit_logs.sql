-- Rollback for 059_enforce_append_only_audit_logs.sql
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_logs',
    'admin_audit_log',
    'payroll_audit_logs',
    'clawback_audit_logs'
  ]
  LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_append_only', t);
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_no_truncate', t);
    END IF;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS prevent_audit_log_mutation();
