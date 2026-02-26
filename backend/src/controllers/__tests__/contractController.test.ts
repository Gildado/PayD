/**
 * Contract Controller Tests
 * Tests for the Contract Address Registry API endpoint
 */

import { Request, Response } from 'express';
import { ContractController } from '../contractController';
import { ContractConfigService } from '../../services/contractConfigService';
import { ContractEntry } from '../../utils/contractValidator';

// Mock the config service
jest.mock('../../services/contractConfigService');
jest.mock('../../utils/logger');

describe('ContractController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockSetHeader: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockSetHeader = jest.fn();

    mockRequest = {};
    mockResponse = {
      json: mockJson,
      status: mockStatus,
      setHeader: mockSetHeader,
    };

    jest.clearAllMocks();
  });

  describe('getContracts', () => {
    it('should return valid contract entries with proper headers', async () => {
      const mockEntries: ContractEntry[] = [
        {
          contractId: 'CABC123456789012345678901234567890123456789012345678901234',
          network: 'testnet',
          contractType: 'bulk_payment',
          version: '1.0.0',
          deployedAt: 12345,
        },
        {
          contractId: 'CDEF123456789012345678901234567890123456789012345678901234',
          network: 'testnet',
          contractType: 'vesting_escrow',
          version: '1.0.0',
          deployedAt: 12346,
        },
      ];

      const mockConfigService = ContractConfigService as jest.MockedClass<
        typeof ContractConfigService
      >;
      mockConfigService.prototype.getContractEntries = jest.fn().mockReturnValue(mockEntries);

      await ContractController.getContracts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockSetHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockSetHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          contracts: mockEntries,
          count: 2,
          timestamp: expect.any(String),
        })
      );
    });

    it('should filter out invalid contract entries', async () => {
      const mockEntries: Partial<ContractEntry>[] = [
        {
          contractId: 'CABC123456789012345678901234567890123456789012345678901234',
          network: 'testnet',
          contractType: 'bulk_payment',
          version: '1.0.0',
          deployedAt: 12345,
        },
        {
          contractId: 'INVALID',
          network: 'testnet',
          contractType: 'vesting_escrow',
          version: '1.0.0',
          deployedAt: 12346,
        },
      ];

      const mockConfigService = ContractConfigService as jest.MockedClass<
        typeof ContractConfigService
      >;
      mockConfigService.prototype.getContractEntries = jest.fn().mockReturnValue(mockEntries);

      await ContractController.getContracts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 1,
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const mockConfigService = ContractConfigService as jest.MockedClass<
        typeof ContractConfigService
      >;
      mockConfigService.prototype.getContractEntries = jest
        .fn()
        .mockImplementation(() => {
          throw new Error('Configuration error');
        });

      await ContractController.getContracts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal Server Error',
          message: 'Configuration error',
          timestamp: expect.any(String),
        })
      );
    });

    it('should return empty array when no contracts configured', async () => {
      const mockConfigService = ContractConfigService as jest.MockedClass<
        typeof ContractConfigService
      >;
      mockConfigService.prototype.getContractEntries = jest.fn().mockReturnValue([]);

      await ContractController.getContracts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          contracts: [],
          count: 0,
        })
      );
    });
  });
});
