import { Request, Response } from 'express';
import { ContractRegistryService } from '../services/contractRegistryService.js';
import logger from '../utils/logger.js';

export class ContractRegistryController {
     /**
      * GET /api/contracts
      * Returns all contracts across all networks
      * Optional query param: ?network=testnet
      */
     static async getContracts(req: Request, res: Response): Promise<void> {
          const startTime = Date.now();

          try {
               const { network } = req.query;

               let responseData;

               if (typeof network === 'string' && network.length > 0) {
                    const contracts =
                         ContractRegistryService.getContractsByNetwork(network);

                    responseData = {
                         network,
                         contracts,
                         count: Object.keys(contracts).length,
                    };
               } else {
                    const networks = ContractRegistryService.getAllContracts();

                    responseData = {
                         networks,
                         count: Object.keys(networks).length,
                    };
               }

               // Set response headers
               res.setHeader('Content-Type', 'application/json');
               res.setHeader('Cache-Control', 'public, max-age=3600'); // cache 1 hour

               const responseTime = Date.now() - startTime;

               if (responseTime > 500) {
                    logger.warn(
                         `Contract registry response slow: ${responseTime}ms`
                    );
               }

               res.status(200).json({
                    ...responseData,
                    timestamp: new Date().toISOString(),
               });
          } catch (error) {
               logger.error('Error retrieving contract registry', error);

               res.status(500).json({
                    error: 'Internal Server Error',
                    message:
                         error instanceof Error
                              ? error.message
                              : 'Failed to load contract registry',
                    timestamp: new Date().toISOString(),
               });
          }
     }
}