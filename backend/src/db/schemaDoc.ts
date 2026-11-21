/**
 * @file src/db/schemaDoc.ts
 * @description Generates and checks the machine-maintained schema reference in
 * DB_SCHEMA.md (#1813).
 *
 * The block between BEGIN/END markers is owned by `scripts/schema-doc.ts`:
 *   - `--write` regenerates it from a live database's catalog.
 *   - `--check` fails when the committed block differs from the database, which
 *     means a migration changed the schema without the doc being regenerated.
 *
 * Hand-written prose sections of DB_SCHEMA.md are outside the markers and are
 * not compared; only the generated block is the machine-checked source of truth.
 *
 * Everything here except `introspectSchema` is pure and unit-testable.
 */

export const SCHEMA_BEGIN_MARKER =
  '<!-- BEGIN:GENERATED-SCHEMA (do not edit by hand; run npm run db:schema-doc) -->';
export const SCHEMA_END_MARKER = '<!-- END:GENERATED-SCHEMA -->';

/** Migration bookkeeping tables are infrastructure, not part of the app schema. */
export const EXCLUDED_TABLES: ReadonlySet<string> = new Set([
  'schema_migrations',
  'migration_run_log',
  'migration_rollback_log',
]);

export interface ColumnInfo {
  table: string;
  column: string;
  dataType: string;
  nullable: boolean;
  defaultExpr: string | null;
}

/** Minimal query interface so the introspection works with `pg` clients and test doubles. */
export interface Queryable {
  query<T = any>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/** Read every ordinary table column in the `public` schema from the catalog. */
export async function introspectSchema(db: Queryable): Promise<ColumnInfo[]> {
  const { rows } = await db.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    nullable: boolean;
    column_default: string | null;
  }>(
    `SELECT c.relname                              AS table_name,
            a.attname                              AS column_name,
            format_type(a.atttypid, a.atttypmod)   AS data_type,
            NOT a.attnotnull                       AS nullable,
            pg_get_expr(d.adbin, d.adrelid)        AS column_default
       FROM pg_attribute a
       JOIN pg_class c       ON c.oid = a.attrelid
       JOIN pg_namespace n   ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d     ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY c.relname, a.attnum`
  );

  return rows
    .filter((r) => !EXCLUDED_TABLES.has(r.table_name))
    .map((r) => ({
      table: r.table_name,
      column: r.column_name,
      dataType: r.data_type,
      nullable: r.nullable,
      defaultExpr: r.column_default,
    }));
}

/** Escape pipe characters so values cannot break the Markdown table. */
function cell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

/**
 * Render the generated block (markers included). Deterministic: the same
 * columns always produce byte-identical output, which makes drift a plain
 * string comparison.
 */
export function renderGeneratedSchemaSection(columns: ColumnInfo[]): string {
  const byTable = new Map<string, ColumnInfo[]>();
  for (const col of columns) {
    if (!byTable.has(col.table)) byTable.set(col.table, []);
    byTable.get(col.table)!.push(col);
  }

  const lines: string[] = [
    SCHEMA_BEGIN_MARKER,
    '',
    '## Generated Schema Reference',
    '',
    `This section lists every table and column in the \`public\` schema after applying all migrations. ` +
      `It is checked in CI: if it is out of date, run \`npm run db:schema-doc\` and commit the result.`,
    '',
    `Tables: ${byTable.size}`,
    '',
  ];

  for (const table of [...byTable.keys()].sort()) {
    lines.push(`### ${table}`, '');
    lines.push('| Column | Type | Nullable | Default |');
    lines.push('|--------|------|----------|---------|');
    for (const col of byTable.get(table)!) {
      lines.push(
        `| \`${cell(col.column)}\` | ${cell(col.dataType)} | ${col.nullable ? 'YES' : 'NO'} | ${
          col.defaultExpr === null ? '' : `\`${cell(col.defaultExpr)}\``
        } |`
      );
    }
    lines.push('');
  }

  lines.push(SCHEMA_END_MARKER);
  return lines.join('\n');
}

/**
 * Return the generated block currently in `doc`, markers included, or null when
 * the markers are absent.
 */
export function extractGeneratedSection(doc: string): string | null {
  const start = doc.indexOf(SCHEMA_BEGIN_MARKER);
  const end = doc.indexOf(SCHEMA_END_MARKER);
  if (start === -1 || end === -1 || end < start) return null;
  return doc.slice(start, end + SCHEMA_END_MARKER.length);
}

/**
 * Replace the generated block in `doc` with `section`. Throws if the markers are
 * missing, so the script never silently appends a second copy.
 */
export function replaceGeneratedSection(doc: string, section: string): string {
  const start = doc.indexOf(SCHEMA_BEGIN_MARKER);
  const endMarker = doc.indexOf(SCHEMA_END_MARKER);
  if (start === -1 || endMarker === -1 || endMarker < start) {
    throw new Error(
      `DB_SCHEMA.md is missing the generated-schema markers:\n  ${SCHEMA_BEGIN_MARKER}\n  ${SCHEMA_END_MARKER}`
    );
  }
  return doc.slice(0, start) + section + doc.slice(endMarker + SCHEMA_END_MARKER.length);
}

/**
 * Describe how the committed block differs from the freshly rendered one, as a
 * list of human-readable lines. Empty when they match.
 */
export function describeDrift(committed: string, fresh: string): string[] {
  if (committed === fresh) return [];

  const committedLines = new Set(committed.split('\n'));
  const freshLines = new Set(fresh.split('\n'));
  const out: string[] = [];

  for (const line of freshLines) {
    if (!committedLines.has(line) && line.trim() !== '') {
      out.push(`+ missing from DB_SCHEMA.md: ${line}`);
    }
  }
  for (const line of committedLines) {
    if (!freshLines.has(line) && line.trim() !== '') {
      out.push(`- stale in DB_SCHEMA.md:     ${line}`);
    }
  }

  return out.length > 0 ? out : ['generated section differs in ordering or whitespace'];
}
