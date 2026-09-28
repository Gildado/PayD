-- Rollback: 010_add_salary_to_employees
DROP INDEX IF EXISTS idx_employees_base_currency;

DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
ALTER TABLE employees DROP COLUMN IF EXISTS search_vector;

ALTER TABLE employees
  DROP COLUMN IF EXISTS base_salary,
  DROP COLUMN IF EXISTS base_currency;

-- Restore search_vector without salary columns
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

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
