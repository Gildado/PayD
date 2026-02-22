import { Request, Response } from 'express';
import searchService, { SearchFilters } from '../services/searchService';
import { z } from 'zod';

const searchQuerySchema = z.object({
  query: z.string().optional(),
  status: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : undefined)),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  amountMin: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || !isNaN(val), { message: 'Invalid number' }),
  amountMax: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || !isNaN(val), { message: 'Invalid number' }),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val > 0, { message: 'Invalid page number' }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val > 0, { message: 'Invalid limit number' }),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export class SearchController {
  async searchEmployees(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = parseInt(req.params.organizationId, 10);

      if (isNaN(organizationId) || organizationId < 0) {
        res.status(400).json({ error: 'Invalid organization ID' });
        return;
      }

      const filters = searchQuerySchema.parse(req.query) as SearchFilters;
      const result = await searchService.searchEmployees(organizationId, filters);

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
        return;
      }
      console.error('Error searching employees:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async searchTransactions(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = parseInt(req.params.organizationId, 10);

      if (isNaN(organizationId) || organizationId < 0) {
        res.status(400).json({ error: 'Invalid organization ID' });
        return;
      }

      const filters = searchQuerySchema.parse(req.query) as SearchFilters;
      const result = await searchService.searchTransactions(organizationId, filters);

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
        return;
      }
      console.error('Error searching transactions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new SearchController();
