export interface TemplateOptions {
  columns: string[];
  sampleData?: Record<string, string>[];
}

function toCSVField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function generateCSVTemplate(options: TemplateOptions): string {
  const { columns, sampleData = [] } = options;

  const header = columns.map(toCSVField).join(',');

  const rows = sampleData.length > 0 ? sampleData : generateDefaultSampleRows(columns);

  const csvContent = [
    header,
    ...rows.map((row) => columns.map((col) => toCSVField(row[col] || '')).join(',')),
  ].join('\n');

  return csvContent;
}

function generateDefaultSampleRows(columns: string[]): Record<string, string>[] {
  return [
    columns.reduce(
      (row, col) => ({
        ...row,
        [col]: generateSampleValue(col),
      }),
      {}
    ),
  ];
}

function generateSampleValue(columnName: string): string {
  const lowerName = columnName.toLowerCase();

  if (lowerName.includes('email')) return 'john.doe@example.com';
  if (lowerName.includes('name')) return 'John Doe';
  if (lowerName.includes('phone')) return '+1-555-0100';
  if (lowerName.includes('amount')) return '1000.00';
  if (lowerName.includes('date')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  if (lowerName.includes('id')) return 'EMP001';
  if (lowerName.includes('department')) return 'Engineering';

  return 'Sample Data';
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export interface ColumnMapping {
  [sourceColumn: string]: string;
}

export function mapRowData(
  row: Record<string, string>,
  mapping: ColumnMapping
): Record<string, string> {
  const mappedRow: Record<string, string> = {};

  Object.entries(mapping).forEach(([sourceCol, targetCol]) => {
    if (sourceCol in row) {
      mappedRow[targetCol] = row[sourceCol];
    }
  });

  return mappedRow;
}

export function createAutoMapping(uploadedHeaders: string[], requiredColumns: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const uploadedHeadersLower = uploadedHeaders.map((h) => h.toLowerCase());
  const requiredColumnsLower = requiredColumns.map((c) => c.toLowerCase());

  requiredColumns.forEach((required) => {
    const requiredLower = required.toLowerCase();
    const matchIndex = uploadedHeadersLower.findIndex((h) => h === requiredLower);

    if (matchIndex !== -1) {
      mapping[uploadedHeaders[matchIndex]] = required;
    }
  });

  return mapping;
}
