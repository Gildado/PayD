ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON organizations(deleted_at);
