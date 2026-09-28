-- Webhook Event Types Table (for tracking available events)
CREATE TABLE IF NOT EXISTS webhook_event_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    example_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default event types
INSERT INTO webhook_event_types (name, description, category, example_payload) VALUES
('payroll.completed', 'Fired when a payroll run completes successfully', 'payroll', '{"payrollRunId": 123, "batchId": "batch_abc", "totalAmount": "10000.00", "employeeCount": 50}'),
('payroll.failed', 'Fired when a payroll run fails', 'payroll', '{"payrollRunId": 123, "batchId": "batch_abc", "errorMessage": "Insufficient funds", "failedCount": 5}'),
('payroll.started', 'Fired when a payroll run starts', 'payroll', '{"payrollRunId": 123, "batchId": "batch_abc", "scheduledDate": "2024-01-15"}'),
('employee.added', 'Fired when a new employee is added', 'employee', '{"employeeId": 456, "name": "John Doe", "email": "john@example.com", "position": "Developer"}'),
('employee.updated', 'Fired when an employee profile is updated', 'employee', '{"employeeId": 456, "changes": {"position": "Senior Developer"}, "updatedBy": "admin@example.com"}'),
('employee.removed', 'Fired when an employee is removed', 'employee', '{"employeeId": 456, "reason": "Termination", "removedBy": "admin@example.com"}'),
('balance.low', 'Fired when account balance falls below threshold', 'balance', '{"accountId": "GABC...", "currentBalance": "100.00", "threshold": "500.00", "assetCode": "USDC"}'),
('transaction.completed', 'Fired when a transaction is confirmed', 'transaction', '{"txHash": "abc123...", "amount": "1000.00", "assetCode": "USDC", "from": "GABC...", "to": "GDEF..."}'),
('transaction.failed', 'Fired when a transaction fails', 'transaction', '{"txHash": "abc123...", "errorMessage": "Insufficient balance", "amount": "1000.00"}'),
('contract.upgraded', 'Fired when a smart contract is upgraded', 'contract', '{"contractId": "CDemo...", "oldVersion": "1.0.0", "newVersion": "1.1.0", "upgradedBy": "admin@example.com"}'),
('multisig.created', 'Fired when a multi-signature setup is created', 'multisig', '{"configId": 789, "threshold": 2, "signers": ["GABC...", "GDEF..."]}'),
('multisig.executed', 'Fired when a multi-signature transaction is executed', 'multisig', '{"configId": 789, "txHash": "abc123...", "signers": ["GABC...", "GDEF..."]}')
ON CONFLICT (name) DO NOTHING;
