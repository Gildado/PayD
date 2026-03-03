import request from 'supertest';
import express from 'express';
import contractRegistryRoutes from '../../routes/contractRegistryRoutes.js';
import { ContractRegistryService } from '../../services/contractRegistryService.js';
import logger from '../../utils/logger.js';

jest.mock('../../services/contractRegistryService');
jest.mock('../../utils/logger');

const app = express();
app.use(express.json());
app.use('/api', contractRegistryRoutes);

describe('Contract Registry API Integration', () => {
     beforeEach(() => {
          jest.clearAllMocks();
     });

     describe('GET /api/contracts', () => {
          it('returns all networks when no query param provided', async () => {
               (ContractRegistryService.getAllContracts as jest.Mock)
                    .mockReturnValue({
                         testnet: {
                              bulk_payment: {
                                   contractId: 'CBULK_TEST',
                                   version: '1.0.0',
                                   deployedAt: 123456,
                              },
                         },
                    });

               const response = await request(app).get('/api/contracts');

               expect(response.status).toBe(200);
               expect(response.body).toHaveProperty('networks');
               expect(response.body.count).toBe(1);
               expect(response.body.networks.testnet).toBeDefined();
               expect(response.body).toHaveProperty('timestamp');
          });

          it('returns specific network when query param is provided', async () => {
               (ContractRegistryService.getContractsByNetwork as jest.Mock)
                    .mockReturnValue({
                         bulk_payment: {
                              contractId: 'CBULK_TEST',
                              version: '1.0.0',
                              deployedAt: 123456,
                         },
                    });

               const response = await request(app)
                    .get('/api/contracts')
                    .query({ network: 'testnet' });

               expect(response.status).toBe(200);
               expect(response.body.network).toBe('testnet');
               expect(response.body.contracts.bulk_payment).toBeDefined();
               expect(response.body.count).toBe(1);
          });

          it('returns 500 when service throws error', async () => {
               (ContractRegistryService.getAllContracts as jest.Mock)
                    .mockImplementation(() => {
                         throw new Error('Registry load failed');
                    });

               const response = await request(app).get('/api/contracts');

               expect(response.status).toBe(500);
               expect(response.body.error).toBe('Internal Server Error');
               expect(response.body.message).toBe('Registry load failed');
               expect(logger.error).toHaveBeenCalled();
          });

          it('logs warning if response time exceeds 500ms', async () => {
               (ContractRegistryService.getAllContracts as jest.Mock)
                    .mockReturnValue({});

               // Mock slow response
               const originalNow = Date.now;
               let time = 0;
               Date.now = jest.fn(() => {
                    time += 600;
                    return time;
               });

               await request(app).get('/api/contracts');

               expect(logger.warn).toHaveBeenCalledWith(
                    expect.stringContaining('Contract registry response slow')
               );

               Date.now = originalNow;
          });
     });
});