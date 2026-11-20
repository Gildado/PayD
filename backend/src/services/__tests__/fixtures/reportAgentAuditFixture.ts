/**
 * Fixture dataset for report agent audit logging tests.
 * All expected values are pre-computed so every test asserts against known output.
 */

import type { ReportAgentAuditEntry, ReportAgentAuditRow } from '../../reportAgentAuditService.js';

// ── Fixture entries ───────────────────────────────────────────────────────────

export const FIXTURE_ORG_ID = 1;

export const FIXTURE_AUDIT_ENTRIES: ReportAgentAuditEntry[] = [
  {
    organizationId: FIXTURE_ORG_ID,
    actionType: 'report_generated',
    reportId: 'rpt-payroll-summary',
    reportName: 'Payroll Summary',
    agentId: 'agent_payroll',
    actorType: 'user',
    actorId: 10,
    actorEmail: 'alice@example.com',
    format: 'PDF',
    rowCount: 150,
    durationMs: 1200,
    status: 'success',
    severity: 'info',
    requestId: 'req-001',
    ipAddress: '10.0.0.1',
    userAgent: 'jest-test',
  },
  {
    organizationId: FIXTURE_ORG_ID,
    actionType: 'report_generated',
    reportId: 'rpt-audit-log',
    reportName: 'Audit Log Report',
    agentId: 'agent_audit',
    actorType: 'user',
    actorId: 11,
    actorEmail: 'bob@example.com',
    format: 'CSV',
    rowCount: 500,
    durationMs: 3400,
    status: 'success',
    severity: 'info',
    requestId: 'req-002',
  },
  {
    organizationId: FIXTURE_ORG_ID,
    actionType: 'report_exported',
    reportId: 'rpt-payroll-summary',
    reportName: 'Payroll Summary',
    agentId: 'agent_payroll',
    actorType: 'user',
    actorId: 10,
    actorEmail: 'alice@example.com',
    format: 'XLSX',
    rowCount: 150,
    durationMs: 800,
    status: 'success',
    severity: 'info',
    requestId: 'req-003',
  },
  {
    organizationId: FIXTURE_ORG_ID,
    actionType: 'report_failed',
    reportId: 'rpt-transaction-detail',
    reportName: 'Transaction Detail',
    agentId: 'agent_transactions',
    actorType: 'system',
    status: 'failed',
    errorMessage: 'Query timeout after 30000ms',
    durationMs: 30000,
    severity: 'critical',
    requestId: 'req-004',
  },
  {
    organizationId: FIXTURE_ORG_ID,
    actionType: 'report_delivered',
    reportId: 'rpt-payroll-summary',
    reportName: 'Payroll Summary',
    agentId: 'agent_payroll',
    actorType: 'system',
    format: 'PDF',
    rowCount: 150,
    status: 'success',
    severity: 'info',
    metadata: { channel: 'email', recipients: ['alice@example.com'] },
    requestId: 'req-005',
  },
  {
    organizationId: FIXTURE_ORG_ID,
    actionType: 'report_accessed',
    reportId: 'rpt-audit-log',
    reportName: 'Audit Log Report',
    agentId: 'agent_audit',
    actorType: 'user',
    actorId: 12,
    actorEmail: 'charlie@example.com',
    severity: 'info',
    requestId: 'req-006',
  },
  {
    organizationId: FIXTURE_ORG_ID,
    actionType: 'report_scheduled',
    reportId: 'rpt-payroll-summary',
    reportName: 'Payroll Summary',
    agentId: 'agent_payroll',
    actorType: 'user',
    actorId: 10,
    actorEmail: 'alice@example.com',
    severity: 'info',
    metadata: { cron: '0 9 * * 1', timezone: 'UTC' },
    requestId: 'req-007',
  },
  {
    organizationId: FIXTURE_ORG_ID,
    actionType: 'report_validation_failed',
    reportId: 'rpt-custom',
    reportName: 'Custom Report',
    agentId: 'agent_custom',
    actorType: 'user',
    actorId: 11,
    actorEmail: 'bob@example.com',
    status: 'failed',
    errorMessage: 'SQL injection detected in filter parameter',
    severity: 'warning',
    requestId: 'req-008',
  },
  {
    organizationId: FIXTURE_ORG_ID,
    actionType: 'report_cache_hit',
    reportId: 'rpt-payroll-summary',
    reportName: 'Payroll Summary',
    agentId: 'agent_payroll',
    actorType: 'user',
    actorId: 10,
    actorEmail: 'alice@example.com',
    format: 'JSON',
    rowCount: 150,
    durationMs: 12,
    status: 'success',
    severity: 'info',
    requestId: 'req-009',
  },
  {
    organizationId: FIXTURE_ORG_ID,
    actionType: 'report_generated',
    reportId: 'rpt-payroll-summary',
    reportName: 'Payroll Summary',
    agentId: 'agent_payroll',
    actorType: 'api',
    format: 'JSON',
    rowCount: 200,
    durationMs: 2100,
    status: 'success',
    severity: 'info',
    requestId: 'req-010',
  },
];

// ── Pre-computed expectations ─────────────────────────────────────────────────

export const FIXTURE_EXPECTED = {
  totalEntries: 10,
  successCount: 6, // entries 1,2,3,5,9,10 have status='success'
  failedCount: 2,  // entries 4,8 have status='failed'
  criticalCount: 1,
  warningCount: 1,
  uniqueReports: 4, // rpt-payroll-summary, rpt-audit-log, rpt-transaction-detail, rpt-custom
  uniqueActors: 3,  // alice, bob, charlie (system/api excluded from actor_email grouping)
  actionBreakdown: {
    report_generated: 3,
    report_exported: 1,
    report_delivered: 1,
    report_accessed: 1,
    report_scheduled: 1,
    report_validation_failed: 1,
    report_cache_hit: 1,
    report_failed: 1,
  },
  reportBreakdown: {
    'rpt-payroll-summary': 6, // entries 1,3,5,7,9,10
    'rpt-audit-log': 2,
    'rpt-transaction-detail': 1,
    'rpt-custom': 1,
  },
  avgDurationMs: 6252, // (1200+3400+800+30000+12+2100) / 6 entries with duration
  totalRowsGenerated: 1300, // 150+500+150+150+150+200 (entries with rowCount)
} as const;

// ── Mock rows (DB shape) ─────────────────────────────────────────────────────

function toRow(entry: ReportAgentAuditEntry, idx: number): ReportAgentAuditRow {
  return {
    id: `audit-${String(idx + 1).padStart(3, '0')}`,
    organization_id: entry.organizationId,
    action_type: entry.actionType,
    report_id: entry.reportId,
    report_name: entry.reportName ?? null,
    agent_id: entry.agentId ?? null,
    actor_type: entry.actorType,
    actor_id: entry.actorId ?? null,
    actor_email: entry.actorEmail ?? null,
    format: entry.format ?? null,
    row_count: entry.rowCount ?? null,
    duration_ms: entry.durationMs ?? null,
    status: entry.status ?? null,
    error_message: entry.errorMessage ?? null,
    filters: entry.filters ?? null,
    metadata: entry.metadata ?? null,
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent ?? null,
    request_id: entry.requestId ?? null,
    severity: entry.severity ?? 'info',
    created_at: new Date(Date.UTC(2024, 2, 1, 10, 0, 0) + idx * 600_000).toISOString(),
  };
}

export const FIXTURE_ROWS: ReportAgentAuditRow[] = FIXTURE_AUDIT_ENTRIES.map(toRow);
