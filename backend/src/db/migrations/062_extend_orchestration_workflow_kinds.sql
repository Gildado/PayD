-- Migration 062: Extend durable orchestration record kinds for contract, revenue split, and vesting workflows.
ALTER TABLE orchestration_records
  DROP CONSTRAINT IF EXISTS orchestration_records_kind_check;

ALTER TABLE orchestration_records
  ADD CONSTRAINT orchestration_records_kind_check CHECK (
    kind IN (
      'freeze-appeal',
      'contributor-reward',
      'contract-upgrade-proposal',
      'revenue-split-distribution',
      'revenue-split-recipients',
      'vesting-release-notification',
      'workflow-notification-delivery'
    )
  );