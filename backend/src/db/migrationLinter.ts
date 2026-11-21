/**
 * @file src/db/migrationLinter.ts
 * @description Static linter for SQL migration files (#1812).
 *
 * Flags statements that can destroy data or break running application
 * instances during a deploy:
 *
 *   DROP_TABLE          DROP TABLE / DROP SCHEMA / DROP DATABASE
 *   DROP_COLUMN         ALTER TABLE ... DROP COLUMN (or implicit `DROP <col>`)
 *   TRUNCATE            TRUNCATE ...
 *   RENAME              ALTER ... RENAME (tables, columns, indexes, types)
 *   NOT_NULL_NO_DEFAULT ADD COLUMN ... NOT NULL without DEFAULT, or SET NOT NULL
 *   ALTER_COLUMN_TYPE   ALTER COLUMN ... TYPE (may rewrite or lossy-cast data)
 *
 * A finding is suppressed only by an explicit, reasoned marker in the file:
 *
 *   -- lint:allow-destructive: <reason explaining why this is safe>
 *
 * The reason is mandatory. A marker with no reason is itself a violation.
 * Comments and string literals are masked before matching, so a keyword
 * inside `-- DROP TABLE x` or `'DROP TABLE'` never triggers a finding.
 *
 * Everything here is pure (no I/O) so it can be unit tested directly.
 */

export type LintRule =
  | 'DROP_TABLE'
  | 'DROP_COLUMN'
  | 'TRUNCATE'
  | 'RENAME'
  | 'NOT_NULL_NO_DEFAULT'
  | 'ALTER_COLUMN_TYPE';

export interface LintFinding {
  rule: LintRule;
  /** 1-indexed line in the original file where the statement starts. */
  line: number;
  /** Short, single-line excerpt of the offending statement. */
  statement: string;
  message: string;
}

export interface LintResult {
  filename: string;
  /** Destructive findings that were NOT covered by a marker. These fail CI. */
  violations: LintFinding[];
  /** Findings that a valid marker explicitly allowed. Reported, never failing. */
  allowed: LintFinding[];
  /** Set when a marker is present but has no reason. Fails CI. */
  markerError?: string;
  /** The reason from a valid marker, if present. */
  allowReason?: string;
}

/** Matches the marker and captures the reason text (may be empty). */
const MARKER_PATTERN = /^[ \t]*--[ \t]*lint:allow-destructive\b:?[ \t]*(.*)$/im;

/**
 * Replace comments and string literal contents with spaces, preserving length
 * and newlines so offsets and line numbers still map to the original text.
 * Handles `--` line comments, `/* *\/` block comments, '...' strings (with ''
 * escapes), and "..." quoted identifiers.
 */
export function maskSqlNonCode(sql: string): string {
  const out = sql.split('');
  let i = 0;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === '-' && next === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      blank(i, stop);
      i = stop;
    } else if (ch === '/' && next === '*') {
      const close = sql.indexOf('*/', i + 2);
      const stop = close === -1 ? sql.length : close + 2;
      blank(i, stop);
      i = stop;
    } else if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === quote) {
          if (sql[j + 1] === quote) {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      // Blank the contents but keep the quote characters themselves.
      blank(i + 1, Math.min(j, sql.length));
      i = j + 1;
    } else {
      i++;
    }
  }

  return out.join('');
}

interface Statement {
  /** Masked statement text (comments/strings blanked). */
  masked: string;
  /** Original statement text, used for excerpts. */
  original: string;
  /** Offset of the statement's first character in the file. */
  offset: number;
}

/** Split masked SQL into statements on top-level semicolons. */
function splitStatements(sql: string): Statement[] {
  const masked = maskSqlNonCode(sql);
  const statements: Statement[] = [];
  let start = 0;

  for (let i = 0; i <= masked.length; i++) {
    if (i === masked.length || masked[i] === ';') {
      const rawMasked = masked.slice(start, i);
      if (rawMasked.trim().length > 0) {
        const leading = rawMasked.length - rawMasked.trimStart().length;
        const offset = start + leading;
        statements.push({
          masked: rawMasked.trim(),
          original: sql.slice(offset, i).trim(),
          offset,
        });
      }
      start = i + 1;
    }
  }

  return statements;
}

/** Split text on a delimiter, ignoring delimiters nested in parentheses. */
function splitTopLevel(text: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function lineOf(sql: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < sql.length; i++) {
    if (sql[i] === '\n') line++;
  }
  return line;
}

function excerpt(statement: string): string {
  const oneLine = statement.replace(/\s+/g, ' ').trim();
  return oneLine.length > 120 ? `${oneLine.slice(0, 117)}...` : oneLine;
}

/** Lint one statement and return its findings (no marker handling). */
function lintStatement(stmt: Statement, sql: string): LintFinding[] {
  const findings: LintFinding[] = [];
  const text = stmt.masked;
  const push = (rule: LintRule, message: string) =>
    findings.push({
      rule,
      line: lineOf(sql, stmt.offset),
      statement: excerpt(stmt.original),
      message,
    });

  if (/^\s*DROP\s+(TABLE|SCHEMA|DATABASE)\b/i.test(text)) {
    push('DROP_TABLE', 'DROP removes an entire table, schema, or database and its data.');
  }

  if (/^\s*ALTER\s+TABLE\b/i.test(text)) {
    // Explicit `DROP COLUMN`, or the implicit `DROP <col>` form.
    const body = text.replace(/^\s*ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?(ONLY\s+)?\S+/i, '');
    const actions = splitTopLevel(body, ',');
    for (const action of actions) {
      if (
        /^\s*DROP\s+(COLUMN\b|(IF\s+EXISTS\s+)?(?!CONSTRAINT\b|DEFAULT\b|NOT\s+NULL\b|IDENTITY\b|EXPRESSION\b))/i.test(
          action
        )
      ) {
        push('DROP_COLUMN', 'DROP COLUMN permanently deletes column data.');
      }
    }
  }

  if (/^\s*TRUNCATE\b/i.test(text)) {
    push('TRUNCATE', 'TRUNCATE deletes every row in the table(s).');
  }

  if (/^\s*ALTER\s+(TABLE|INDEX|SEQUENCE|VIEW|TYPE|SCHEMA)\b[\s\S]*\bRENAME\b/i.test(text)) {
    push('RENAME', 'RENAME breaks any running application instance that still uses the old name.');
  }

  if (/^\s*ALTER\s+TABLE\b[\s\S]*\bALTER\s+COLUMN\b[\s\S]*\bTYPE\b/i.test(text)) {
    push(
      'ALTER_COLUMN_TYPE',
      'Changing a column type may rewrite the table or fail on existing values.'
    );
  }

  if (/^\s*ALTER\s+TABLE\b/i.test(text)) {
    if (/\bSET\s+NOT\s+NULL\b/i.test(text)) {
      push(
        'NOT_NULL_NO_DEFAULT',
        'SET NOT NULL fails if any existing row holds NULL in that column.'
      );
    }

    const body = text.replace(/^\s*ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?(ONLY\s+)?\S+/i, '');
    for (const action of splitTopLevel(body, ',')) {
      if (!/^\s*ADD\s+(COLUMN\s+)?(IF\s+NOT\s+EXISTS\s+)?/i.test(action)) continue;
      if (/^\s*ADD\s+(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK)\b/i.test(action)) continue;
      const hasNotNull = /\bNOT\s+NULL\b/i.test(action);
      const hasDefault =
        /\bDEFAULT\b/i.test(action) ||
        /\bGENERATED\b/i.test(action) ||
        /\bIDENTITY\b/i.test(action);
      if (hasNotNull && !hasDefault) {
        push(
          'NOT_NULL_NO_DEFAULT',
          'ADD COLUMN ... NOT NULL without a DEFAULT fails on tables that already have rows.'
        );
      }
    }
  }

  return findings;
}

/**
 * Lint a migration file's SQL content.
 *
 * @param filename - Used only for reporting.
 * @param sql      - Full file contents.
 */
export function lintMigrationSql(filename: string, sql: string): LintResult {
  const result: LintResult = { filename, violations: [], allowed: [] };

  const markerMatch = sql.match(MARKER_PATTERN);
  const reason = markerMatch ? markerMatch[1].trim() : undefined;

  if (markerMatch && !reason) {
    result.markerError =
      'lint:allow-destructive marker has no reason. Write the reason on the same line, ' +
      'e.g. "-- lint:allow-destructive: backfilled and verified in migration 060".';
  } else if (reason) {
    result.allowReason = reason;
  }

  const findings = splitStatements(sql).flatMap((stmt) => lintStatement(stmt, sql));

  if (reason) {
    result.allowed = findings;
  } else {
    result.violations = findings;
  }

  return result;
}

/** Human-readable report for CLI output. */
export function formatLintResult(result: LintResult): string {
  const lines: string[] = [];

  for (const v of result.violations) {
    lines.push(`✗ ${result.filename}:${v.line} [${v.rule}] ${v.message}`);
    lines.push(`    ${v.statement}`);
  }
  if (result.markerError) {
    lines.push(`✗ ${result.filename} [MARKER] ${result.markerError}`);
  }
  for (const a of result.allowed) {
    lines.push(`~ ${result.filename}:${a.line} [${a.rule}] allowed: ${result.allowReason}`);
  }

  return lines.join('\n');
}

/** A result fails CI when it has unmarked destructive statements or a bad marker. */
export function lintResultFails(result: LintResult): boolean {
  return result.violations.length > 0 || Boolean(result.markerError);
}
