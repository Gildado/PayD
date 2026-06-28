-- Rollback: 002_extend_employee_profiles
DROP INDEX IF EXISTS idx_employees_withdrawal_preference;
DROP INDEX IF EXISTS idx_employees_hire_date;
DROP INDEX IF EXISTS idx_employees_job_title;

DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
ALTER TABLE employees DROP COLUMN IF EXISTS search_vector;

ALTER TABLE employees
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS job_title,
  DROP COLUMN IF EXISTS hire_date,
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS address_line1,
  DROP COLUMN IF EXISTS address_line2,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state_province,
  DROP COLUMN IF EXISTS postal_code,
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS emergency_contact_name,
  DROP COLUMN IF EXISTS emergency_contact_phone,
  DROP COLUMN IF EXISTS withdrawal_preference,
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS bank_account_number,
  DROP COLUMN IF EXISTS bank_routing_number,
  DROP COLUMN IF EXISTS mobile_money_provider,
  DROP COLUMN IF EXISTS mobile_money_account,
  DROP COLUMN IF EXISTS notes;

-- Restore original search_vector without the dropped columns
ALTER TABLE employees
  ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(first_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(last_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(email, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(position, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(department, '')), 'C')
  ) STORED;

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
