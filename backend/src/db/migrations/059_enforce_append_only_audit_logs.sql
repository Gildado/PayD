-- =============================================================================
-- Migration 059: Enforce append-only audit logs at the database level
-- Purpose : Audit tables must be tamper-evident. Only org_audit_log was
--           protected (via silent no-op RULEs); audit_logs, admin_audit_log,
--           payroll_audit_logs and clawback_audit_logs accepted arbitrary
--           UPDATE/DELETE from any DB role or script.
--
--           A BEFORE UPDATE/DELETE trigger now raises an exception, so a
--           tampering attempt fails loudly instead of being silently ignored,
--           and TRUNCATE is blocked as well.
--
-- Notes   :
--   * transaction_audit_logs is intentionally excluded: the application
--     legitimately rewrites its `metadata` column (TransactionAuditService
--     .setMetadata).
--   * Referential actions from parent tables (ON DELETE SET NULL / CASCADE
--     when an organization, user, employee or payroll run is removed) run as
--     nested triggers (pg_trigger_depth() > 1) and are allowed through, so
--     deleting a parent row keeps working.
--   * org_audit_log keeps its existing RULEs.
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  -- Allow FK referential actions (SET NULL / CASCADE), which fire this
  -- trigger from inside the parent table's internal RI trigger.
  IF TG_OP <> 'TRUNCATE' AND pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Table % is append-only: % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

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
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I
           FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation()',
        t || '_append_only', t
      );
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_no_truncate', t);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE TRUNCATE ON %I
           FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_mutation()',
        t || '_no_truncate', t
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION prevent_audit_log_mutation() IS
  'Trigger function that rejects UPDATE/DELETE/TRUNCATE on append-only audit tables (FK referential actions excepted).';
