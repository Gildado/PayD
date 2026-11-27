import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const srcDir = resolve(root, 'src');
const docsExamplesDir = resolve(root, 'docs/examples');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sourceFiles = walk(srcDir).filter((file) => /\.(ts|tsx)$/.test(file));

describe('example files live outside the app source tree', () => {
  it('has no *.example.ts(x) files under src', () => {
    expect(sourceFiles.filter((file) => /\.example\.tsx?$/.test(file))).toEqual([]);
  });

  it('has no src/examples directory', () => {
    expect(existsSync(resolve(srcDir, 'examples'))).toBe(false);
  });

  it('has no app source importing an example module', () => {
    const offenders = sourceFiles.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /from\s+['"][^'"]*(\.example|examples\/)/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it('keeps all three examples in docs/examples', () => {
    for (const file of [
      'BulkPayrollUpload.example.tsx',
      'contracts.example.tsx',
      'TransactionNotificationExample.tsx',
      'README.md',
    ]) {
      expect(existsSync(join(docsExamplesDir, file))).toBe(true);
    }
  });

  it('has no documentation link pointing at the old in-src locations', () => {
    const stalePath =
      /frontend\/src\/(examples\/|pages\/BulkPayrollUpload\.example|services\/contracts\.example)/;
    const documentedFiles = [
      'INTEGRATION_GUIDE.md',
      'QUICK_START.md',
      'BUILD_FIX_SUMMARY.md',
      'TRANSACTION_OVERLAY_IMPLEMENTATION.md',
      'TRANSACTION_FEE_ESTIMATION_SUMMARY.md',
      'IMPLEMENTATION_CHECKLIST.md',
    ].map((name) => resolve(root, '..', name));

    const offenders = documentedFiles.filter((file) => stalePath.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
