/**
 * Contract Controller
 * Handles requests for the Contract Address Registry API
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { ContractConfigService } from '../services/contractConfigService.js';
import { validateContractEntry, ContractEntry } from '../utils/contractValidator.js';
import logger from '../utils/logger.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export class ContractController {
  private static configService = new ContractConfigService();

  /**
   * GET /api/contracts
   * Returns all deployed contract addresses with metadata
   */
  static async getContracts(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate query parameters
      const { page, limit } = listQuerySchema.parse(req.query);

      // Fetch contract entries from configuration
      const rawEntries = ContractController.configService.getContractEntries();

      // Validate and filter entries
      const validEntries: ContractEntry[] = [];

      for (const entry of rawEntries) {
        const validation = validateContractEntry(entry);

        if (validation.isValid) {
          validEntries.push(entry as ContractEntry);
        } else {
          logger.warn(`Invalid contract entry for ${entry.contractType} on ${entry.network}`, {
            errors: validation.errors,
          });
        }
      }

      // Paginate in-memory
      const total = validEntries.length;
      const offset = (page - 1) * limit;
      const paginatedEntries = validEntries.slice(offset, offset + limit);

      // Format response
      const response = {
        contracts: paginatedEntries,
        timestamp: new Date().toISOString(),
        count: paginatedEntries.length,
        total,
        page,
        limit,
      };

      // Set headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache

      // Check response time
      const responseTime = Date.now() - startTime;
      if (responseTime > 500) {
        logger.warn(`Response time exceeded 500ms: ${responseTime}ms`);
      }

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation Error', details: error.issues });
        return;
      }

      logger.error('Error in getContracts', error);

      const errorResponse = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to retrieve contract registry',
        timestamp: new Date().toISOString(),
      };

      res.status(500).json(errorResponse);
    }
  }
}
