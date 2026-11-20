/**
 * Tax Withholding Miscalculation Detection Agent.
 *
 * Flags withheld amounts that deviate from their rule, percentage rates outside
 * the configured jurisdiction bounds, and totals that do not reconcile.
 *
 * Resolves Issue #1199.
 */

import { randomUUID } from 'node:crypto';
import type { AnomalyEvent, AnomalyEventHandler } from '../types/anomalyEvent.js';
import type { DeductionResult, TaxDeduction } from './taxService.js';

export interface TaxWithholdingOptions {
  /** Absolute tolerance in currency units when comparing amounts. Default: 0.01. */
  tolerance?: number;
  /** Highest percentage rate accepted for a percentage rule. Default: 100. */
  maxPercentageRate?: number;
  /** Optional callback or event handler for downstream alerting. */
  onAnomaly?: AnomalyEventHandler;
}

function readNumberEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return process.env[name] !== undefined && Number.isFinite(parsed) ? parsed : fallback;
}

export class TaxWithholdingAnomalyDetectionAgent {
  readonly id = 'tax-withholding-anomaly-detection';
  private readonly tolerance: number;
  private readonly maxPercentageRate: number;
  private readonly onAnomaly?: AnomalyEventHandler;

  constructor(options: TaxWithholdingOptions = {}) {
    this.tolerance = options.tolerance ?? readNumberEnv('TAX_WITHHOLDING_TOLERANCE', 0.01);
    this.maxPercentageRate =
      options.maxPercentageRate ?? readNumberEnv('TAX_WITHHOLDING_MAX_PERCENTAGE', 100);
    this.onAnomaly = options.onAnomaly;
  }

  /**
   * Evaluates a deduction result from TaxService.calculateDeductions for withholding anomalies.
   */
  async evaluateDeductions(params: {
    result: DeductionResult;
    organizationId?: number;
    now?: number;
  }): Promise<AnomalyEvent[]> {
    const { result, organizationId } = params;
    const now = params.now ?? Date.now();
    const anomalies: AnomalyEvent[] = [];
    let sumOfDeductions = 0;

    for (const deduction of result.deductions) {
      sumOfDeductions += deduction.deducted_amount;
      const expectedAmount = this.expectedAmount(result.gross_amount, deduction);

      if (Math.abs(deduction.deducted_amount - expectedAmount) > this.tolerance) {
        anomalies.push({
          id: randomUUID(),
          agentId: this.id,
          organizationId,
          severity: 'critical',
          reason: 'withholding_miscalculation',
          title: 'Withholding Amount Deviates From Rule',
          description: `Rule ${deduction.rule_name} withheld ${deduction.deducted_amount} but expected ${expectedAmount}`,
          detectedAt: new Date(now).toISOString(),
          metadata: {
            ruleId: deduction.rule_id,
            ruleName: deduction.rule_name,
            type: deduction.type,
            ruleValue: deduction.rule_value,
            grossAmount: result.gross_amount,
            expectedAmount,
            withheldAmount: deduction.deducted_amount,
          },
        });
      }

      if (
        deduction.type === 'percentage' &&
        (deduction.rule_value < 0 || deduction.rule_value > this.maxPercentageRate)
      ) {
        anomalies.push({
          id: randomUUID(),
          agentId: this.id,
          organizationId,
          severity: 'warning',
          reason: 'withholding_rate_out_of_bounds',
          title: 'Withholding Rate Outside Permitted Bounds',
          description: `Rule ${deduction.rule_name} uses rate ${deduction.rule_value}%, outside the 0-${this.maxPercentageRate}% bounds`,
          detectedAt: new Date(now).toISOString(),
          metadata: {
            ruleId: deduction.rule_id,
            ruleName: deduction.rule_name,
            rate: deduction.rule_value,
            maxPercentageRate: this.maxPercentageRate,
          },
        });
      }
    }

    if (Math.abs(result.total_tax - sumOfDeductions) > this.tolerance) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        organizationId,
        severity: 'critical',
        reason: 'withholding_total_mismatch',
        title: 'Total Withholding Does Not Reconcile',
        description: `Total tax ${result.total_tax} does not match the sum of deductions ${sumOfDeductions}`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          totalTax: result.total_tax,
          sumOfDeductions,
        },
      });
    }

    const expectedNet = Math.max(0, result.gross_amount - result.total_tax);
    if (Math.abs(result.net_amount - expectedNet) > this.tolerance) {
      anomalies.push({
        id: randomUUID(),
        agentId: this.id,
        organizationId,
        severity: 'critical',
        reason: 'withholding_net_mismatch',
        title: 'Net Amount Does Not Reconcile',
        description: `Net amount ${result.net_amount} does not equal gross minus total tax ${expectedNet}`,
        detectedAt: new Date(now).toISOString(),
        metadata: {
          grossAmount: result.gross_amount,
          totalTax: result.total_tax,
          netAmount: result.net_amount,
          expectedNet,
        },
      });
    }

    if (this.onAnomaly && anomalies.length > 0) {
      for (const anomaly of anomalies) {
        try {
          await this.onAnomaly(anomaly);
        } catch {
          // ignore delivery failures
        }
      }
    }

    return anomalies;
  }

  private expectedAmount(grossAmount: number, deduction: TaxDeduction): number {
    return deduction.type === 'percentage'
      ? grossAmount * (deduction.rule_value / 100)
      : deduction.rule_value;
  }
}

export const taxWithholdingAnomalyDetectionAgent = new TaxWithholdingAnomalyDetectionAgent();
