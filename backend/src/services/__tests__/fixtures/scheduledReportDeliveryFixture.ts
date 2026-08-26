// Fixture data for ScheduledReportDeliveryAgent tests.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_ORG_ID = 50;

export interface FixtureJobRecord {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  organizationPublicKey: string;
  batchId: string;
  kind: 'excel' | 'csv';
  filePath?: string;
  error?: string;
  contentType?: string;
  filename?: string;
  startDate?: string;
  endDate?: string;
  columns?: Array<{ key: string; label: string }>;
}

const NOW = Date.now();
const HOUR_AGO = NOW - 60 * 60 * 1000;
const TWO_HOURS_AGO = NOW - 2 * 60 * 60 * 1000;

export const FIXTURE_JOBS: FixtureJobRecord[] = [
  // Completed jobs
  {
    id: 'job-1',
    status: 'completed',
    createdAt: TWO_HOURS_AGO,
    organizationPublicKey: 'ORG_KEY_1',
    batchId: 'batch-1',
    kind: 'excel',
    filePath: '/tmp/payd-payroll-job-1.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: 'payroll-batch-batch-1.xlsx',
  },
  {
    id: 'job-2',
    status: 'completed',
    createdAt: HOUR_AGO,
    organizationPublicKey: 'ORG_KEY_1',
    batchId: 'csv-job-2',
    kind: 'csv',
    filePath: '/tmp/payd-payroll-job-2.csv',
    contentType: 'text/csv',
    filename: 'payroll-export-job-2.csv',
  },
  // Processing job
  {
    id: 'job-3',
    status: 'processing',
    createdAt: NOW - 30 * 60 * 1000,
    organizationPublicKey: 'ORG_KEY_1',
    batchId: 'batch-3',
    kind: 'excel',
  },
  // Pending job
  {
    id: 'job-4',
    status: 'pending',
    createdAt: NOW - 5 * 60 * 1000,
    organizationPublicKey: 'ORG_KEY_1',
    batchId: 'batch-4',
    kind: 'excel',
  },
  // Failed job
  {
    id: 'job-5',
    status: 'failed',
    createdAt: NOW - 45 * 60 * 1000,
    organizationPublicKey: 'ORG_KEY_1',
    batchId: 'batch-5',
    kind: 'excel',
    error: 'Batch not found or empty',
  },
  // CSV job with date range
  {
    id: 'job-6',
    status: 'completed',
    createdAt: NOW - 2 * 60 * 60 * 1000,
    organizationPublicKey: 'ORG_KEY_2',
    batchId: 'csv-job-6',
    kind: 'csv',
    filePath: '/tmp/payd-payroll-job-6.csv',
    startDate: '2024-01-01',
    endDate: '2024-06-30',
  },
];

export const FIXTURE_EXPECTED = {
  totalJobs: 6,
  completedJobs: 3,
  failedJobs: 1,
  processingJobs: 1,
  pendingJobs: 1,
  successRate: Math.round((3 / 5) * 10000) / 100, // 60% (only completed+failed count as finished)
  excelJobs: 4,
  csvJobs: 2,
  org1Jobs: 5,
  org2Jobs: 1,
} as const;
