-- Rollback 062: Restore the original workflow kind constraint without deleting workflow history.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM orchestration_records
    WHERE kind IN (
      'contract-upgrade-proposal',
      'revenue-split-distribution',
      'revenue-split-recipients',
      'vesting-release-notification',
      'workflow-notification-delivery'
    )
  ) THEN
    RAISE EXCEPTION 'Cannot roll back workflow kinds while workflow records remain.';
  END IF;
END;
$$;

ALTER TABLE orchestration_records
  DROP CONSTRAINT IF EXISTS orchestration_records_kind_check;

ALTER TABLE orchestration_records
  ADD CONSTRAINT orchestration_records_kind_check CHECK (
    kind IN ('freeze-appeal', 'contributor-reward')
  );