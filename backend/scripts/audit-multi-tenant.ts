import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '../src');

interface AuditFinding {
  file: string;
  line: number;
  issue: string;
  query: string;
}

const findings: AuditFinding[] = [];
let fileCount = 0;
let queryCount = 0;

function extractQueries(content: string): Array<{ query: string; line: number }> {
  const queries: Array<{ query: string; line: number }> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match pool.query(...) patterns
    const queryMatch = line.match(/pool\.query\(['"`](.*?)['"`]/s);
    if (queryMatch) {
      queries.push({ query: queryMatch[1], line: i + 1 });
    }

    // Match prisma queries (simplified pattern)
    if (line.includes('prisma') && line.includes('where')) {
      queries.push({ query: line, line: i + 1 });
    }
  }

  return queries;
}

function isScopedByOrgId(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // Check for organization_id scoping
  const hasScopeClause =
    lowerQuery.includes('organization_id') ||
    lowerQuery.includes('organizationid') ||
    lowerQuery.includes('tenant_id') ||
    lowerQuery.includes('tenantid');

  // Check if it's a safe pattern (SELECT/INSERT/UPDATE/DELETE with scoping)
  const isSafeRead = lowerQuery.match(/select.*from.*where.*\$\d/) && hasScopeClause;
  const isSafeWrite =
    (lowerQuery.includes('insert') || lowerQuery.includes('update') || lowerQuery.includes('delete')) &&
    hasScopeClause;

  return isSafeRead || isSafeWrite || !lowerQuery.match(/pool\.query|prisma\./);
}

function scanFile(filePath: string): void {
  if (!filePath.endsWith('.ts')) return;
  if (filePath.includes('node_modules') || filePath.includes('.test.ts')) return;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const queries = extractQueries(content);

    if (queries.length > 0) {
      fileCount++;

      for (const { query, line } of queries) {
        queryCount++;

        if (!isScopedByOrgId(query)) {
          findings.push({
            file: path.relative(srcDir, filePath),
            line,
            issue: 'Query may not be properly scoped by organization_id',
            query: query.substring(0, 80),
          });
        }
      }
    }
  } catch {
    // Skip unreadable files
  }
}

function scanDirectory(dir: string): void {
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;

    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else {
      scanFile(fullPath);
    }
  }
}

async function auditMultiTenant(): Promise<void> {
  console.log('🔍 Auditing multi-tenant data isolation...\n');

  scanDirectory(srcDir);

  console.log(`Scanned ${fileCount} files, analyzed ${queryCount} queries\n`);

  if (findings.length === 0) {
    console.log('✅ All queries appear to be properly scoped by organization_id\n');
    process.exit(0);
  }

  console.log(`⚠️  Found ${findings.length} potential isolation issues:\n`);

  for (const finding of findings) {
    console.log(`${finding.file}:${finding.line}`);
    console.log(`  Issue: ${finding.issue}`);
    console.log(`  Query: ${finding.query}`);
    console.log();
  }

  console.log('⚠️  Review these queries to ensure they properly scope by organization_id');
  console.log('   See backend/docs/MULTI_TENANT_SAFETY.md for isolation patterns\n');

  process.exit(findings.length > 0 ? 1 : 0);
}

auditMultiTenant().catch((error) => {
  console.error('Audit error:', error);
  process.exit(1);
});
