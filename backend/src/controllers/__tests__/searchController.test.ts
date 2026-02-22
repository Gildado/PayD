import request from 'supertest';
import express from 'express';

// Mock env config before importing routes
jest.mock('../../config/env', () => ({
  config: {
    DATABASE_URL: 'postgres://mock',
    PORT: 3000,
  },
}));

import searchRoutes from '../../routes/searchRoutes';
import searchService from '../../services/searchService';

// Mock the search service
jest.mock('../../services/searchService');

const app = express();
app.use(express.json());
app.use('/api/search', searchRoutes);

describe('SearchController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/search/organizations/:organizationId/employees', () => {
    const mockEmployeeResult = {
      data: [
        {
          id: 1,
          organization_id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          wallet_address: 'GXXXXXXX1',
          status: 'active',
          position: 'Engineer',
          department: 'Engineering',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    };

    it('should return employees with default pagination', async () => {
      (searchService.searchEmployees as jest.Mock).mockResolvedValue(mockEmployeeResult);

      const response = await request(app).get('/api/search/organizations/1/employees').expect(200);

      expect(response.body).toEqual(mockEmployeeResult);
      expect(searchService.searchEmployees).toHaveBeenCalledWith(1, {
        page: 1,
        limit: 20,
      });
    });

    it('should search employees with query parameter', async () => {
      (searchService.searchEmployees as jest.Mock).mockResolvedValue(mockEmployeeResult);

      const response = await request(app)
        .get('/api/search/organizations/1/employees?query=john')
        .expect(200);

      expect(response.body).toEqual(mockEmployeeResult);
      expect(searchService.searchEmployees).toHaveBeenCalledWith(1, {
        query: 'john',
        page: 1,
        limit: 20,
      });
    });

    it('should filter employees by status', async () => {
      (searchService.searchEmployees as jest.Mock).mockResolvedValue(mockEmployeeResult);

      await request(app)
        .get('/api/search/organizations/1/employees?status=active,pending')
        .expect(200);

      expect(searchService.searchEmployees).toHaveBeenCalledWith(1, {
        status: ['active', 'pending'],
        page: 1,
        limit: 20,
      });
    });

    it('should filter employees by date range', async () => {
      (searchService.searchEmployees as jest.Mock).mockResolvedValue(mockEmployeeResult);

      await request(app)
        .get('/api/search/organizations/1/employees?dateFrom=2024-01-01&dateTo=2024-12-31')
        .expect(200);

      expect(searchService.searchEmployees).toHaveBeenCalledWith(1, {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        page: 1,
        limit: 20,
      });
    });

    it('should handle custom pagination', async () => {
      (searchService.searchEmployees as jest.Mock).mockResolvedValue({
        ...mockEmployeeResult,
        pagination: { page: 2, limit: 10, total: 50, totalPages: 5 },
      });

      await request(app).get('/api/search/organizations/1/employees?page=2&limit=10').expect(200);

      expect(searchService.searchEmployees).toHaveBeenCalledWith(1, {
        page: 2,
        limit: 10,
      });
    });

    it('should handle sorting parameters', async () => {
      (searchService.searchEmployees as jest.Mock).mockResolvedValue(mockEmployeeResult);

      await request(app)
        .get('/api/search/organizations/1/employees?sortBy=last_name&sortOrder=asc')
        .expect(200);

      expect(searchService.searchEmployees).toHaveBeenCalledWith(1, {
        sortBy: 'last_name',
        sortOrder: 'asc',
        page: 1,
        limit: 20,
      });
    });

    it('should return 400 for invalid organization ID', async () => {
      const response = await request(app)
        .get('/api/search/organizations/invalid/employees')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid organization ID');
      expect(searchService.searchEmployees).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid query parameters', async () => {
      const response = await request(app)
        .get('/api/search/organizations/1/employees?sortOrder=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid query parameters');
      expect(searchService.searchEmployees).not.toHaveBeenCalled();
    });

    it('should return 500 on service error', async () => {
      (searchService.searchEmployees as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/search/organizations/1/employees').expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
    });

    it('should handle complex multi-filter query', async () => {
      (searchService.searchEmployees as jest.Mock).mockResolvedValue(mockEmployeeResult);

      await request(app)
        .get('/api/search/organizations/1/employees')
        .query({
          query: 'engineer',
          status: 'active,pending',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          page: '2',
          limit: '50',
          sortBy: 'created_at',
          sortOrder: 'desc',
        })
        .expect(200);

      expect(searchService.searchEmployees).toHaveBeenCalledWith(1, {
        query: 'engineer',
        status: ['active', 'pending'],
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        page: 2,
        limit: 50,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
    });
  });

  describe('GET /api/search/organizations/:organizationId/transactions', () => {
    const mockTransactionResult = {
      data: [
        {
          id: 1,
          organization_id: 1,
          employee_id: 1,
          tx_hash: 'abc123def456',
          amount: '1000.50',
          asset_code: 'USDC',
          status: 'completed',
          transaction_type: 'payment',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          employee_first_name: 'John',
          employee_last_name: 'Doe',
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    };

    it('should return transactions with default pagination', async () => {
      (searchService.searchTransactions as jest.Mock).mockResolvedValue(mockTransactionResult);

      const response = await request(app)
        .get('/api/search/organizations/1/transactions')
        .expect(200);

      expect(response.body).toEqual(mockTransactionResult);
      expect(searchService.searchTransactions).toHaveBeenCalledWith(1, {
        page: 1,
        limit: 20,
      });
    });

    it('should search transactions with query parameter', async () => {
      (searchService.searchTransactions as jest.Mock).mockResolvedValue(mockTransactionResult);

      await request(app).get('/api/search/organizations/1/transactions?query=abc123').expect(200);

      expect(searchService.searchTransactions).toHaveBeenCalledWith(1, {
        query: 'abc123',
        page: 1,
        limit: 20,
      });
    });

    it('should filter transactions by status', async () => {
      (searchService.searchTransactions as jest.Mock).mockResolvedValue(mockTransactionResult);

      await request(app)
        .get('/api/search/organizations/1/transactions?status=completed,pending')
        .expect(200);

      expect(searchService.searchTransactions).toHaveBeenCalledWith(1, {
        status: ['completed', 'pending'],
        page: 1,
        limit: 20,
      });
    });

    it('should filter transactions by amount range', async () => {
      (searchService.searchTransactions as jest.Mock).mockResolvedValue(mockTransactionResult);

      await request(app)
        .get('/api/search/organizations/1/transactions?amountMin=100&amountMax=5000')
        .expect(200);

      expect(searchService.searchTransactions).toHaveBeenCalledWith(1, {
        amountMin: 100,
        amountMax: 5000,
        page: 1,
        limit: 20,
      });
    });

    it('should filter transactions by date range', async () => {
      (searchService.searchTransactions as jest.Mock).mockResolvedValue(mockTransactionResult);

      await request(app)
        .get('/api/search/organizations/1/transactions?dateFrom=2024-01-01&dateTo=2024-12-31')
        .expect(200);

      expect(searchService.searchTransactions).toHaveBeenCalledWith(1, {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        page: 1,
        limit: 20,
      });
    });

    it('should handle sorting by amount', async () => {
      (searchService.searchTransactions as jest.Mock).mockResolvedValue(mockTransactionResult);

      await request(app)
        .get('/api/search/organizations/1/transactions?sortBy=amount&sortOrder=desc')
        .expect(200);

      expect(searchService.searchTransactions).toHaveBeenCalledWith(1, {
        sortBy: 'amount',
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      });
    });

    it('should return 400 for invalid organization ID', async () => {
      const response = await request(app)
        .get('/api/search/organizations/abc/transactions')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid organization ID');
      expect(searchService.searchTransactions).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid amount parameters', async () => {
      const response = await request(app)
        .get('/api/search/organizations/1/transactions?amountMin=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid query parameters');
    });

    it('should return 500 on service error', async () => {
      (searchService.searchTransactions as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/search/organizations/1/transactions')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
    });

    it('should handle complex multi-filter query', async () => {
      (searchService.searchTransactions as jest.Mock).mockResolvedValue(mockTransactionResult);

      await request(app)
        .get('/api/search/organizations/1/transactions')
        .query({
          query: 'abc123',
          status: 'completed,failed',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          amountMin: '100',
          amountMax: '10000',
          page: '3',
          limit: '25',
          sortBy: 'created_at',
          sortOrder: 'asc',
        })
        .expect(200);

      expect(searchService.searchTransactions).toHaveBeenCalledWith(1, {
        query: 'abc123',
        status: ['completed', 'failed'],
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        amountMin: 100,
        amountMax: 10000,
        page: 3,
        limit: 25,
        sortBy: 'created_at',
        sortOrder: 'asc',
      });
    });

    it('should handle minimum amount only', async () => {
      (searchService.searchTransactions as jest.Mock).mockResolvedValue(mockTransactionResult);

      await request(app).get('/api/search/organizations/1/transactions?amountMin=1000').expect(200);

      expect(searchService.searchTransactions).toHaveBeenCalledWith(1, {
        amountMin: 1000,
        page: 1,
        limit: 20,
      });
    });

    it('should handle maximum amount only', async () => {
      (searchService.searchTransactions as jest.Mock).mockResolvedValue(mockTransactionResult);

      await request(app).get('/api/search/organizations/1/transactions?amountMax=5000').expect(200);

      expect(searchService.searchTransactions).toHaveBeenCalledWith(1, {
        amountMax: 5000,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Zod validation errors gracefully', async () => {
      const response = await request(app)
        .get('/api/search/organizations/1/employees?page=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid query parameters');
      expect(response.body).toHaveProperty('details');
    });

    it('should handle missing organization ID', async () => {
      await request(app).get('/api/search/organizations//employees').expect(404);
    });

    it('should handle negative organization ID', async () => {
      const response = await request(app).get('/api/search/organizations/-1/employees').expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid organization ID');
    });

    it('should handle zero organization ID', async () => {
      (searchService.searchEmployees as jest.Mock).mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app).get('/api/search/organizations/0/employees').expect(200);

      expect(searchService.searchEmployees).toHaveBeenCalledWith(0, {
        page: 1,
        limit: 20,
      });
    });
  });
});
