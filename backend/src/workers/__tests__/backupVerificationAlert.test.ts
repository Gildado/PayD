import {
  backupVerificationSeverity,
  sendBackupVerificationAlert,
  type VerificationResult,
} from '../backupVerificationWorker.js';

jest.mock('../../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn() })),
}));

function failedResult(): VerificationResult {
  return {
    success: false,
    backupFile: '/backups/payd.sql.gz',
    backupSize: 1024,
    testDatabase: 'payd_backup_test_1',
    checks: {
      tableCount: { expected: 10, actual: 8, passed: false },
      constraintCheck: { passed: true },
      dataIntegrity: { passed: true },
    },
    duration: 1.5,
    timestamp: new Date('2026-01-01T00:00:00Z'),
    error: 'restore failed',
  };
}

describe('backup verification failure alerts', () => {
  it('maps a failed verification to critical severity and delivers it through configured channels', async () => {
    const deliver = jest.fn().mockResolvedValue(undefined);
    const result = failedResult();

    expect(backupVerificationSeverity(result)).toBe('critical');

    const deliveries = await sendBackupVerificationAlert(result, {
      channels: [{ type: 'webhook', endpoint: 'https://alerts.example.test/hook', minSeverity: 'critical' }],
      deliver,
    });

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0][1]).toMatchObject({
      severity: 'critical',
      source: 'backupVerificationWorker',
    });
    expect(deliveries).toEqual([
      expect.objectContaining({
        channelType: 'webhook',
        success: true,
        attempts: 1,
      }),
    ]);
  });

  it('does not deliver an info-level alert to a warning-threshold channel', async () => {
    const deliver = jest.fn().mockResolvedValue(undefined);
    const result = { ...failedResult(), success: true, error: undefined };

    const deliveries = await sendBackupVerificationAlert(result, {
      channels: [{ type: 'slack', endpoint: 'https://alerts.example.test/slack' }],
      deliver,
    });

    expect(backupVerificationSeverity(result)).toBe('info');
    expect(deliver).not.toHaveBeenCalled();
    expect(deliveries).toEqual([]);
  });
});
