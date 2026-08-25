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

export default router;
