-- =============================================================================
-- Migration 045: Add Performance Bonus Fields to Payroll Items
-- Purpose : Extend payroll_items with bonus_type and performance_score columns
--           to support performance-based bonus calculations in the payroll engine.
--           Closes Issue #699 – Add Support for Performance Bonuses in Payroll Engine.
-- =============================================================================

-- Add bonus_type to distinguish the reason for a bonus payout
ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS bonus_type VARCHAR(50)
    DEFAULT NULL
    CHECK (bonus_type IN ('performance', 'referral', 'project', 'retention', 'spot', 'other'));

-- Add performance_score (0–100) used when bonus_type = 'performance'
ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS performance_score NUMERIC(5, 2)
    DEFAULT NULL
    CHECK (performance_score IS NULL OR (performance_score >= 0 AND performance_score <= 100));

-- Index for querying bonus items by type
CREATE INDEX IF NOT EXISTS idx_payroll_items_bonus_type
  ON payroll_items (bonus_type)
  WHERE bonus_type IS NOT NULL;

-- Index for performance score range queries (e.g. top-performer bonuses)
CREATE INDEX IF NOT EXISTS idx_payroll_items_performance_score
  ON payroll_items (performance_score DESC)
  WHERE performance_score IS NOT NULL;

COMMENT ON COLUMN payroll_items.bonus_type IS
  'Category of bonus: performance, referral, project, retention, spot, or other.';
COMMENT ON COLUMN payroll_items.performance_score IS
  'Score (0–100) used to calculate performance-based bonus amounts.';
