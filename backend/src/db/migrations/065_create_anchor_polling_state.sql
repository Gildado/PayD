-- Migration 065: Create anchor_polling_state table
-- Tracks polling state for anchor transactions to enable resumable polling and timeout handling

CREATE TABLE IF NOT EXISTS anchor_polling_state (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  anchor_domain VARCHAR(255) NOT NULL,
  transaction_id VARCHAR(255) NOT NULL,
  
  -- Polling tracking
  cursor VARCHAR(1000),
  last_polled_at TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'polling', 'completed', 'failed', 'timeout')),
  
  -- Error handling
  error_message TEXT,
  
  -- Retry logic
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one polling state per org/anchor/transaction
  UNIQUE(organization_id, anchor_domain, transaction_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_anchor_polling_org_domain 
  ON anchor_polling_state(organization_id, anchor_domain);

CREATE INDEX IF NOT EXISTS idx_anchor_polling_status 
  ON anchor_polling_state(status);

CREATE INDEX IF NOT EXISTS idx_anchor_polling_next_retry 
  ON anchor_polling_state(next_retry_at) 
  WHERE status IN ('pending', 'polling') AND next_retry_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_anchor_polling_created_at 
  ON anchor_polling_state(created_at);

-- Auto-update trigger for updated_at
CREATE TRIGGER update_anchor_polling_state_updated_at 
  BEFORE UPDATE ON anchor_polling_state
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE anchor_polling_state IS 'Tracks polling state for anchor transactions, enabling resumable polling and timeout handling';
COMMENT ON COLUMN anchor_polling_state.cursor IS 'Last cursor position from anchor API for resuming polling';
COMMENT ON COLUMN anchor_polling_state.last_polled_at IS 'Timestamp of last successful poll attempt';
COMMENT ON COLUMN anchor_polling_state.status IS 'Current polling status: pending (not started), polling (in progress), completed (done), failed (error), timeout (exceeded max time)';
COMMENT ON COLUMN anchor_polling_state.error_message IS 'Error details if poll failed';
COMMENT ON COLUMN anchor_polling_state.next_retry_at IS 'When to attempt next poll (for exponential backoff)';
