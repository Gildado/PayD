// Fixture data for CsvPdfExportEnhancementAgent tests.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_ORG_ID = 51;

export interface FixtureExportRecord {
  id: string;
  organizationPublicKey: string;
  format: 'csv' | 'excel' | 'pdf';
  columns: string[];
  timestamp: number;
  rowCount: number;
  fileSize: number;
  status: 'success' | 'failed';
}

export const FIXTURE_EXPORTS = [
  { id: 'exp-1', organizationPublicKey: 'ORG_KEY_1', format: 'csv' as const, columns: ['txHash', 'employeeId', 'amount', 'status', 'timestamp'], timestamp: Date.now() - 86400000, rowCount: 150, fileSize: 4200, status: 'success' as const },
  { id: 'exp-2', organizationPublicKey: 'ORG_KEY_1', format: 'excel' as const, columns: ['txHash', 'employeeId', 'payrollBatchId', 'amount', 'assetCode', 'status', 'timestamp', 'memo'], timestamp: Date.now() - 72000000, rowCount: 320, fileSize: 18500, status: 'success' as const },
  { id: 'exp-3', organizationPublicKey: 'ORG_KEY_1', format: 'pdf' as const, columns: ['txHash', 'employeeId', 'amount', 'status'], timestamp: Date.now() - 50000000, rowCount: 50, fileSize: 95000, status: 'success' as const },
  { id: 'exp-4', organizationPublicKey: 'ORG_KEY_1', format: 'csv' as const, columns: ['txHash', 'amount', 'assetCode', 'timestamp'], timestamp: Date.now() - 36000000, rowCount: 80, fileSize: 2100, status: 'success' as const },
  { id: 'exp-5', organizationPublicKey: 'ORG_KEY_1', format: 'csv' as const, columns: ['txHash', 'employeeId', 'amount', 'status', 'timestamp', 'description'], timestamp: Date.now() - 10000000, rowCount: 200, fileSize: 5800, status: 'failed' as const },
  { id: 'exp-6', organizationPublicKey: 'ORG_KEY_2', format: 'excel' as const, columns: ['txHash', 'employeeId', 'payrollBatchId', 'amount', 'assetCode', 'status', 'timestamp', 'memo', 'sourceAccount', 'destAccount'], timestamp: Date.now() - 5000000, rowCount: 500, fileSize: 32000, status: 'success' as const },
];

export const FIXTURE_EXPECTED = {
  totalExports: 6,
  successfulExports: 5,
  failedExports: 1,
  csvExports: 3,
  excelExports: 2,
  pdfExports: 1,
  avgRowCount: Math.round((150 + 320 + 50 + 80 + 200 + 500) / 6),
  mostUsedColumn: 'txHash', // appears in all 6
  secondMostUsedColumn: 'amount', // appears in all 6
  thirdMostUsedColumn: 'status', // appears in 5
  org1Exports: 5,
  org2Exports: 1,
} as const;
