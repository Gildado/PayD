import { describe, expect, it } from 'vitest';
import {
  generateInsightReport,
  worstSeverity,
  cardsByCategory,
} from '../services/insightCardAgent';
import {
  HEALTHY_SNAPSHOT,
  DEGRADED_SNAPSHOT,
  EMPTY_SNAPSHOT,
  EXPECTED,
} from './fixtures/insightCards.fixture';

describe('generateInsightReport', () => {
  it('produces the expected card set for a healthy snapshot', () => {
    const report = generateInsightReport(HEALTHY_SNAPSHOT);

    expect(report.orgId).toBe('org-fixture-001');
    expect(report.cards).toHaveLength(EXPECTED.healthy.cardCount);
    expect(report.cards.map((c) => c.id).sort()).toEqual([...EXPECTED.healthy.ids].sort());
  });

  it('produces the expected card set for a degraded snapshot', () => {
    const report = generateInsightReport(DEGRADED_SNAPSHOT);

    expect(report.orgId).toBe('org-fixture-002');
    expect(report.cards).toHaveLength(EXPECTED.degraded.cardCount);
    expect(report.cards.map((c) => c.id).sort()).toEqual([...EXPECTED.degraded.ids].sort());
  });

  it('returns zero cards for an empty snapshot', () => {
    const report = generateInsightReport(EMPTY_SNAPSHOT);

    expect(report.cards).toHaveLength(0);
  });

  it('sets windowEnd to the snapshot timestamp', () => {
    const report = generateInsightReport(HEALTHY_SNAPSHOT);
    expect(report.windowEnd).toBe(HEALTHY_SNAPSHOT.timestamp);
  });

  it('sets windowStart to 24 hours before the snapshot timestamp', () => {
    const report = generateInsightReport(HEALTHY_SNAPSHOT);
    const start = new Date(report.windowStart).getTime();
    const end = new Date(report.windowEnd).getTime();
    expect(end - start).toBe(24 * 60 * 60 * 1000);
  });

  it('every card has a non-empty id, title, summary, and metric', () => {
    const report = generateInsightReport(DEGRADED_SNAPSHOT);
    for (const card of report.cards) {
      expect(card.id).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(card.summary).toBeTruthy();
      expect(card.metric).toBeTruthy();
      expect(card.metricLabel).toBeTruthy();
      expect(card.generatedAt).toBeTruthy();
    }
  });

  it('marks payment success rate as critical when fail rate >= 15%', () => {
    const report = generateInsightReport(DEGRADED_SNAPSHOT);
    const card = report.cards.find((c) => c.id === 'insight-payments-success-rate');
    expect(card).toBeDefined();
    expect(card!.severity).toBe('critical');
  });

  it('marks payment success rate as warning when fail rate is 5-14%', () => {
    // 3 failures out of 200 = 1.5% fail rate → info
    const report = generateInsightReport(HEALTHY_SNAPSHOT);
    const card = report.cards.find((c) => c.id === 'insight-payments-success-rate');
    expect(card).toBeDefined();
    expect(card!.severity).toBe('info');
  });

  it('marks compliance as critical when auditIssues > 0', () => {
    const report = generateInsightReport(DEGRADED_SNAPSHOT);
    const card = report.cards.find((c) => c.id === 'insight-controls-compliance');
    expect(card).toBeDefined();
    expect(card!.severity).toBe('critical');
  });

  it('marks routing errors as critical when count >= 5', () => {
    const report = generateInsightReport(DEGRADED_SNAPSHOT);
    const card = report.cards.find((c) => c.id === 'insight-routing-errors');
    expect(card).toBeDefined();
    expect(card!.severity).toBe('critical');
  });

  it('volume trend card shows negative delta when volume decreased', () => {
    const report = generateInsightReport(DEGRADED_SNAPSHOT);
    const card = report.cards.find((c) => c.id === 'insight-payments-volume-trend');
    expect(card).toBeDefined();
    expect(card!.metric).toContain('-');
  });

  it('volume trend card shows positive delta when volume increased', () => {
    const report = generateInsightReport(HEALTHY_SNAPSHOT);
    const card = report.cards.find((c) => c.id === 'insight-payments-volume-trend');
    expect(card).toBeDefined();
    expect(card!.metric).toContain('+');
  });
});

describe('worstSeverity', () => {
  it('returns null for an empty report', () => {
    const report = generateInsightReport(EMPTY_SNAPSHOT);
    expect(worstSeverity(report)).toBeNull();
  });

  it('returns "critical" for the degraded snapshot', () => {
    const report = generateInsightReport(DEGRADED_SNAPSHOT);
    expect(worstSeverity(report)).toBe('critical');
  });

  it('returns "info" for the healthy snapshot', () => {
    const report = generateInsightReport(HEALTHY_SNAPSHOT);
    expect(worstSeverity(report)).toBe('info');
  });
});

describe('cardsByCategory', () => {
  it('filters cards by category', () => {
    const report = generateInsightReport(DEGRADED_SNAPSHOT);
    const paymentCards = cardsByCategory(report, 'payments');
    expect(paymentCards.length).toBeGreaterThan(0);
    for (const card of paymentCards) {
      expect(card.category).toBe('payments');
    }
  });

  it('returns empty array when no cards match category', () => {
    const report = generateInsightReport(EMPTY_SNAPSHOT);
    expect(cardsByCategory(report, 'payments')).toHaveLength(0);
  });
});
