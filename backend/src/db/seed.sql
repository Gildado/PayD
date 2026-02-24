-- Seed data for testing search and filtering

-- Insert test organization
INSERT INTO organizations (name) VALUES ('Acme Corp') ON CONFLICT DO NOTHING;

-- Insert test employees
INSERT INTO employees (organization_id, first_name, last_name, email, wallet_address, status, position, department)
VALUES
  (1, 'John', 'Doe', 'john.doe@acme.com', 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1', 'active', 'Software Engineer', 'Engineering'),
  (1, 'Jane', 'Smith', 'jane.smith@acme.com', 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2', 'active', 'Product Manager', 'Product'),
  (1, 'Bob', 'Johnson', 'bob.johnson@acme.com', 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX3', 'inactive', 'Designer', 'Design'),
  (1, 'Alice', 'Williams', 'alice.williams@acme.com', 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX4', 'active', 'DevOps Engineer', 'Engineering'),
  (1, 'Charlie', 'Brown', 'charlie.brown@acme.com', 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX5', 'pending', 'Marketing Manager', 'Marketing')
ON CONFLICT (email) DO NOTHING;

-- Insert test transactions
INSERT INTO transactions (organization_id, employee_id, tx_hash, amount, asset_code, status, transaction_type)
VALUES
  (1, 1, 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567890abcdef12', 1000.50, 'USDC', 'completed', 'payment'),
  (1, 2, 'def456ghi789jkl012mno345pqr678stu901vwx234yz567890abcdef123456789', 2500.75, 'USDC', 'completed', 'payment'),
  (1, 1, 'ghi789jkl012mno345pqr678stu901vwx234yz567890abcdef1234567890abcd', 500.00, 'USDC', 'pending', 'payment'),
  (1, 3, 'jkl012mno345pqr678stu901vwx234yz567890abcdef1234567890abcdef12345', 750.25, 'XLM', 'failed', 'payment'),
  (1, 4, 'mno345pqr678stu901vwx234yz567890abcdef1234567890abcdef123456789ab', 3000.00, 'USDC', 'completed', 'bonus')
ON CONFLICT (tx_hash) DO NOTHING;

-- Insert test tax rules
INSERT INTO tax_rules (organization_id, name, type, value, description, priority)
VALUES
  (1, 'Federal Income Tax', 'percentage', 22.0000000, 'Standard federal income tax rate', 0),
  (1, 'State Tax', 'percentage', 5.0000000, 'State income tax', 1),
  (1, 'Health Insurance', 'fixed', 150.0000000, 'Monthly health insurance deduction', 2)
ON CONFLICT DO NOTHING;

-- Verify data
SELECT 'Organizations:' as info, COUNT(*) as count FROM organizations;
SELECT 'Employees:' as info, COUNT(*) as count FROM employees;
SELECT 'Transactions:' as info, COUNT(*) as count FROM transactions;
SELECT 'Tax Rules:' as info, COUNT(*) as count FROM tax_rules;
