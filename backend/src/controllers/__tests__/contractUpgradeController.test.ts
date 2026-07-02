import { Request, Response } from 'express';
import { ContractUpgradeController } from '../contractUpgradeController.js';
import { ContractUpgradeService } from '../../services/contractUpgradeService.js';

jest.mock('../../services/contractUpgradeService');

describe('ContractUpgradeController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();

    mockRequest = { query: {} };
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };

    jest.clearAllMocks();
  });

  describe('listContracts', () => {
    it('should return paginated contract records from service with default page and limit', async () => {
      const mockResult = {
        data: [
          {
            id: 1,
            name: 'AssetContract',
            contract_id: 'C123',
            current_wasm_hash: 'abcdef',
            version: '1.0.0',
            created_at: '2026-07-02T10:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      };

      (ContractUpgradeService.listContracts as jest.Mock).mockResolvedValue(mockResult);

      await ContractUpgradeController.listContracts(mockRequest as Request, mockResponse as Response);

      expect(ContractUpgradeService.listContracts).toHaveBeenCalledWith(1, 20);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        ...mockResult,
      });
    });

    it('should pass page and limit from query parameters to service', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 2,
        limit: 5,
      };

      (ContractUpgradeService.listContracts as jest.Mock).mockResolvedValue(mockResult);

      mockRequest.query = { page: '2', limit: '5' };

      await ContractUpgradeController.listContracts(mockRequest as Request, mockResponse as Response);

      expect(ContractUpgradeService.listContracts).toHaveBeenCalledWith(2, 5);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        ...mockResult,
      });
    });

    it('should return 400 validation error for invalid query parameters', async () => {
      mockRequest.query = { page: 'invalid', limit: '-5' };

      await ContractUpgradeController.listContracts(mockRequest as Request, mockResponse as Response);

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
