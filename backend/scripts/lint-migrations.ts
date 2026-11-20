/**
 * @file scripts/lint-migrations.ts
 * @description CLI for the migration destructive-change linter (#1812).
 *
 * Usage (from the backend/ directory):
 *   npm run db:migrate:lint -- --base origin/main    # lint migrations changed vs base (CI)
 *   npm run db:migrate:lint -- path/to/file.sql ...  # lint explicit files
 *   npm run db:migrate:lint                          # lint every migration file
 *
 * Exits 1 when any migration has an unmarked destructive statement or an
 * invalid `lint:allow-destructive` marker. See src/db/MIGRATION_GUIDE.md.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  formatLintResult,
  lintMigrationSql,
  lintResultFails,
  type LintResult,
} from '../src/db/migrationLinter.js';

const __filename = fileURLToPath(import.meta.url);
const backendDir = path.resolve(path.dirname(__filename), '..');
const migrationsDir = path.join(backendDir, 'src', 'db', 'migrations');

function parseBase(argv: string[]): string | undefined {
  const idx = argv.indexOf('--base');
  if (idx === -1) return undefined;
  const value = argv[idx + 1];
  if (!value || value.startsWith('--')) {
    throw new Error('--base requires a git ref, e.g. --base origin/main');
  }
  return value;
}

/**
 * Resolve the migration files to lint. `--base <ref>` returns only the files
 * added or modified since the merge base, so pre-existing migrations are never
 * re-judged. `--relative` makes git print paths relative to backend/.
 */
function resolveTargets(argv: string[]): string[] {
  const explicit = argv.filter((arg, i) => !arg.startsWith('--') && argv[i - 1] !== '--base');
  if (explicit.length > 0) {
    return explicit.map((f) => path.resolve(backendDir, f));
  }

  const base = parseBase(argv);
  if (base) {
    const output = execFileSync(
      'git',
      [
        'diff',
        '--relative',
        '--name-only',
        '--diff-filter=ACMR',
        `${base}...HEAD`,
        '--',
        'src/db/migrations/*.sql',
      ],
      { cwd: backendDir, encoding: 'utf8' }
    );
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.sql'))
      .map((line) => path.resolve(backendDir, line));
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => path.join(migrationsDir, f));
}

function main(): void {
  const argv = process.argv.slice(2);
  const targets = resolveTargets(argv);

  if (targets.length === 0) {
    console.log('[lint-migrations] No changed migration files to lint.');
    process.exit(0);
  }

  const results: LintResult[] = targets.map((file) =>
    lintMigrationSql(path.basename(file), fs.readFileSync(file, 'utf8'))
  );

  let failed = 0;
  for (const result of results) {
    const report = formatLintResult(result);
    if (report) console.log(report);
    if (lintResultFails(result)) failed++;
  }

  const clean = results.length - failed;
  console.log(
    `[lint-migrations] ${results.length} file(s) checked: ${clean} passed, ${failed} failed.`
  );

  if (failed > 0) {
    console.log(
      '[lint-migrations] Destructive statements need an explicit marker with a reason, ' +
        'e.g. "-- lint:allow-destructive: <why this is safe>". See src/db/MIGRATION_GUIDE.md.'
    );
    process.exit(1);
  }
  process.exit(0);
}

main();
