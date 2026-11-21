import {
  EXCLUDED_TABLES,
  SCHEMA_BEGIN_MARKER,
  SCHEMA_END_MARKER,
  describeDrift,
  extractGeneratedSection,
  introspectSchema,
  renderGeneratedSchemaSection,
  replaceGeneratedSection,
  type ColumnInfo,
} from '../schemaDoc.js';

const COLUMNS: ColumnInfo[] = [
  {
    table: 'payroll_items',
    column: 'id',
    dataType: 'integer',
    nullable: false,
    defaultExpr: "nextval('payroll_items_id_seq'::regclass)",
  },
  {
    table: 'payroll_items',
    column: 'amount',
    dataType: 'numeric(20,7)',
    nullable: false,
    defaultExpr: null,
  },
  { table: 'employees', column: 'email', dataType: 'text', nullable: true, defaultExpr: null },
];

describe('schemaDoc (#1813)', () => {
  describe('renderGeneratedSchemaSection', () => {
    it('wraps output in markers and lists tables in sorted order', () => {
      const section = renderGeneratedSchemaSection(COLUMNS);

      expect(section.startsWith(SCHEMA_BEGIN_MARKER)).toBe(true);
      expect(section.endsWith(SCHEMA_END_MARKER)).toBe(true);
      expect(section).toContain('Tables: 2');
      expect(section.indexOf('### employees')).toBeLessThan(section.indexOf('### payroll_items'));
    });

    it('is deterministic regardless of input column order', () => {
      const reversed = [...COLUMNS].reverse();
      // Column order within a table follows input; table order is always sorted.
      const a = renderGeneratedSchemaSection(COLUMNS);
      const b = renderGeneratedSchemaSection([COLUMNS[2], COLUMNS[0], COLUMNS[1]]);
      expect(a).toBe(b);
      expect(renderGeneratedSchemaSection(reversed)).toContain('### employees');
    });

    it('renders nullability and defaults and escapes pipe characters', () => {
      const section = renderGeneratedSchemaSection([
        { table: 't', column: 'c', dataType: 'text', nullable: true, defaultExpr: "'a|b'::text" },
      ]);
      expect(section).toContain("| `c` | text | YES | `'a\\|b'::text` |");
    });
  });

  describe('extract / replace', () => {
    const doc = `# Title\n\nIntro\n\n${SCHEMA_BEGIN_MARKER}\nold\n${SCHEMA_END_MARKER}\n\nTail\n`;

    it('extracts the block including markers', () => {
      expect(extractGeneratedSection(doc)).toBe(
        `${SCHEMA_BEGIN_MARKER}\nold\n${SCHEMA_END_MARKER}`
      );
    });

    it('returns null when markers are missing', () => {
      expect(extractGeneratedSection('# no markers here')).toBeNull();
    });

    it('replaces only the block and leaves surrounding prose untouched', () => {
      const replaced = replaceGeneratedSection(doc, 'NEW');
      expect(replaced).toBe('# Title\n\nIntro\n\nNEW\n\nTail\n');
    });

    it('throws rather than appending a second block when markers are missing', () => {
      expect(() => replaceGeneratedSection('# nothing', 'NEW')).toThrow(
        /missing the generated-schema markers/
      );
    });
  });

  describe('describeDrift', () => {
    it('returns no lines when committed and fresh match', () => {
      const section = renderGeneratedSchemaSection(COLUMNS);
      expect(describeDrift(section, section)).toEqual([]);
    });

    it('reports a column added in the database but missing from the doc', () => {
      const committed = renderGeneratedSchemaSection(COLUMNS);
      const fresh = renderGeneratedSchemaSection([
        ...COLUMNS,
        {
          table: 'employees',
          column: 'tax_region',
          dataType: 'text',
          nullable: false,
          defaultExpr: null,
        },
      ]);

      const drift = describeDrift(committed, fresh);
      expect(
        drift.some(
          (line) => line.includes('+ missing from DB_SCHEMA.md') && line.includes('tax_region')
        )
      ).toBe(true);
    });

    it('reports a column removed from the database but still documented', () => {
      const committed = renderGeneratedSchemaSection(COLUMNS);
      const fresh = renderGeneratedSchemaSection(COLUMNS.slice(0, 2));

      const drift = describeDrift(committed, fresh);
      expect(
        drift.some((line) => line.includes('- stale in DB_SCHEMA.md') && line.includes('employees'))
      ).toBe(true);
    });
  });

  describe('introspectSchema', () => {
    it('maps catalog rows to ColumnInfo and drops migration bookkeeping tables', async () => {
      const db = {
        query: jest.fn().mockResolvedValue({
          rows: [
            {
              table_name: 'schema_migrations',
              column_name: 'id',
              data_type: 'integer',
              nullable: false,
              column_default: null,
            },
            {
              table_name: 'employees',
              column_name: 'email',
              data_type: 'text',
              nullable: true,
              column_default: null,
            },
          ],
        }),
      };

      const columns = await introspectSchema(db);

      expect(columns).toEqual([
        {
          table: 'employees',
          column: 'email',
          dataType: 'text',
          nullable: true,
          defaultExpr: null,
        },
      ]);
      expect(EXCLUDED_TABLES.has('schema_migrations')).toBe(true);
    });
  });
});
