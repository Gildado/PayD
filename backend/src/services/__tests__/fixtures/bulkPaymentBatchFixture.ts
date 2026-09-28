// Fixture data for BulkPaymentBatchReportAgent tests.

export const FIXTURE_BATCH_ROWS = [
  { batch_id: 'batch-1', total_items: 100, successful_items: 95, failed_items: 5, asset_code: 'USDC', status: 'completed', created_at: new Date('2024-06-01T10:00:00Z') },
  { batch_id: 'batch-2', total_items: 50, successful_items: 50, failed_items: 0, asset_code: 'XLM', status: 'completed', created_at: new Date('2024-06-02T10:00:00Z') },
  { batch_id: 'batch-3', total_items: 75, successful_items: 70, failed_items: 5, asset_code: 'USDC', status: 'completed', created_at: new Date('2024-06-03T10:00:00Z') },
];

export const FIXTURE_SUMMARY_ROW = {
  total_batches: 3,
  total_items: 225,
  successful_items: 215,
  failed_items: 10,
};

export const FIXTURE_FAILURE_ROWS = [
  { id: 1, batch_id: 'batch-1', destination: 'GDEST1', amount: '100.0000000', error_message: 'insufficient balance', created_at: new Date('2024-06-01T10:00:00Z') },
  { id: 2, batch_id: 'batch-3', destination: 'GDEST2', amount: '50.0000000', error_message: 'account not found', created_at: new Date('2024-06-03T10:00:00Z') },
];

export const FIXTURE_TREND_ROWS = [
  { date: '2024-06-03', total_items: 75, successful_items: 70, failed_items: 5 },
  { date: '2024-06-02', total_items: 50, successful_items: 50, failed_items: 0 },
  { date: '2024-06-01', total_items: 100, successful_items: 95, failed_items: 5 },
];

export const FIXTURE_EXPECTED = {
  totalBatches: 3,
  totalItems: 225,
  successfulItems: 215,
  failedItems: 10,
  overallSuccessRate: Math.round((215 / 225) * 10000) / 100, // 95.56
  batch1SuccessRate: Math.round((95 / 100) * 10000) / 100, // 95
  batch2SuccessRate: 100,
  failureCount: 2,
} as const;
