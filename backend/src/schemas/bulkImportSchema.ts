import { z } from 'zod';

/** Maximum UTF-8 byte length for bulk-import CSV payload (~1 MB). */
export const MAX_BULK_IMPORT_CSV_BYTES = 1_048_576;

/** JSON body limit for bulk-import requests (CSV max + encoding overhead). */
export const MAX_BULK_IMPORT_REQUEST_BYTES = MAX_BULK_IMPORT_CSV_BYTES + 65_536;

export const bulkImportBodySchema = z.object({
  organization_id: z.coerce.number().int().positive().optional(),
  csv: z.string().min(1, 'Missing csv content'),
});

export type BulkImportBody = z.infer<typeof bulkImportBodySchema>;

export function isCsvContentOversized(csvContent: string): boolean {
  return Buffer.byteLength(csvContent, 'utf8') > MAX_BULK_IMPORT_CSV_BYTES;
}
