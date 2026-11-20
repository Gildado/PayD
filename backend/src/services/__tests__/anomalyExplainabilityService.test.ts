import { jest } from '@jest/globals';
import { generateReport } from '../anomalyExplainabilityService.js';

describe('AnomalyExplainabilityService (#1216)', () => {
  it('generates a report with summary and explanation', () => {
    const report = generateReport({
      rule: 'large_amount',
      orgId: 'org-1',
      subject: 'payment-42',
      observedValue: 5000000,
      threshold: 1000000,
      direction: 'above',
      detectedAt: new Date().toISOString(),
    });

    expect(report.id).toBeTruthy();
    expect(report.summary).toContain('large_amount');
    expect(report.summary).toContain('payment-42');
    expect(report.explanation).toContain('org-1');
    expect(report.factors.length).toBeGreaterThanOrEqual(4);
  });

  it('includes recommendation based on rule', () => {
    const report = generateReport({
      rule: 'large_amount',
      orgId: 'org-1',
      subject: 'payment-1',
      observedValue: 2000,
      threshold: 1000,
      direction: 'above',
      detectedAt: new Date().toISOString(),
    });
    expect(report.recommendation).toContain('Verify');
  });

  it('includes context factors when provided', () => {
    const report = generateReport({
      rule: 'statistical_outlier',
      orgId: 'org-1',
      subject: 'payment-1',
      observedValue: 100000,
      threshold: 4,
      direction: 'above',
      context: { rollingMean: 500, rollingStd: 20 },
      detectedAt: new Date().toISOString(),
    });
    const contextFactors = report.factors.filter((f) => f.factor === 'rollingMean');
    expect(contextFactors.length).toBe(1);
  });

  it('handles unknown rules gracefully', () => {
    const report = generateReport({
      rule: 'unknown_rule',
      orgId: 'org-1',
      subject: 'x',
      observedValue: 1,
      threshold: 0,
      direction: 'above',
      detectedAt: new Date().toISOString(),
    });
    expect(report.explanation).toContain('unknown_rule');
    expect(report.recommendation).toBeTruthy();
  });
});
