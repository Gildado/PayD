-- Add deleted_at column to employees table for soft delete support
ALTER TABLE employees ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;

-- Create index for deleted_at to optimize queries filtering active employees
CREATE INDEX idx_employees_deleted_at ON employees(deleted_at);
