import { TaxWithholdingAnomalyDetectionAgent } from '../taxWithholdingAnomalyDetectionAgent.js';
import type { DeductionResult } from '../taxService.js';

describe('TaxWithholdingAnomalyDetectionAgent (#1199)', () => {
  let agent: TaxWithholdingAnomalyDetectionAgent;

  beforeEach(() => {
    agent = new TaxWithholdingAnomalyDetectionAgent({ tolerance: 0.01, maxPercentageRate: 50 });
  });

  it('detects a withheld amount that deviates from its percentage rule (True Positive)', async () => {
    const result: DeductionResult = {
      gross_amount: 1000,
      deductions: [
        {
          rule_id: 1,
          rule_name: 'Withholding',
          type: 'percentage',
          rule_value: 10,
          deducted_amount: 150,
        },
      ],
      total_tax: 150,
      net_amount: 850,
    };

    const anomalies = await agent.evaluateDeductions({ result, organizationId: 3 });

    expect(anomalies.some((a) => a.reason === 'withholding_miscalculation')).toBe(true);
    const miscalculation = anomalies.find((a) => a.reason === 'withholding_miscalculation');
    expect(miscalculation?.severity).toBe('critical');
    expect(miscalculation?.metadata.expectedAmount).toBe(100);
    expect(miscalculation?.organizationId).toBe(3);
  });

  it('does not fire for a correctly calculated withholding (True Negative)', async () => {
    const result: DeductionResult = {
      gross_amount: 1000,
      deductions: [
        {
          rule_id: 1,
          rule_name: 'Withholding',
          type: 'percentage',
          rule_value: 10,
          deducted_amount: 100,
        },
        {
          rule_id: 2,
          rule_name: 'Levy',
          type: 'fixed',
          rule_value: 5,
          deducted_amount: 5,
        },
      ],
      total_tax: 105,
      net_amount: 895,
    };

    const anomalies = await agent.evaluateDeductions({ result });

    expect(anomalies).toHaveLength(0);
  });
});
