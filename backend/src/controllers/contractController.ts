/**
 * Contract Controller
 * Handles requests for the Contract Address Registry API
 */

import { Request, Response } from 'express';
import { ContractConfigService } from '../services/contractConfigService.js';
import { validateContractEntry, ContractEntry } from '../utils/contractValidator.js';
import logger from '../utils/logger.js';

export class ContractController {
  private static configService = new ContractConfigService();

  /**
   * GET /api/contracts
   * Returns all deployed contract addresses with metadata
   */
  static async getContracts(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Fetch contract entries from configuration
      const rawEntries = ContractController.configService.getContractEntries();

      // Validate and filter entries
      const validEntries: ContractEntry[] = [];
      
      for (const entry of rawEntries) {
        const validation = validateContractEntry(entry);
        
        if (validation.isValid) {
          validEntries.push(entry as ContractEntry);
        } else {
          logger.warn(
            `Invalid contract entry for ${entry.contractType} on ${entry.network}`,
            { errors: validation.errors }
          );
        }
      }

      // Format response
      const response = {
        contracts: validEntries,
        timestamp: new Date().toISOString(),
        count: validEntries.length
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
      logger.error('Error in getContracts', error);
      
      const errorResponse = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to retrieve contract registry',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(errorResponse);
    }
  }
}
