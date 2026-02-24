-- Migration 010: Add salary and currency to employees
-- Supports tracking base salary and currency for payroll processing

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS base_salary DECIMAL(20, 7) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_currency VARCHAR(12) DEFAULT 'USDC';

-- Update search vector to include currency
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
ALTER TABLE employees DROP COLUMN IF EXISTS search_vector;

ALTER TABLE employees
  ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(first_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(last_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(email, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(position, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(department, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(job_title, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(base_currency, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(phone, '')), 'D')
  ) STORED;

-- Recreate trigger
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add index for currency
CREATE INDEX IF NOT EXISTS idx_employees_base_currency ON employees(base_currency);
