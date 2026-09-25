import { jest } from '@jest/globals';
import { AnomalousFundMovementAlertService } from '../anomalousFundMovementAlertService.js';

function makeEvent(overrides: Partial<Parameters<AnomalousFundMovementAlertService['evaluate']>[0]> = {}) {
  return {
    contractId: 'CONTRACT_A',
    eventType: 'withdraw',
    fromAddress: 'GADDR1',
    amount: 100,
    ledgerSequence: 1000,
    ...overrides,
  };
}

describe('AnomalousFundMovementAlertService (#1621)', () => {
  it('alerts on an amount at or above the critical threshold', async () => {
    const service = new AnomalousFundMovementAlertService({ criticalAmountThreshold: 1000 });
    const alerts = await service.evaluate(makeEvent({ amount: 1000 }));

    expect(alerts).toHaveLength(1);
    expect(alerts[0].reason).toBe('large_amount');
    expect(alerts[0].severity).toBe('critical');
  });

  it('does not alert on ordinary amounts below every threshold', async () => {
    const service = new AnomalousFundMovementAlertService({ criticalAmountThreshold: 1000 });
    const alerts = await service.evaluate(makeEvent({ amount: 50 }));

    expect(alerts).toHaveLength(0);
  });

  it('flags a statistical outlier once a baseline is established', async () => {
    const service = new AnomalousFundMovementAlertService({
      criticalAmountThreshold: 1_000_000,
      minSamplesForBaseline: 5,
      outlierZScoreThreshold: 3,
    });

    for (let i = 0; i < 5; i++) {
      await service.evaluate(makeEvent({ amount: 100 + i }));
    }

    const alerts = await service.evaluate(makeEvent({ amount: 100_000 }));

    expect(alerts.some((a) => a.reason === 'statistical_outlier')).toBe(true);
  });

  it('does not flag a statistical outlier before the minimum sample count', async () => {
    const service = new AnomalousFundMovementAlertService({
      criticalAmountThreshold: 1_000_000,
      minSamplesForBaseline: 10,
      outlierZScoreThreshold: 3,
    });

    for (let i = 0; i < 3; i++) {
      await service.evaluate(makeEvent({ amount: 100 }));
    }
    const alerts = await service.evaluate(makeEvent({ amount: 100_000 }));

    expect(alerts.some((a) => a.reason === 'statistical_outlier')).toBe(false);
  });

  it('flags rapid succession of movements from the same address', async () => {
    const service = new AnomalousFundMovementAlertService({
      criticalAmountThreshold: 1_000_000,
      rapidSuccessionCountThreshold: 3,
      rapidSuccessionWindowMs: 60_000,
    });

    await service.evaluate(makeEvent());
    await service.evaluate(makeEvent());
    const alerts = await service.evaluate(makeEvent());

    expect(alerts.some((a) => a.reason === 'rapid_succession')).toBe(true);
  });

  it('does not conflate rapid succession across different addresses', async () => {
    const service = new AnomalousFundMovementAlertService({
      criticalAmountThreshold: 1_000_000,
      rapidSuccessionCountThreshold: 3,
    });

    await service.evaluate(makeEvent({ fromAddress: 'GADDR1' }));
    await service.evaluate(makeEvent({ fromAddress: 'GADDR2' }));
    const alerts = await service.evaluate(makeEvent({ fromAddress: 'GADDR3' }));

    expect(alerts.some((a) => a.reason === 'rapid_succession')).toBe(false);
  });

  it('invokes the configured onAlert handler for each raised alert', async () => {
    const onAlert = jest.fn();
    const service = new AnomalousFundMovementAlertService({
      criticalAmountThreshold: 500,
      onAlert,
    });

    await service.evaluate(makeEvent({ amount: 500 }));

    expect(onAlert).toHaveBeenCalledTimes(1);
    expect(onAlert).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'large_amount', amount: 500 })
    );
  });

  it('reset() clears rolling history so a prior outlier does not affect a fresh baseline', async () => {
    const service = new AnomalousFundMovementAlertService({
      criticalAmountThreshold: 1_000_000,
      minSamplesForBaseline: 3,
      outlierZScoreThreshold: 3,
    });

    for (let i = 0; i < 3; i++) {
      await service.evaluate(makeEvent({ amount: 100 }));
    }
    service.reset();
    for (let i = 0; i < 3; i++) {
      await service.evaluate(makeEvent({ amount: 100_000 }));
    }
    const alerts = await service.evaluate(makeEvent({ amount: 100_000 }));

    expect(alerts.some((a) => a.reason === 'statistical_outlier')).toBe(false);
  });
});
