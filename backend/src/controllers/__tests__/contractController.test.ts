/**
 * Contract Controller Tests
 * Tests for the Contract Address Registry API endpoint
 */

import { Request, Response } from 'express';
import { ContractController } from '../contractController.js';
import { ContractConfigService } from '../../services/contractConfigService.js';
import { ContractEntry } from '../../utils/contractValidator.js';

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

    mockRequest = { query: {} };
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
          contractId: 'CABC12345678901234567890123456789012345678901234567890123',
          network: 'testnet',
          contractType: 'bulk_payment',
          version: '1.0.0',
          deployedAt: 12345,
        },
        {
          contractId: 'CDEF12345678901234567890123456789012345678901234567890123',
          network: 'testnet',
          contractType: 'vesting_escrow',
          version: '1.0.0',
          deployedAt: 12346,
        },
      ];

      ((ContractController as any).configService.getContractEntries as jest.Mock).mockReturnValue(mockEntries);

      await ContractController.getContracts(mockRequest as Request, mockResponse as Response);

      expect(mockSetHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockSetHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          contracts: mockEntries,
          count: 2,
          total: 2,
          page: 1,
          limit: 20,
          timestamp: expect.any(String),
        })
      );
    });

    it('should filter out invalid contract entries', async () => {
      const mockEntries: Partial<ContractEntry>[] = [
        {
          contractId: 'CABC12345678901234567890123456789012345678901234567890123',
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

      ((ContractController as any).configService.getContractEntries as jest.Mock).mockReturnValue(mockEntries);

      await ContractController.getContracts(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 1,
          total: 1,
          page: 1,
          limit: 20,
        })
      );
    });

    it('should handle errors gracefully', async () => {
      ((ContractController as any).configService.getContractEntries as jest.Mock).mockImplementation(() => {
        throw new Error('Configuration error');
      });

      await ContractController.getContracts(mockRequest as Request, mockResponse as Response);

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
      ((ContractController as any).configService.getContractEntries as jest.Mock).mockReturnValue([]);

      await ContractController.getContracts(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          contracts: [],
          count: 0,
          total: 0,
          page: 1,
          limit: 20,
        })
      );
    });

    it('should correctly paginate response when page and limit query parameters are provided', async () => {
      const mockEntries: ContractEntry[] = [
        {
          contractId: 'CABC12345678901234567890123456789012345678901234567890123',
          network: 'testnet',
          contractType: 'bulk_payment',
          version: '1.0.0',
          deployedAt: 12345,
        },
        {
          contractId: 'CDEF12345678901234567890123456789012345678901234567890123',
          network: 'testnet',
          contractType: 'vesting_escrow',
          version: '1.0.0',
          deployedAt: 12346,
        },
        {
          contractId: 'CGHI12345678901234567890123456789012345678901234567890123',
          network: 'testnet',
          contractType: 'other_contract',
          version: '1.0.0',
          deployedAt: 12347,
        },
      ];

      ((ContractController as any).configService.getContractEntries as jest.Mock).mockReturnValue(mockEntries);

      mockRequest.query = { page: '2', limit: '1' };

      await ContractController.getContracts(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          contracts: [mockEntries[1]],
          count: 1,
          total: 3,
          page: 2,
          limit: 1,
          timestamp: expect.any(String),
        })
      );
    });

    it('should return 400 validation error for invalid query parameters', async () => {
      mockRequest.query = { page: 'invalid', limit: '-5' };

      await ContractController.getContracts(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation Error',
          details: expect.any(Array),
        })
      );
    });
  });
});
