import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'src/db/migrations');

/**
 * Current tenant-scoped tables (have organization_id) that do not yet define
 * an RLS policy in migrations. New gaps must be fixed with a policy or added
 * here only with explicit justification in docs/RLS_TENANT_TABLE_POLICY_GAPS.md.
 */
const KNOWN_POLICY_GAPS = new Set<string>([
  'admin_audit_log',
  'auto_refund_log',
  'batch_archive',
  'bulk_payment_batches',
  'claimable_balances',
  'invites',
  'notification_configs',
  'notifications',
  'orchestration_records',
  'org_audit_log',
  'org_query_throughput',
  'payroll_audit_logs',
  'payroll_runs',
  'payroll_schedules',
  'report_agents',
  'report_executions',
  'sep31_cross_border_transactions',
  'tax_reports',
  'tax_rules',
  'users',
  'webhook_subscriptions',
]);

function readMigrationSql(): string {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  return files
    .map((file) => fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'))
    .join('\n;\n');
}

function normalizeIdentifier(identifier: string): string {
  const unquoted = identifier.replace(/"/g, '').trim();
  const parts = unquoted.split('.');
  return parts[parts.length - 1] ?? unquoted;
}

function getTenantScopedTables(sql: string): string[] {
  const statements = sql.split(/;/);
  const tables = new Set<string>();
  const createTablePattern =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_".]+)/i;
  const alterTablePattern =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_".]+)/i;

  for (const statement of statements) {
    if (!/\borganization_id\b/i.test(statement)) continue;

    const createMatch = statement.match(createTablePattern);
    if (createMatch?.[1]) {
      tables.add(normalizeIdentifier(createMatch[1]));
      continue;
    }

    const alterMatch = statement.match(alterTablePattern);
    if (alterMatch?.[1] && /\bADD\s+COLUMN\b[\s\S]*\borganization_id\b/i.test(statement)) {
      tables.add(normalizeIdentifier(alterMatch[1]));
    }
  }

  return Array.from(tables).sort();
}

function getTablesWithPolicies(sql: string): Set<string> {
  const tables = new Set<string>();
  const policyPattern =
    /CREATE\s+POLICY\b[\s\S]*?\bON\s+(?:ONLY\s+)?([a-zA-Z0-9_".]+)/gi;

  for (const match of sql.matchAll(policyPattern)) {
    if (match[1]) tables.add(normalizeIdentifier(match[1]));
  }

  return tables;
}

describe('RLS organization policy coverage (#1814)', () => {
  it('enumerates every tenant-scoped table and requires an RLS policy or documented gap', () => {
    const sql = readMigrationSql();
    const tenantTables = getTenantScopedTables(sql);
    const tablesWithPolicies = getTablesWithPolicies(sql);

    expect(tenantTables.length).toBeGreaterThan(0);

    const missingPolicies = tenantTables.filter(
      (table) => !tablesWithPolicies.has(table),
    );
    const undocumentedGaps = missingPolicies.filter(
      (table) => !KNOWN_POLICY_GAPS.has(table),
    );
    const staleGaps = Array.from(KNOWN_POLICY_GAPS).filter(
      (table) => tablesWithPolicies.has(table),
    );

    expect(staleGaps).toEqual([]);
    expect(undocumentedGaps).toEqual([]);

    // Coverage report: current gaps are explicitly listed and must be fixed or
    // documented in docs/RLS_TENANT_TABLE_POLICY_GAPS.md.
    expect(missingPolicies.sort()).toEqual(Array.from(KNOWN_POLICY_GAPS).sort());
  });
});
