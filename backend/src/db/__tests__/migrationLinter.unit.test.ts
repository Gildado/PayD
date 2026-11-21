import {
  lintMigrationSql,
  lintResultFails,
  maskSqlNonCode,
  type LintRule,
} from '../migrationLinter.js';

const rulesOf = (sql: string): LintRule[] =>
  lintMigrationSql('test.sql', sql).violations.map((v) => v.rule);

describe('migrationLinter (#1812)', () => {
  describe('safe statements', () => {
    it('allows CREATE TABLE, including NOT NULL columns with no default (new table has no rows)', () => {
      const sql = `CREATE TABLE IF NOT EXISTS widgets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      );`;
      expect(rulesOf(sql)).toEqual([]);
    });

    it('allows ADD COLUMN that is nullable', () => {
      expect(rulesOf('ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS note TEXT;')).toEqual([]);
    });

    it('allows ADD COLUMN NOT NULL when a DEFAULT is provided', () => {
      expect(
        rulesOf(
          'ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS retries INTEGER NOT NULL DEFAULT 0;'
        )
      ).toEqual([]);
    });

    it('allows DROP CONSTRAINT and DROP INDEX (not data-destructive)', () => {
      expect(rulesOf('ALTER TABLE payroll_items DROP CONSTRAINT payroll_items_check;')).toEqual([]);
      expect(rulesOf('DROP INDEX IF EXISTS idx_payroll_items_status;')).toEqual([]);
    });

    it('ignores destructive keywords inside comments and string literals', () => {
      const sql = `-- DROP TABLE should_not_flag;
      /* ALTER TABLE t RENAME TO x; */
      INSERT INTO notes (body) VALUES ('TRUNCATE the table later; DROP COLUMN x');`;
      expect(rulesOf(sql)).toEqual([]);
    });
  });

  describe('destructive statements', () => {
    it('flags DROP TABLE with the correct line number', () => {
      const result = lintMigrationSql('x.sql', 'SELECT 1;\n\nDROP TABLE legacy_payouts;');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toMatchObject({ rule: 'DROP_TABLE', line: 3 });
    });

    it('flags DROP SCHEMA and DROP DATABASE', () => {
      expect(rulesOf('DROP SCHEMA legacy CASCADE;')).toEqual(['DROP_TABLE']);
      expect(rulesOf('DROP DATABASE payd_old;')).toEqual(['DROP_TABLE']);
    });

    it('flags explicit DROP COLUMN', () => {
      expect(rulesOf('ALTER TABLE employees DROP COLUMN IF EXISTS legacy_code;')).toEqual([
        'DROP_COLUMN',
      ]);
    });

    it('flags implicit DROP <column> form', () => {
      expect(rulesOf('ALTER TABLE employees DROP legacy_code;')).toEqual(['DROP_COLUMN']);
    });

    it('flags each DROP COLUMN in a multi-action ALTER TABLE', () => {
      expect(rulesOf('ALTER TABLE t DROP COLUMN a, DROP COLUMN b;')).toEqual([
        'DROP_COLUMN',
        'DROP_COLUMN',
      ]);
    });

    it('flags TRUNCATE', () => {
      expect(rulesOf('TRUNCATE TABLE audit_logs;')).toEqual(['TRUNCATE']);
    });

    it('flags RENAME of tables and columns', () => {
      expect(rulesOf('ALTER TABLE employees RENAME TO staff;')).toEqual(['RENAME']);
      expect(rulesOf('ALTER TABLE employees RENAME COLUMN email TO work_email;')).toEqual([
        'RENAME',
      ]);
    });

    it('flags ADD COLUMN ... NOT NULL without DEFAULT', () => {
      expect(rulesOf('ALTER TABLE employees ADD COLUMN tax_region VARCHAR(8) NOT NULL;')).toEqual([
        'NOT_NULL_NO_DEFAULT',
      ]);
    });

    it('flags only the offending column in a multi-column ADD', () => {
      const sql = `ALTER TABLE employees
        ADD COLUMN a INT NOT NULL,
        ADD COLUMN b INT NOT NULL DEFAULT 1,
        ADD COLUMN c TEXT;`;
      expect(rulesOf(sql)).toEqual(['NOT_NULL_NO_DEFAULT']);
    });

    it('flags SET NOT NULL on an existing column', () => {
      expect(rulesOf('ALTER TABLE employees ALTER COLUMN email SET NOT NULL;')).toEqual([
        'NOT_NULL_NO_DEFAULT',
      ]);
    });

    it('flags ALTER COLUMN ... TYPE', () => {
      expect(rulesOf('ALTER TABLE payroll_items ALTER COLUMN amount TYPE NUMERIC(20,7);')).toEqual([
        'ALTER_COLUMN_TYPE',
      ]);
    });
  });

  describe('marker handling', () => {
    it('suppresses violations when the marker has a reason, and reports them as allowed', () => {
      const sql = `-- lint:allow-destructive: legacy table verified empty and unused since 2025
DROP TABLE legacy_sessions;`;
      const result = lintMigrationSql('legacy.sql', sql);

      expect(result.violations).toEqual([]);
      expect(result.allowed.map((a) => a.rule)).toEqual(['DROP_TABLE']);
      expect(result.allowReason).toContain('verified empty');
      expect(lintResultFails(result)).toBe(false);
    });

    it('fails a destructive file whose marker has no reason', () => {
      const result = lintMigrationSql('bad.sql', '-- lint:allow-destructive\nDROP TABLE t;');

      expect(result.markerError).toBeDefined();
      expect(lintResultFails(result)).toBe(true);
    });

    it('fails an unmarked destructive statement', () => {
      const result = lintMigrationSql('bad.sql', 'DROP TABLE t;');
      expect(result.violations).toHaveLength(1);
      expect(lintResultFails(result)).toBe(true);
    });

    it('does not treat a marker inside a string literal as a marker', () => {
      const sql = `INSERT INTO docs (body) VALUES ('-- lint:allow-destructive: nope');
DROP TABLE t;`;
      const result = lintMigrationSql('x.sql', sql);
      expect(result.violations).toHaveLength(1);
      expect(result.allowReason).toBeUndefined();
    });
  });

  describe('maskSqlNonCode', () => {
    it('preserves length and newlines so offsets still line up', () => {
      const sql = "SELECT 'a;b' -- trailing\n/* block */ FROM t;";
      const masked = maskSqlNonCode(sql);
      expect(masked).toHaveLength(sql.length);
      expect(masked.split('\n')).toHaveLength(2);
      expect(masked).toContain('FROM t;');
      expect(masked).not.toContain('a;b');
    });

    it('handles escaped single quotes inside strings', () => {
      const masked = maskSqlNonCode("SELECT 'it''s DROP TABLE x' FROM t;");
      expect(masked).not.toContain('DROP');
    });
  });

  it('exposes every rule name used by the CLI report', () => {
    const rules: LintRule[] = [
      'DROP_TABLE',
      'DROP_COLUMN',
      'TRUNCATE',
      'RENAME',
      'NOT_NULL_NO_DEFAULT',
      'ALTER_COLUMN_TYPE',
    ];
    expect(new Set(rules).size).toBe(6);
  });
});
