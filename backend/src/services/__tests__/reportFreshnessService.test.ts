import {
  computeReportFreshness,
  deriveLastGeneratedAtFromTimestamps,
  DEFAULT_FRESHNESS_THRESHOLDS,
} from '../reportFreshnessService.js';
import {
  REPORT_FIXTURE_TRANSACTIONS,
  FIXTURE_EXPECTED,
  FIXTURE_BASE_TIMESTAMP,
} from './fixtures/reportAgentFixture.js';

describe('ReportFreshnessService (#1337)', () => {
  const now = new Date('2024-03-01T15:05:00.000Z'); // 5 min after newest fixture row

  describe('computeReportFreshness', () => {
    it('reports fresh within the fresh threshold', () => {
      const report = computeReportFreshness({
        reportId: 'payroll-history',
        lastGeneratedAt: new Date('2024-03-01T15:04:30.000Z'), // 30s old
        now,
      });

      expect(report.status).toBe('fresh');
      expect(report.indicator.tone).toBe('success');
      expect(report.ageMs).toBe(30_000);
    });

    it('reports stale between the fresh and stale thresholds', () => {
      const report = computeReportFreshness({
        reportId: 'payroll-history',
        lastGeneratedAt: new Date('2024-03-01T10:00:00.000Z'), // ~5h old
        now,
      });

      expect(report.status).toBe('stale');
      expect(report.indicator.tone).toBe('warning');
      expect(report.indicator.label).toBe('Stale');
    });

    it('reports expired beyond the stale threshold', () => {
      const report = computeReportFreshness({
        reportId: 'payroll-history',
        lastGeneratedAt: new Date('2023-01-01T00:00:00.000Z'),
        now,
      });

      expect(report.status).toBe('expired');
      expect(report.indicator.tone).toBe('danger');
    });

    it('reports expired with null age when no data exists', () => {
      const report = computeReportFreshness({
        reportId: 'payroll-history',
        lastGeneratedAt: null,
        now,
      });

      expect(report.status).toBe('expired');
      expect(report.lastGeneratedAt).toBeNull();
      expect(report.ageMs).toBeNull();
      expect(report.indicator.label).toBe('No data');
    });

    it('honors custom thresholds', () => {
      const report = computeReportFreshness({
        reportId: 'payroll-history',
        lastGeneratedAt: new Date('2024-03-01T14:50:00.000Z'), // 15 min old
        now,
        thresholds: { freshWithinMs: 30 * 60_000, staleWithinMs: 60 * 60_000 },
      });

      expect(report.status).toBe('fresh');
      expect(report.thresholds.freshWithinMs).toBe(30 * 60_000);
      expect(report.thresholds.staleWithinMs).toBe(60 * 60_000);
    });

    it('emits a stable schema against known fixture output', () => {
      const report = computeReportFreshness({
        reportId: 'payroll-history-fixture',
        lastGeneratedAt: FIXTURE_EXPECTED.lastGeneratedAtIso,
        now,
      });

      expect(report.schemaVersion).toBe('1.0');
      expect(report.reportId).toBe('payroll-history-fixture');
      expect(report.evaluatedAt).toBe(now.toISOString());
      expect(report.lastGeneratedAt).toBe(FIXTURE_EXPECTED.lastGeneratedAtIso);
      expect(report.ageMs).toBe(5 * 60_000);
      expect(Object.keys(report).sort()).toEqual(
        [
          'ageMs',
          'evaluatedAt',
          'indicator',
          'lastGeneratedAt',
          'reportId',
          'schemaVersion',
          'status',
          'thresholds',
        ].sort()
      );
    });
  });

  describe('deriveLastGeneratedAtFromTimestamps', () => {
    it('picks the newest unix-seconds timestamp from fixture transactions', () => {
      const derived = deriveLastGeneratedAtFromTimestamps(
        REPORT_FIXTURE_TRANSACTIONS.map((tx) => tx.timestamp)
      );

      expect(derived?.toISOString()).toBe(FIXTURE_EXPECTED.lastGeneratedAtIso);
      expect(derived?.getTime()).toBe((FIXTURE_BASE_TIMESTAMP + 18000) * 1000);
    });

    it('returns null for empty or invalid input', () => {
      expect(deriveLastGeneratedAtFromTimestamps([])).toBeNull();
      expect(deriveLastGeneratedAtFromTimestamps([null, undefined])).toBeNull();
      expect(deriveLastGeneratedAtFromTimestamps(['not-a-date'])).toBeNull();
    });
  });

  it('exposes sane default thresholds', () => {
    expect(DEFAULT_FRESHNESS_THRESHOLDS.freshWithinMs).toBeLessThan(
      DEFAULT_FRESHNESS_THRESHOLDS.staleWithinMs
    );
  });
});
