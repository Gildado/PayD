import { BulkExportDetectionAgent } from '../bulkExportDetectionAgent';

describe('BulkExportDetectionAgent', () => {
  it('fires on bulk volume (true positive)', async () => {
    const agent = new BulkExportDetectionAgent({
      bulkVolumeThreshold: 1000,
    });

    const anomalies = await agent.evaluate({
      jobId: 'export-1',
      userId: 'user-1',
      recordCount: 5000,
      exportType: 'csv',
      timestamp: Date.now(),
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].reason).toBe('bulk_volume');
    expect(anomalies[0].severity).toBe('critical');
  });

  it('does not fire on normal export (true negative)', async () => {
    const agent = new BulkExportDetectionAgent({
      bulkVolumeThreshold: 10_000,
      oversizedThreshold: 50_000,
    });

    const anomalies = await agent.evaluate({
      jobId: 'export-2',
      userId: 'user-1',
      recordCount: 100,
      exportType: 'csv',
      timestamp: Date.now(),
    });

    expect(anomalies).toHaveLength(0);
  });

  it('fires on frequent exports (true positive)', async () => {
    const agent = new BulkExportDetectionAgent({
      frequentExportCountThreshold: 3,
      frequentExportWindowMs: 3_600_000,
    });

    const now = Date.now();
    const results: number[] = [];
    for (let i = 0; i < 3; i++) {
      const anomalies = await agent.evaluate({
        jobId: `export-freq-${i}`,
        userId: 'user-exfil',
        recordCount: 50,
        exportType: 'json',
        timestamp: now + i * 60_000,
      });
      results.push(anomalies.length);
    }

    // Third export should trigger frequent-export alert
    expect(results[2]).toBeGreaterThan(0);
  });

  it('fires on oversized export (true positive)', async () => {
    const agent = new BulkExportDetectionAgent({
      bulkVolumeThreshold: 100_000,
      oversizedThreshold: 10_000,
    });

    const anomalies = await agent.evaluate({
      jobId: 'export-big',
      userId: 'user-1',
      recordCount: 25_000,
      exportType: 'csv',
      timestamp: Date.now(),
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].reason).toBe('oversized_export');
    expect(anomalies[0].severity).toBe('warning');
  });
});
