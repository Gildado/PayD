import { Router, Request, Response } from 'express';
import { payrollQueryService } from '../services/payroll-query.service.js';
import {
  computeReportFreshness,
  deriveLastGeneratedAtFromTimestamps,
} from '../services/reportFreshnessService.js';
import {
  DEFAULT_LOCALE,
  REPORT_MESSAGE_KEYS,
  SUPPORTED_LOCALES,
  getLocalizedLabels,
  isSupportedLocale,
} from '../services/reportI18nService.js';
import { runReportBenchmark } from '../services/reportBenchmarkService.js';
import { buildSyntheticTransactions } from '../utils/syntheticTransactions.js';
import { reportFailureAlertService } from '../services/reportFailureAlertService.js';
import { reportAgentAuditService } from '../services/reportAgentAuditService.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';

const router = Router();

/**
 * #1337 — Report freshness/staleness indicator.
 * Derives the newest underlying data timestamp for the organization's
 * payroll ledger and returns a ready-to-render freshness report.
 */
router.get('/freshness', async (req: Request, res: Response): Promise<void> => {
  const organizationPublicKey = String(req.query.organizationPublicKey ?? '').trim();
  if (!organizationPublicKey) {
    res.status(400).json({
      success: false,
      error: 'organizationPublicKey query parameter is required',
    });
    return;
  }

  try {
    const result = await payrollQueryService.queryPayroll(
      { organizationPublicKey },
      1,
      200,
      { sortBy: 'timestamp', sortOrder: 'desc' }
    );
    const lastGeneratedAt = deriveLastGeneratedAtFromTimestamps(
      result.data.map((tx) => tx.timestamp)
    );

    const freshness = computeReportFreshness({
      reportId: 'payroll-history',
      lastGeneratedAt,
    });
    res.json({ success: true, data: freshness });
  } catch (error) {
    // Even the freshness probe degrades gracefully (#1338 synergy).
    const fallback = await reportFailureAlertService.executeWithFallback(
      async () => Promise.reject(error instanceof Error ? error : new Error(String(error))),
      { reportId: 'payroll-history-freshness', organizationId: organizationPublicKey }
    );
    res.status(502).json({ success: false, ...fallback });
  }
});

/**
 * #1339 — Report agent localization (i18n).
 * Returns the localized label table for a locale plus schema metadata.
 */
router.get('/i18n', (req: Request, res: Response): void => {
  const requested = String(req.query.locale ?? DEFAULT_LOCALE);
  if (!isSupportedLocale(requested)) {
    res.status(400).json({
      success: false,
      error: `Unsupported locale "${requested}". Supported locales: ${SUPPORTED_LOCALES.join(', ')}`,
    });
    return;
  }

  const localized = getLocalizedLabels(requested);
  res.json({
    success: true,
    data: {
      schemaVersion: '1.0',
      supportedLocales: SUPPORTED_LOCALES,
      messageKeys: REPORT_MESSAGE_KEYS,
      ...localized,
    },
  });
});

/**
 * #1340 — Report agent performance benchmarking.
 * Benchmarks the standard aggregation pipeline over a synthetic large-org
 * dataset of `rows` transactions (default 10_000, capped at 1_000_000).
 */
router.get('/benchmark', (req: Request, res: Response): void => {
  const rows = Math.min(1_000_000, Math.max(100, Number(req.query.rows ?? 10_000) || 10_000));
  const iterations = Math.min(20, Math.max(1, Number(req.query.iterations ?? 5) || 5));

  const dataset = buildSyntheticTransactions(rows);
  const benchmark = runReportBenchmark({
    dataset,
    iterations,
    warnBudgetMs: 2_000,
    failBudgetMs: 10_000,
  });

  res.json({ success: true, data: benchmark });
});

/**
 * #1338 — Failure alerting status.
 * Current consecutive-failure counters per report/organization.
 */
router.get('/failures', (_req: Request, res: Response): void => {
  res.json({ success: true, data: reportFailureAlertService.getFailureSummary() });
});

/**
 * Report agent audit log — paginated list with filters.
 */
router.get('/audit', async (req: Request, res: Response): Promise<void> => {
  const organizationId = Number(req.query.organizationId);
  if (!organizationId || organizationId <= 0) {
    res.status(400).json(
      apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'organizationId query parameter is required and must be a positive number')
    );
    return;
  }

  try {
    const result = await reportAgentAuditService.list(organizationId, {
      actionType: req.query.actionType as string | undefined,
      reportId: req.query.reportId as string | undefined,
      agentId: req.query.agentId as string | undefined,
      actorType: req.query.actorType as any,
      actorId: req.query.actorId ? Number(req.query.actorId) : undefined,
      severity: req.query.severity as any,
      status: req.query.status as 'success' | 'failed' | undefined,
      fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
      toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve audit log')
    );
  }
});

/**
 * Report agent audit log — aggregated summary.
 */
router.get('/audit/summary', async (req: Request, res: Response): Promise<void> => {
  const organizationId = Number(req.query.organizationId);
  if (!organizationId || organizationId <= 0) {
    res.status(400).json(
      apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'organizationId query parameter is required and must be a positive number')
    );
    return;
  }

  try {
    const summary = await reportAgentAuditService.summary(organizationId, {
      actionType: req.query.actionType as string | undefined,
      reportId: req.query.reportId as string | undefined,
      severity: req.query.severity as any,
      status: req.query.status as 'success' | 'failed' | undefined,
      fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
      toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
    });

    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve audit summary')
    );
  }
});

/**
 * Report agent audit log — CSV export (max 10 000 rows).
 */
router.get('/audit/export', async (req: Request, res: Response): Promise<void> => {
  const organizationId = Number(req.query.organizationId);
  if (!organizationId || organizationId <= 0) {
    res.status(400).json(
      apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'organizationId query parameter is required and must be a positive number')
    );
    return;
  }

  try {
    const csv = await reportAgentAuditService.exportCsv(organizationId, {
      actionType: req.query.actionType as string | undefined,
      reportId: req.query.reportId as string | undefined,
      severity: req.query.severity as any,
      status: req.query.status as 'success' | 'failed' | undefined,
      fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
      toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="report-agent-audit.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to export audit log')
    );
  }
});

/**
 * #1308 — Notification engagement report.
 * Summary of notification delivery stats (email/push), per-employee breakdown,
 * and recent failures.
 */
router.get('/notification-engagement', async (req: Request, res: Response): Promise<void> => {
  const organizationId = Number(req.query.organizationId);
  if (!organizationId || organizationId <= 0) {
    res.status(400).json(
      apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'organizationId query parameter is required and must be a positive number')
    );
    return;
  }

  try {
    const { NotificationEngagementReportAgent } = await import('../services/notificationEngagementReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new NotificationEngagementReportAgent(pool);
    const result = await agent.execute({
      organizationId,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate notification engagement report')
    );
  }
});

/**
 * #1298 — Employee turnover payroll impact report.
 * Quantifies the payroll cost impact of employee turnover over a period.
 */
router.get('/employee-turnover', async (req: Request, res: Response): Promise<void> => {
  const organizationId = Number(req.query.organizationId);
  if (!organizationId || organizationId <= 0) {
    res.status(400).json(
      apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'organizationId query parameter is required and must be a positive number')
    );
    return;
  }

  try {
    const { EmployeeTurnoverReportAgent } = await import('../services/employeeTurnoverReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new EmployeeTurnoverReportAgent(pool);
    const result = await agent.execute({
      organizationId,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate employee turnover report')
    );
  }
});

/**
 * #1309 — Payroll audit trail summary.
 * Condenses raw payroll audit logs into a reviewable narrative summary.
 */
router.get('/payroll-audit-trail', async (req: Request, res: Response): Promise<void> => {
  const organizationId = Number(req.query.organizationId);
  if (!organizationId || organizationId <= 0) {
    res.status(400).json(
      apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'organizationId query parameter is required and must be a positive number')
    );
    return;
  }

  try {
    const { PayrollAuditTrailReportAgent } = await import('../services/payrollAuditTrailReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new PayrollAuditTrailReportAgent(pool);
    const result = await agent.execute({
      organizationId,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate payroll audit trail report')
    );
  }
});

/**
 * #1311 — Search analytics report.
 * Reports on search query patterns and coverage gaps across the org.
 */
router.get('/search-analytics', async (req: Request, res: Response): Promise<void> => {
  const organizationId = Number(req.query.organizationId);
  if (!organizationId || organizationId <= 0) {
    res.status(400).json(
      apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'organizationId query parameter is required and must be a positive number')
    );
    return;
  }

  try {
    const { SearchAnalyticsReportAgent } = await import('../services/searchAnalyticsReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new SearchAnalyticsReportAgent(pool);
    const result = await agent.execute({ organizationId });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate search analytics report')
    );
  }
});

/**
 * #1300 — Scheduled report delivery agent.
 * Summarizes async export job states (pending/processing/completed/failed).
 */
router.get('/scheduled-delivery', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ScheduledReportDeliveryAgent } = await import('../services/scheduledReportDeliveryAgent.js');
    const agent = new ScheduledReportDeliveryAgent();
    const result = await agent.execute({
      organizationPublicKey: req.query.organizationPublicKey as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate scheduled delivery report')
    );
  }
});

/**
 * #1301 — CSV/PDF export enhancement agent.
 * Analyzes export patterns and recommends enhancements.
 */
router.get('/export-enhancement', async (req: Request, res: Response): Promise<void> => {
  try {
    const { CsvPdfExportEnhancementAgent } = await import('../services/csvPdfExportEnhancementAgent.js');
    const agent = new CsvPdfExportEnhancementAgent();
    const result = await agent.execute({
      organizationPublicKey: req.query.organizationPublicKey as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate export enhancement report')
    );
  }
});

/**
 * #1302 — Multi-currency exposure report agent.
 * Reports currency exposure across held and payable assets.
 */
router.get('/currency-exposure', async (req: Request, res: Response): Promise<void> => {
  try {
    const { MultiCurrencyExposureReportAgent } = await import('../services/multiCurrencyExposureReportAgent.js');
    const agent = new MultiCurrencyExposureReportAgent();
    const result = await agent.execute({
      organizationPublicKey: req.query.organizationPublicKey as string | undefined,
      baseCurrency: req.query.baseCurrency as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate currency exposure report')
    );
  }
});

/**
 * #1303 — Revenue split distribution report agent.
 * Summarizes historical revenue split distributions and recipient shares.
 */
router.get('/revenue-split', async (req: Request, res: Response): Promise<void> => {
  try {
    const { RevenueSplitDistributionReportAgent } = await import('../services/revenueSplitDistributionReportAgent.js');
    const agent = new RevenueSplitDistributionReportAgent();
    const result = await agent.execute({
      organizationPublicKey: req.query.organizationPublicKey as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate revenue split report')
    );
  }
});

/**
 * #1312 — Circuit breaker incident report.
 * Summarises circuit breaker trip incidents and root services.
 */
router.get('/circuit-breaker-incident', async (req: Request, res: Response): Promise<void> => {
  try {
    const { CircuitBreakerIncidentReportAgent } = await import('../services/circuitBreakerIncidentReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new CircuitBreakerIncidentReportAgent(pool);
    const result = await agent.execute({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate circuit breaker incident report')
    );
  }
});

/**
 * #1313 — Rate limit usage report.
 * Reports on rate limit utilization and near-threshold clients.
 */
router.get('/rate-limit-usage', async (req: Request, res: Response): Promise<void> => {
  try {
    const { RateLimitUsageReportAgent } = await import('../services/rateLimitUsageReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new RateLimitUsageReportAgent(pool);
    const result = await agent.execute({
      thresholdPercent: req.query.thresholdPercent ? Number(req.query.thresholdPercent) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate rate limit usage report')
    );
  }
});

/**
 * #1314 — Contributor rewards distribution report.
 * Summarises contributor reward distributions over a period.
 */
router.get('/contributor-rewards', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ContributorRewardsReportAgent } = await import('../services/contributorRewardsReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new ContributorRewardsReportAgent(pool);
    const result = await agent.execute({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate contributor rewards report')
    );
  }
});

/**
 * #1315 — Bulk payment batch outcome report.
 * Reports success/failure breakdowns across bulk payment batches.
 */
router.get('/bulk-payment-batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { BulkPaymentBatchReportAgent } = await import('../services/bulkPaymentBatchReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new BulkPaymentBatchReportAgent(pool);
    const result = await agent.execute({
      organizationId: req.query.organizationId ? Number(req.query.organizationId) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate bulk payment batch report')
    );
  }
});

/**
 * #1297 — Contract gas/fee cost report.
 * Tracks and reports on-chain fee cost trends across contract types.
 */
router.get('/contract-gas-fee', async (req: Request, res: Response): Promise<void> => {
  const organizationId = Number(req.query.organizationId);
  if (!organizationId || organizationId <= 0) {
    res.status(400).json(
      apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'organizationId query parameter is required and must be a positive number')
    );
    return;
  }

  try {
    const { ContractGasFeeReportAgent } = await import('../services/contractGasFeeReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new ContractGasFeeReportAgent(pool);
    const result = await agent.execute({
      organizationId,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      contractType: req.query.contractType as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate contract gas/fee report')
    );
  }
});

/**
 * #1316 — Fee estimation accuracy report.
 * Compares estimated vs actual fees paid to measure estimation accuracy.
 */
router.get('/fee-estimation-accuracy', async (req: Request, res: Response): Promise<void> => {
  const organizationId = Number(req.query.organizationId);
  if (!organizationId || organizationId <= 0) {
    res.status(400).json(
      apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'organizationId query parameter is required and must be a positive number')
    );
    return;
  }

  try {
    const { FeeEstimationAccuracyReportAgent } = await import('../services/feeEstimationAccuracyReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new FeeEstimationAccuracyReportAgent(pool);
    const result = await agent.execute({
      organizationId,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      minDeviation: req.query.minDeviation ? Number(req.query.minDeviation) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate fee estimation accuracy report')
    );
  }
});

/**
 * #1304 — Vesting schedule projection report.
 * Projects upcoming vesting releases across all active schedules.
 */
router.get('/vesting-schedule-projection', async (req: Request, res: Response): Promise<void> => {
  const organizationId = Number(req.query.organizationId);
  if (!organizationId || organizationId <= 0) {
    res.status(400).json(
      apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'organizationId query parameter is required and must be a positive number')
    );
    return;
  }

  try {
    const { VestingScheduleProjectionReportAgent } = await import('../services/vestingScheduleProjectionReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new VestingScheduleProjectionReportAgent(pool);
    const result = await agent.execute({
      organizationId,
      futureMonths: req.query.futureMonths ? Number(req.query.futureMonths) : undefined,
      employeeId: req.query.employeeId ? Number(req.query.employeeId) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate vesting schedule projection report')
    );
  }
});

/**
 * #1318 — Trustline adoption report.
 * Reports on trustline setup adoption across assets and organizations.
 */
router.get('/trustline-adoption', async (req: Request, res: Response): Promise<void> => {
  const organizationId = Number(req.query.organizationId);
  if (!organizationId || organizationId <= 0) {
    res.status(400).json(
      apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'organizationId query parameter is required and must be a positive number')
    );
    return;
  }

  try {
    const { TrustlineAdoptionReportAgent } = await import('../services/trustlineAdoptionReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new TrustlineAdoptionReportAgent(pool);
    const result = await agent.execute({
      organizationId,
      assetCode: req.query.assetCode as string | undefined,
      department: req.query.department as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate trustline adoption report')
    );
  }
});

/**
 * Webhook Delivery Health Report
 * Reports on webhook delivery success rates and recurring failure patterns.
 */
router.get('/webhook-delivery-health', async (req: Request, res: Response): Promise<void> => {
  const organizationId = Number(req.query.organizationId);
  if (!organizationId || organizationId <= 0) {
    res.status(400).json(
      apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'organizationId query parameter is required and must be a positive number')
    );
    return;
  }

  try {
    const { WebhookDeliveryHealthReportAgent } = await import('../services/webhookDeliveryHealthReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new WebhookDeliveryHealthReportAgent(pool);
    const result = await agent.execute({
      organizationId,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate webhook delivery health report')
    );
  }
});

/**
 * #1310 — Slow query trend report.
 * Analyzes slow-query trends and top offending queries over time.
 */
router.get('/slow-query-trend', async (req: Request, res: Response): Promise<void> => {
  try {
    const { SlowQueryTrendReportAgent } = await import('../services/slowQueryTrendReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new SlowQueryTrendReportAgent(pool);
    const result = await agent.execute({
      thresholdMs: req.query.thresholdMs ? Number(req.query.thresholdMs) : undefined,
      windowDays: req.query.windowDays ? Number(req.query.windowDays) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate slow query trend report')
    );
  }
});

/**
 * #1311 — Transaction audit correlation report.
 * Correlates transaction audit records across services into one report.
 */
router.get('/transaction-audit-correlation', async (req: Request, res: Response): Promise<void> => {
  try {
    const { TransactionAuditCorrelationReportAgent } = await import('../services/transactionAuditCorrelationReportAgent.js');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool();
    const agent = new TransactionAuditCorrelationReportAgent(pool);
    const result = await agent.execute({
      organizationId: req.query.organizationId ? Number(req.query.organizationId) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json(
      apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate transaction audit correlation report')
    );
  }
});

export default router;
