import { ReportFixture, ReportSchema, ReportExecution, ReportResult, AccessPolicy } from '../../reportSchema.js';

/**
 * Golden dataset fixtures for regression testing
 */
export const reportFixtures = {
  /**
   * Payroll Summary Report Fixture
   */
  payrollSummary: {
    name: 'Payroll Summary Report',
    description: 'Summary of payroll transactions for a date range',
    queryType: 'PAYROLL',
    filters: {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      organizationId: 1,
    },
    expectedRowCount: 150,
    expectedSchema: {
      id: 'string',
      organizationId: 'number',
      employeeId: 'number',
      employeeName: 'string',
      employeeEmail: 'string',
      amount: 'string',
      assetCode: 'string',
      status: 'string',
      timestamp: 'string',
    },
    sampleOutput: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        organizationId: 1,
        employeeId: 101,
        employeeName: 'John Doe',
        employeeEmail: 'john@example.com',
        amount: '5000.00',
        assetCode: 'USDC',
        status: 'success',
        timestamp: '2024-01-15T10:30:00Z',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        organizationId: 1,
        employeeId: 102,
        employeeName: 'Jane Smith',
        employeeEmail: 'jane@example.com',
        amount: '4500.00',
        assetCode: 'USDC',
        status: 'success',
        timestamp: '2024-01-15T10:35:00Z',
      },
    ],
  } as ReportFixture,

  /**
   * Audit Log Report Fixture
   */
  auditLog: {
    name: 'Audit Log Report',
    description: 'Audit trail of system actions and transactions',
    queryType: 'AUDIT',
    filters: {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      organizationId: 1,
    },
    expectedRowCount: 500,
    expectedSchema: {
      id: 'string',
      action: 'string',
      actorType: 'string',
      actorId: 'string',
      resourceType: 'string',
      resourceId: 'string',
      status: 'string',
      timestamp: 'string',
    },
    sampleOutput: [
      {
        id: '660e8400-e29b-41d4-a716-446655440000',
        action: 'PAYROLL_CREATED',
        actorType: 'USER',
        actorId: '1',
        resourceType: 'PAYROLL_RUN',
        resourceId: '501',
        status: 'SUCCESS',
        timestamp: '2024-01-01T09:00:00Z',
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440001',
        action: 'PAYROLL_EXECUTED',
        actorType: 'SYSTEM',
        actorId: 'system',
        resourceType: 'PAYROLL_RUN',
        resourceId: '501',
        status: 'SUCCESS',
        timestamp: '2024-01-01T10:00:00Z',
      },
    ],
  } as ReportFixture,

  /**
   * Transaction Detail Report Fixture
   */
  transactionDetail: {
    name: 'Transaction Detail Report',
    description: 'Detailed transaction information',
    queryType: 'TRANSACTIONS',
    filters: {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      organizationId: 1,
    },
    expectedRowCount: 350,
    expectedSchema: {
      txHash: 'string',
      employeeId: 'number',
      employeeName: 'string',
      amount: 'string',
      assetCode: 'string',
      status: 'string',
      timestamp: 'string',
      batchId: 'string',
      memo: 'string',
    },
    sampleOutput: [
      {
        txHash: 'aa4f8cac1dd6acb0797eb3c2ac688f27a2f7c8d8a2f7c8d8',
        employeeId: 101,
        employeeName: 'John Doe',
        amount: '5000.00',
        assetCode: 'USDC',
        status: 'success',
        timestamp: '2024-01-15T10:30:00Z',
        batchId: 'batch_001',
        memo: 'Monthly Payroll',
      },
    ],
  } as ReportFixture,

  /**
   * Custom Report Fixture
   */
  customReport: {
    name: 'Custom Report',
    description: 'User-defined custom report',
    queryType: 'CUSTOM',
    filters: {
      organizationId: 1,
      customFilter: 'value',
    },
    expectedRowCount: 100,
    expectedSchema: {
      id: 'string',
      value: 'number',
      category: 'string',
    },
    sampleOutput: [
      {
        id: '1',
        value: 100,
        category: 'A',
      },
    ],
  } as ReportFixture,
};

/**
 * Mock Report Schema for testing
 */
export const mockReportSchema: ReportSchema = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  organizationId: 1,
  agentId: 'agent_payroll_summary',
  name: 'Payroll Summary',
  description: 'Test payroll summary report',
  queryType: 'PAYROLL',
  outputSchema: {
    id: 'string',
    organizationId: 'number',
    employeeId: 'number',
    amount: 'string',
    status: 'string',
  },
  filters: {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  createdBy: 1,
};

/**
 * Mock Report Execution for testing
 */
export const mockReportExecution: ReportExecution = {
  id: '660e8400-e29b-41d4-a716-446655440000',
  reportId: '550e8400-e29b-41d4-a716-446655440000',
  status: 'COMPLETED',
  startedAt: new Date('2024-01-01T10:00:00Z'),
  completedAt: new Date('2024-01-01T10:05:00Z'),
  rowCount: 150,
  fileSize: 50000,
  filePath: '/reports/report_001.csv',
  executedBy: 1,
};

/**
 * Mock Report Result for testing
 */
export const mockReportResult: ReportResult = {
  executionId: '660e8400-e29b-41d4-a716-446655440000',
  format: 'JSON',
  data: reportFixtures.payrollSummary.sampleOutput,
  summary: {
    totalRecords: 150,
    processedRecords: 150,
    failedRecords: 0,
    generatedAt: new Date(),
    generatedBy: 1,
  },
  metadata: {
    version: '1.0',
    schema: 'payroll_summary_v1',
    checksum: 'abc123def456',
  },
};

/**
 * Mock Access Policy for testing
 */
export const mockAccessPolicy: AccessPolicy = {
  id: '770e8400-e29b-41d4-a716-446655440000',
  reportId: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Payroll Manager Access',
  description: 'Access policy for payroll managers',
  rules: [
    {
      type: 'ROLE_BASED',
      value: 'MANAGER',
      action: 'ALLOW',
      fields: ['id', 'employeeId', 'amount', 'status'],
    },
    {
      type: 'ROLE_BASED',
      value: 'EMPLOYEE',
      action: 'DENY',
    },
  ],
  rowLevelSecurity: {
    enabled: true,
    filters: [
      {
        column: 'organizationId',
        operator: '=',
        value: '${organizationId}',
      },
    ],
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Test data for SQL injection detection
 */
export const sqlInjectionTests = [
  {
    query: "SELECT * FROM employees WHERE id = '1' OR '1'='1'",
    shouldDetect: true,
    description: 'Basic OR injection',
  },
  {
    query: "SELECT * FROM employees; DROP TABLE employees;--",
    shouldDetect: true,
    description: 'DROP TABLE injection',
  },
  {
    query: "SELECT * FROM employees WHERE name LIKE '%'; EXEC sp_executesql;--",
    shouldDetect: true,
    description: 'Stored procedure execution',
  },
  {
    query: 'SELECT * FROM employees WHERE id = ?',
    shouldDetect: false,
    description: 'Safe parameterized query',
  },
];

/**
 * Test data for PII detection
 */
export const piiDetectionTests = [
  {
    data: { email: 'john.doe@example.com', name: 'John Doe' },
    shouldDetect: ['EMAIL', 'NAME'],
    description: 'Email and name detection',
  },
  {
    data: { phone: '555-123-4567', ssn: '123-45-6789' },
    shouldDetect: ['PHONE', 'SSN'],
    description: 'Phone and SSN detection',
  },
  {
    data: { address: '123 Main Street, Apt 4B' },
    shouldDetect: ['ADDRESS'],
    description: 'Address detection',
  },
];
