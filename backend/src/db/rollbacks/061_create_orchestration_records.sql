-- Rollback 061: Removes workflow review history and staged payout envelopes.
-- Only roll back after reconciling all pending payouts and appeal reviews.
DROP TABLE IF EXISTS orchestration_records;
