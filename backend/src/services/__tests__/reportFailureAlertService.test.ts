import { jest } from '@jest/globals';
import { ReportFailureAlertService } from '../reportFailureAlertService.js';
import {
  buildSyntheticDataset,
  FIXTURE_EXPECTED,
  REPORT_FIXTURE_TRANSACTIONS,
} from './fixtures/reportAgentFixture.js';

function aggregateFixture(): Record<string, unknown> {
  return {
    totalTransactions: REPORT_FIXTURE_TRANSACTIONS.length,
    successfulTransactions: REPORT_FIXTURE_TRANSACTIONS.filter(
      (tx) => tx.successful
    ).length,
  };
}

describe('ReportFailureAlertService (#1338)', () => {
  const context = { reportId: 'payroll-history', organizationId: 42 };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the agent report on success against the fixture dataset', async () => {
    const service = new ReportFailureAlertService({ alertThreshold: 2 });
    const result = await service.executeWithFallback(
      async () => aggregateFixture(),
      context
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe('agent');
      expect(result.report.totalTransactions).toBe(
        FIXTURE_EXPECTED.totalTransactions
      );
      expect(result.report.successfulTransactions).toBe(
        FIXTURE_EXPECTED.successfulTransactions
      );
    }
    expect(service.getFailureSummary(context)).toEqual({});
  });

  it('falls back to manual export with no alert on first failure', async () => {
    const alerts: unknown[] = [];
    const service = new ReportFailureAlertService({
      alertThreshold: 2,
      onAlert: (alert) => {
        alerts.push(alert);
      },
    });

    const result = await service.executeWithFallback(
      async () => {
        throw new Error('ledger timeout');
      },
      context
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.source).toBe('manual-export-fallback');
      expect(result.error.message).toBe('ledger timeout');
      expect(result.alert).toBeNull();
      expect(result.fallback.action).toBe('manual-export');
      expect(result.fallback.entryPoint).toBe('/reports/custom');
    }
    expect(alerts).toHaveLength(0);
    expect(service.getFailureSummary(context)).toEqual({
      'payroll-history:42': 1,
    });
  });

  it('raises a warning alert at the threshold and critical when doubled', async () => {
    const alerts: Array<{ severity: string; consecutiveFailures: number }> = [];
    const service = new ReportFailureAlertService({
      alertThreshold: 2,
      onAlert: (alert) => {
        alerts.push({
          severity: alert.severity,
          consecutiveFailures: alert.consecutiveFailures,
        });
      },
    });
    const fail = () =>
      service.executeWithFallback(
        async () => Promise.reject(new Error('boom')),
        context
      );

    await fail(); // count 1 — no alert
    await fail(); // count 2 — warning
    await fail(); // count 3 — still warning
    await fail(); // count 4 — critical

    expect(alerts.map((a) => a.severity)).toEqual([
      'warning',
      'warning',
      'critical',
    ]);
    expect(alerts[0].consecutiveFailures).toBe(2);
    expect(alerts[2].consecutiveFailures).toBe(4);
  });

  it('resets the failure counter after a success and isolates per report', async () => {
    const service = new ReportFailureAlertService({ alertThreshold: 2 });
    const fail = () =>
      service.executeWithFallback(async () => Promise.reject(new Error('x')), context);

    await fail();
    await fail();

    // A different report id keeps its own counter.
    await service.executeWithFallback(
      async () => Promise.reject(new Error('other')),
      { reportId: 'benchmark', organizationId: 42 }
    );

    const success = await service.executeWithFallback(
      async () => buildSyntheticDataset(3),
      context
    );
    expect(success.ok).toBe(true);
    expect(service.getFailureSummary(context)).toEqual({});
    expect(Object.keys(service.getFailureSummary())).toEqual(['benchmark:42']);

    service.reset();
    expect(service.getFailureSummary()).toEqual({});
  });
});
