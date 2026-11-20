-- Migration 062: Extend orchestration_records.kind for the payroll approval,
-- payroll audit/rollback, anchor cash-out, and bulk payment status workflows.
-- The original CHECK from 061 only allowed the appeal/reward kinds, so the new
-- durable workflows could not persist their records.
ALTER TABLE orchestration_records
  DROP CONSTRAINT IF EXISTS orchestration_records_kind_check;

ALTER TABLE orchestration_records
  ADD CONSTRAINT orchestration_records_kind_check
  CHECK (
    kind IN (
      'freeze-appeal',
      'contributor-reward',
      'payroll-approval',
      'payroll-audit-rollback',
      'anchor-cashout',
      'bulk-payment-status'
    )
  );
