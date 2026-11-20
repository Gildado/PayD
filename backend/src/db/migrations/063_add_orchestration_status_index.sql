-- Migration 063: support the boot-time in-flight workflow scan.
-- Recovery queries all organizations by status; the existing index starts with
-- organization_id and kind, so add a covering index for the status scan.
CREATE INDEX IF NOT EXISTS idx_orchestration_records_status_updated
  ON orchestration_records (status, updated_at ASC);
