/**
 * @file scripts/schema-doc.ts
 * @description Regenerate or verify the generated schema block in DB_SCHEMA.md (#1813).
 *
 * Usage (from backend/, with DATABASE_URL set):
 *   npm run db:schema-doc                          # regenerate the block from the live DB
 *   npm run db:schema-doc:check                    # fail if DB_SCHEMA.md is out of date
 *   npm run db:schema-doc:check -- --apply-migrations
 *       # CI: first apply every migration file, in filename order, to an EMPTY
 *       # database, then check. Refuses to run if `public` already has tables.
 *
 * Why not call the migration runner? `migrate.ts` aborts on duplicate numeric
 * prefixes (currently two `062_` files), so this script applies the same files
 * in the same sorted order directly. Bookkeeping tables are excluded from the doc.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Client } from 'pg';

import {
  describeDrift,
  extractGeneratedSection,
  introspectSchema,
  renderGeneratedSchemaSection,
  replaceGeneratedSection,
  type Queryable,
} from '../src/db/schemaDoc.js';

const __filename = fileURLToPath(import.meta.url);
const backendDir = path.resolve(path.dirname(__filename), '..');
const migrationsDir = path.join(backendDir, 'src', 'db', 'migrations');
const docPath = path.resolve(backendDir, '..', 'DB_SCHEMA.md');

async function assertEmptyPublicSchema(client: Client): Promise<void> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema = 'public'`
  );
  if (Number(rows[0]?.n ?? 0) > 0) {
    throw new Error(
      '--apply-migrations refuses to run: the public schema already has tables. ' +
        'Point DATABASE_URL at an empty, ephemeral database.'
    );
  }
}

/** Apply every migration file in filename order, exactly as `psql -f` would. */
async function applyAllMigrations(client: Client): Promise<number> {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await client.query(sql);
    } catch (err) {
      throw new Error(
        `Migration ${file} failed to apply: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return files.length;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const checkOnly = argv.includes('--check');
  const applyMigrations = argv.includes('--apply-migrations');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[schema-doc] DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    if (applyMigrations) {
      await assertEmptyPublicSchema(client);
      const count = await applyAllMigrations(client);
      console.log(`[schema-doc] Applied ${count} migration file(s) to an empty database.`);
    }

    const columns = await introspectSchema(client as unknown as Queryable);
    const fresh = renderGeneratedSchemaSection(columns);
    const doc = fs.readFileSync(docPath, 'utf8');

    if (checkOnly) {
      const committed = extractGeneratedSection(doc);
      if (committed === null) {
        console.error(
          '[schema-doc] DB_SCHEMA.md has no generated-schema markers. Run npm run db:schema-doc.'
        );
        process.exit(1);
      }
      const drift = describeDrift(committed, fresh);
      if (drift.length > 0) {
        console.error(
          `[schema-doc] DRIFT: DB_SCHEMA.md does not match the migrated schema (${drift.length} line(s)).`
        );
        for (const line of drift) console.error(`  ${line}`);
        console.error('[schema-doc] Fix: run npm run db:schema-doc and commit DB_SCHEMA.md.');
        process.exit(1);
      }
      console.log(`[schema-doc] OK: DB_SCHEMA.md matches ${columns.length} column(s).`);
      process.exit(0);
    }

    fs.writeFileSync(docPath, replaceGeneratedSection(doc, fresh), 'utf8');
    console.log(`[schema-doc] Regenerated ${columns.length} column(s) into ${docPath}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[schema-doc] Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
