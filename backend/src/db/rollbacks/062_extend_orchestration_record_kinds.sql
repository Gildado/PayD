-- Rollback for 062_extend_orchestration_record_kinds.sql
-- Note: This reintroduces the old CHECK and may fail if records of the new
-- kinds exist. Roll back only after ensuring those workflows are drained.
ALTER TABLE orchestration_records
  DROP CONSTRAINT IF EXISTS orchestration_records_kind_check;

ALTER TABLE orchestration_records
  ADD CONSTRAINT orchestration_records_kind_check
  CHECK (kind IN ('freeze-appeal', 'contributor-reward'));
