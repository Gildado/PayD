/**
 * Anomaly agent explainability report generator (#1216).
 *
 * Produces human-readable explanations of why an anomaly detection agent
 * fired, making it possible for operators to understand and trust the
 * detection decisions rather than treating them as black boxes.
 *
 * Each report includes: the trigger reason, the threshold that was crossed,
 * the observed vs expected values, and a plain-language summary.
 */

import logger from '../utils/logger.js';

export interface ExplainabilityInput {
  /** Rule name that triggered the detection. */
  rule: string;
  /** Org ID the detection applies to. */
  orgId: string;
  /** The payment or event that was flagged. */
  subject: string;
  /** Observed value that crossed the threshold. */
  observedValue: number;
  /** The threshold that was in effect. */
  threshold: number;
  /** Comparison direction: 'above' means observed > threshold. */
  direction: 'above' | 'below';
  /** Additional context (e.g. rolling mean, historical data). */
  context?: Record<string, unknown>;
  /** When the detection fired. */
  detectedAt: string;
}

export interface ExplainabilityReport {
  /** Unique report ID. */
  id: string;
  /** One-line summary. */
  summary: string;
  /** Detailed explanation with reasoning chain. */
  explanation: string;
  /** Structured factors that contributed to the decision. */
  factors: Array<{ factor: string; value: string; weight: 'high' | 'medium' | 'low' }>;
  /** Plain-language recommendation. */
  recommendation: string;
  /** The original input. */
  input: ExplainabilityInput;
  /** When the report was generated. */
  generatedAt: string;
}

const RULE_DESCRIPTIONS: Record<string, string> = {
  large_amount: 'The payment amount significantly exceeds normal operating amounts.',
  statistical_outlier: 'The payment amount is statistically unusual compared to recent history.',
  rapid_succession: 'Multiple payments from the same address within a short time window.',
  velocity_burst: 'Payment frequency from a single source exceeds normal patterns.',
  unusual_recipient: 'The payment destination is not in the set of known/expected recipients.',
};

const RECOMMENDATIONS: Record<string, string> = {
  large_amount: 'Verify with the payment initiator that this amount is expected and authorized.',
  statistical_outlier: 'Review the payment context and confirm it is legitimate business activity.',
  rapid_succession: 'Check if this is a burst of legitimate activity or a potential automated attack.',
  velocity_burst: 'Monitor for a few more minutes; if the burst continues, contact the account owner.',
  unusual_recipient: 'Verify the recipient address is correct and not a phishing target.',
};

let reportCounter = 0;

/**
 * Generate an explainability report for an anomaly detection event.
 */
export function generateReport(input: ExplainabilityInput): ExplainabilityReport {
  reportCounter++;
  const id = `expl-${Date.now()}-${reportCounter}`;
  const ruleDesc = RULE_DESCRIPTIONS[input.rule] ?? 'An anomaly detection rule was triggered.';
  const recommendation = RECOMMENDATIONS[input.rule] ?? 'Review the flagged event manually.';

  const comparison = input.direction === 'above' ? 'exceeded' : 'fell below';
  const summary = `${input.rule} triggered on ${input.subject}: observed ${input.observedValue} ${comparison} threshold ${input.threshold}`;

  const explanation = [
    `Detection rule "${input.rule}" fired for ${input.subject} in org ${input.orgId}.`,
    ruleDesc,
    `The observed value (${input.observedValue}) ${comparison} the configured threshold (${input.threshold}).`,
    ...(input.context
      ? [`Additional context: ${JSON.stringify(input.context)}.`]
      : []),
    `Detection fired at ${input.detectedAt}.`,
  ].join(' ');

  const factors: ExplainabilityReport['factors'] = [
    {
      factor: 'Observed value',
      value: String(input.observedValue),
      weight: 'high',
    },
    {
      factor: 'Threshold',
      value: String(input.threshold),
      weight: 'high',
    },
    {
      factor: 'Rule',
      value: input.rule,
      weight: 'medium',
    },
    {
      factor: 'Direction',
      value: input.direction,
      weight: 'medium',
    },
  ];

  if (input.context) {
    for (const [key, value] of Object.entries(input.context)) {
      factors.push({ factor: key, value: String(value), weight: 'low' });
    }
  }

  const report: ExplainabilityReport = {
    id,
    summary,
    explanation,
    factors,
    recommendation,
    input,
    generatedAt: new Date().toISOString(),
  };

  logger.info({ reportId: id, rule: input.rule }, 'Explainability report generated');
  return report;
}
