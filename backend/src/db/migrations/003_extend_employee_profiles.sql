-- Extend employees table with richer profile fields
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS job_title VARCHAR(100),
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state_province VARCHAR(100),
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS withdrawal_preference VARCHAR(50) DEFAULT 'bank' CHECK (withdrawal_preference IN ('bank', 'mobile_money', 'crypto')),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_routing_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS mobile_money_provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS mobile_money_account VARCHAR(50),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update search vector to include new fields
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
    setweight(to_tsvector('english', coalesce(phone, '')), 'D')
  ) STORED;

-- Recreate trigger
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_employees_job_title ON employees(job_title);
CREATE INDEX IF NOT EXISTS idx_employees_hire_date ON employees(hire_date);
CREATE INDEX IF NOT EXISTS idx_employees_withdrawal_preference ON employees(withdrawal_preference);

-- Update existing employees with default withdrawal preference if null
UPDATE employees SET withdrawal_preference = 'bank' WHERE withdrawal_preference IS NULL;
