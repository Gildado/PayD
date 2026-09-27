import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '../prisma/migrations');

interface MigrationAudit {
  name: string;
  path: string;
  hasRollback: boolean;
  isIdempotent: boolean;
  isSyntaxValid: boolean;
  errors: string[];
}

function isSyntaxValid(sql: string): boolean {
  try {
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      if (!stmt) continue;

      const trimmed = stmt.toLowerCase().trim();
      if (
        trimmed.startsWith('begin') ||
        trimmed.startsWith('commit') ||
        trimmed.startsWith('rollback') ||
        trimmed.startsWith('create') ||
        trimmed.startsWith('alter') ||
        trimmed.startsWith('drop') ||
        trimmed.startsWith('insert') ||
        trimmed.startsWith('update') ||
        trimmed.startsWith('delete') ||
        trimmed.startsWith('select')
      ) {
        continue;
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isIdempotent(sql: string): boolean {
  const lowerSql = sql.toLowerCase();

  const nonIdempotentPatterns = [
    /\bCREATE\s+(?!OR\s+REPLACE)/i,
    /\bINSERT\s+INTO/i,
    /\bALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN/i,
  ];

  for (const pattern of nonIdempotentPatterns) {
    if (pattern.test(lowerSql)) {
      return false;
    }
  }

  const idempotentPatterns = [
    /CREATE\s+OR\s+REPLACE/i,
    /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i,
    /DROP\s+IF\s+EXISTS/i,
  ];

  const hasIdempotent = idempotentPatterns.some((p) => p.test(lowerSql));
  return hasIdempotent || !nonIdempotentPatterns.some((p) => p.test(lowerSql));
}

async function auditMigrations(): Promise<void> {
  if (!fs.existsSync(migrationsDir)) {
    console.log('ℹ️  No migrations directory found. Create your first migration to get started.');
    return;
  }

  const migrationDirs = fs
    .readdirSync(migrationsDir)
    .filter((dir) => {
      const fullPath = path.join(migrationsDir, dir);
      return fs.statSync(fullPath).isDirectory();
    })
    .sort();

  if (migrationDirs.length === 0) {
    console.log('ℹ️  No migrations found.');
    return;
  }

  const audits: MigrationAudit[] = [];
  let hasErrors = false;

  console.log(`Auditing ${migrationDirs.length} migration(s)...\n`);

  for (const dir of migrationDirs) {
    const migrationPath = path.join(migrationsDir, dir);
    const migrationFile = path.join(migrationPath, 'migration.sql');
    const rollbackFile = path.join(migrationPath, 'rollback.sql');

    const audit: MigrationAudit = {
      name: dir,
      path: migrationPath,
      hasRollback: fs.existsSync(rollbackFile),
      isIdempotent: false,
      isSyntaxValid: false,
      errors: [],
    };

    // Check migration file exists
    if (!fs.existsSync(migrationFile)) {
      audit.errors.push('migration.sql not found');
      hasErrors = true;
    } else {
      const migrationSql = fs.readFileSync(migrationFile, 'utf-8');

      // Check syntax
      audit.isSyntaxValid = isSyntaxValid(migrationSql);
      if (!audit.isSyntaxValid) {
        audit.errors.push('Invalid SQL syntax');
        hasErrors = true;
      }

      // Check idempotence
      audit.isIdempotent = isIdempotent(migrationSql);
      if (!audit.isIdempotent) {
        audit.errors.push('Migration may not be idempotent (use IF NOT EXISTS or CREATE OR REPLACE)');
      }
    }

    // Check rollback file exists
    if (!audit.hasRollback) {
      audit.errors.push('rollback.sql not found - migrations must be reversible');
      hasErrors = true;
    } else {
      const rollbackSql = fs.readFileSync(rollbackFile, 'utf-8');
      if (!isSyntaxValid(rollbackSql)) {
        audit.errors.push('Rollback SQL has invalid syntax');
        hasErrors = true;
      }
    }

    audits.push(audit);

    // Print individual migration status
    const status = audit.errors.length === 0 ? '✅' : '❌';
    console.log(`${status} ${dir}`);
    if (audit.errors.length > 0) {
      for (const error of audit.errors) {
        console.log(`   - ${error}`);
      }
    }
  }

  console.log('\n--- Summary ---');
  const validMigrations = audits.filter((a) => a.errors.length === 0).length;
  console.log(`Valid: ${validMigrations}/${audits.length}`);

  if (hasErrors) {
    console.log('\n⚠️  Migration audit failed. Fix errors before deploying to production.');
    process.exit(1);
  } else {
    console.log('\n✅ All migrations passed audit.');
    process.exit(0);
  }
}

auditMigrations().catch((error) => {
  console.error('Audit error:', error);
  process.exit(1);
});
