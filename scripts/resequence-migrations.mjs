#!/usr/bin/env node
/**
 * @file scripts/resequence-migrations.mjs
 * @description Atomically re-sequences all SQL migration and rollback files so
 *              that every file has a globally unique, contiguous numeric prefix
 *              and no duplicate or missing numbers exist.
 *
 * The script mirrors the exact lexicographic sort used by
 * `backend/src/db/migrate.ts`, so the logical execution order of every
 * migration is preserved precisely.
 *
 * Safety guarantees
 * ─────────────────
 * 1. CONTENT IMMUTABILITY — zero bytes of SQL are changed.
 * 2. ATOMIC VALIDATION — the full rename map is built and validated BEFORE
 *    any rename is executed. A conflict or mismatch aborts everything.
 * 3. IDEMPOTENT — if the directory is already in canonical form (no duplicates,
 *    no gaps) the script exits 0 with a "nothing to do" message.
 * 4. DRY-RUN — pass --dry-run to print the rename plan without touching files.
 *
 * Usage
 * ─────
 *   node scripts/resequence-migrations.mjs
 *   node scripts/resequence-migrations.mjs --dry-run
 *
 * When to run
 * ───────────
 * Run this script ONLY when the migrations directory contains duplicate or
 * out-of-order prefixes. After the script runs, commit both the renamed
 * migration files and renamed rollback files together in a single atomic commit
 * with the message: `chore(db): re-sequence migrations to eliminate duplicates`
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT      = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'backend', 'src', 'db', 'migrations');
const ROLLBACKS_DIR  = path.join(REPO_ROOT, 'backend', 'src', 'db', 'rollbacks');

// ─── CLI flags ────────────────────────────────────────────────────────────────

const IS_DRY_RUN = process.argv.includes('--dry-run');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read all *.sql files in a directory and return them sorted lexicographically
 * (the same order the migration runner uses).
 */
function readSqlFiles(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

/**
 * Extract the numeric prefix from a filename such as "012_create_wallets.sql".
 * Returns the raw string (e.g. "012") or null if no prefix is found.
 */
function extractPrefix(filename) {
  const m = filename.match(/^(\d+)_/);
  return m ? m[1] : null;
}

/**
 * Extract the descriptive stem (everything after the numeric prefix and
 * underscore separator).  e.g. "012_create_wallets.sql" → "create_wallets.sql"
 */
function extractStem(filename) {
  return filename.replace(/^\d+_/, '');
}

/**
 * Zero-pad a number to at least 3 digits.
 */
function pad(n) {
  return String(n).padStart(3, '0');
}

/**
 * Check whether an array of filenames already has all unique, contiguous
 * prefixes starting at 001 with no gaps.
 */
function isAlreadyCanonical(files) {
  for (let i = 0; i < files.length; i++) {
    const prefix = extractPrefix(files[i]);
    if (prefix === null) return false;
    if (parseInt(prefix, 10) !== i + 1) return false;
  }
  return true;
}

/**
 * Detect duplicate prefixes and return a Map of prefix → [filenames].
 */
function findDuplicates(files) {
  const prefixMap = new Map();
  for (const f of files) {
    const p = extractPrefix(f);
    if (!prefixMap.has(p)) prefixMap.set(p, []);
    prefixMap.get(p).push(f);
  }
  const dupes = new Map();
  for (const [p, names] of prefixMap) {
    if (names.length > 1) dupes.set(p, names);
  }
  return dupes;
}

/**
 * Print a formatted rename table to stdout.
 */
function printRenameTable(renames, label) {
  const maxOld = Math.max(...renames.map(r => r.oldName.length), 'OLD FILENAME'.length);
  const maxNew = Math.max(...renames.map(r => r.newName.length), 'NEW FILENAME'.length);
  const sep    = '─'.repeat(maxOld + maxNew + 7);

  console.log(`\n${label}`);
  console.log(sep);
  console.log(
    `  ${'OLD FILENAME'.padEnd(maxOld)}  →  ${'NEW FILENAME'}`
  );
  console.log(sep);
  for (const { oldName, newName, changed } of renames) {
    const arrow = changed ? ' →  ' : ' ·  ';
    const mark  = changed ? '' : ' (unchanged)';
    console.log(`  ${oldName.padEnd(maxOld)}${arrow}${newName}${mark}`);
  }
  console.log(sep);
  const changedCount = renames.filter(r => r.changed).length;
  console.log(`  ${changedCount} file(s) will be renamed, ${renames.length - changedCount} unchanged.\n`);
}

// ─── Core ─────────────────────────────────────────────────────────────────────

function buildRenameMap(files, dir) {
  const renames = [];
  for (let i = 0; i < files.length; i++) {
    const oldName = files[i];
    const stem    = extractStem(oldName);
    const newName = `${pad(i + 1)}_${stem}`;
    renames.push({ oldName, newName, changed: oldName !== newName, dir });
  }
  return renames;
}

function validateNoDuplicateTargets(renames) {
  const seen = new Set();
  for (const { newName } of renames) {
    if (seen.has(newName)) {
      throw new Error(`BUG: Duplicate target filename generated: "${newName}". Aborting.`);
    }
    seen.add(newName);
  }
}

/**
 * Execute a list of renames. Uses a two-phase strategy (temp-name then final-name)
 * to safely handle cases where two files are effectively swapping names, which
 * would cause a conflict on case-insensitive file systems (macOS, Windows).
 */
function executeRenames(renames) {
  const changed = renames.filter(r => r.changed);

  // Phase 1: rename all changed files to a temporary name
  for (const { oldName, dir } of changed) {
    const src  = path.join(dir, oldName);
    const tmp  = path.join(dir, `__tmp_reseq__${oldName}`);
    fs.renameSync(src, tmp);
  }

  // Phase 2: rename from temporary name to final name
  for (const { oldName, newName, dir } of changed) {
    const tmp  = path.join(dir, `__tmp_reseq__${oldName}`);
    const dest = path.join(dir, newName);
    fs.renameSync(tmp, dest);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          PayD Migration Re-Sequencer                     ║');
  if (IS_DRY_RUN) {
    console.log('║                    *** DRY RUN ***                       ║');
  }
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // ── 1. Read files ──────────────────────────────────────────────────────────
  const migrationFiles = readSqlFiles(MIGRATIONS_DIR);
  const rollbackFiles  = readSqlFiles(ROLLBACKS_DIR);

  console.log(`  Migrations : ${migrationFiles.length} file(s) found in`);
  console.log(`               ${MIGRATIONS_DIR}`);
  console.log(`  Rollbacks  : ${rollbackFiles.length} file(s) found in`);
  console.log(`               ${ROLLBACKS_DIR}`);
  console.log('');

  // ── 2. Idempotency check ───────────────────────────────────────────────────
  const migDupes = findDuplicates(migrationFiles);
  const rbDupes  = findDuplicates(rollbackFiles);

  if (migDupes.size === 0 && rbDupes.size === 0 &&
      isAlreadyCanonical(migrationFiles) && isAlreadyCanonical(rollbackFiles)) {
    console.log('  ✓ Both directories are already in canonical form.');
    console.log('  Nothing to do. Exiting 0.\n');
    process.exit(0);
  }

  // ── 3. Report duplicates ───────────────────────────────────────────────────
  if (migDupes.size > 0) {
    console.log(`  ⚠  Duplicate prefixes found in migrations/:`);
    for (const [prefix, names] of migDupes) {
      console.log(`     "${prefix}_" →`);
      for (const n of names) console.log(`       - ${n}`);
    }
    console.log('');
  }
  if (rbDupes.size > 0) {
    console.log(`  ⚠  Duplicate prefixes found in rollbacks/:`);
    for (const [prefix, names] of rbDupes) {
      console.log(`     "${prefix}_" →`);
      for (const n of names) console.log(`       - ${n}`);
    }
    console.log('');
  }

  // ── 4. Build rename maps ───────────────────────────────────────────────────
  const migrationRenames = buildRenameMap(migrationFiles, MIGRATIONS_DIR);
  const rollbackRenames  = buildRenameMap(rollbackFiles,  ROLLBACKS_DIR);

  // ── 5. Validate no target conflicts ───────────────────────────────────────
  validateNoDuplicateTargets(migrationRenames);
  validateNoDuplicateTargets(rollbackRenames);

  // ── 6. Print the rename plan ───────────────────────────────────────────────
  printRenameTable(migrationRenames, '  MIGRATION RENAMES  (backend/src/db/migrations/)');
  printRenameTable(rollbackRenames,  '  ROLLBACK RENAMES   (backend/src/db/rollbacks/)');

  // ── 7. Dry-run exit ────────────────────────────────────────────────────────
  if (IS_DRY_RUN) {
    console.log('  [dry-run] No files were changed.');
    console.log('  Run without --dry-run to apply the renames.\n');
    process.exit(0);
  }

  // ── 8. Execute renames ─────────────────────────────────────────────────────
  console.log('  Executing migration renames...');
  executeRenames(migrationRenames);
  console.log('  ✓ Migration files renamed.');

  console.log('  Executing rollback renames...');
  executeRenames(rollbackRenames);
  console.log('  ✓ Rollback files renamed.');

  // ── 9. Post-run verification ───────────────────────────────────────────────
  const finalMig = readSqlFiles(MIGRATIONS_DIR);
  const finalRb  = readSqlFiles(ROLLBACKS_DIR);

  const finalMigDupes = findDuplicates(finalMig);
  const finalRbDupes  = findDuplicates(finalRb);

  if (finalMigDupes.size > 0 || finalRbDupes.size > 0) {
    console.error('  ✗ VERIFICATION FAILED: duplicates still present after renames!');
    process.exit(1);
  }

  if (!isAlreadyCanonical(finalMig)) {
    console.error('  ✗ VERIFICATION FAILED: migrations directory is not canonical after renames!');
    process.exit(1);
  }

  if (!isAlreadyCanonical(finalRb)) {
    console.error('  ✗ VERIFICATION FAILED: rollbacks directory is not canonical after renames!');
    process.exit(1);
  }

  console.log('');
  console.log('  ✓ Post-run verification passed.');
  console.log(`  ✓ ${finalMig.length} migrations are now uniquely and contiguously numbered.`);
  console.log(`  ✓ ${finalRb.length} rollbacks are now uniquely and contiguously numbered.`);
  console.log('');
  console.log('  Next steps:');
  console.log('    1. git add backend/src/db/migrations/ backend/src/db/rollbacks/');
  console.log('    2. git commit -m "chore(db): re-sequence migrations to eliminate duplicates"');
  console.log('    3. git push');
  console.log('');
  process.exit(0);
}

main();
