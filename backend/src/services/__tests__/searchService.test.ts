import { SearchService } from '../searchService';
import { Pool } from 'pg';

// Mock pg Pool
jest.mock('../../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe('SearchService', () => {
  let searchService: SearchService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    } as any;
    searchService = new SearchService(mockPool);
    jest.clearAllMocks();
  });

  describe('searchEmployees', () => {
    const mockEmployees = [
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
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
      },
      {
        id: 2,
        organization_id: 1,
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane.smith@example.com',
        wallet_address: 'GXXXXXXX2',
        status: 'active',
        position: 'Manager',
        department: 'Product',
        created_at: new Date('2024-01-02'),
        updated_at: new Date('2024-01-02'),
      },
    ];

    it('should search employees with full-text query', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '2' }] } as any)
        .mockResolvedValueOnce({ rows: mockEmployees } as any);

      const result = await searchService.searchEmployees(1, {
        query: 'john',
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual(mockEmployees);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });

      // Verify query was called with correct parameters
      expect(mockPool.query as jest.Mock).toHaveBeenCalledTimes(2);
      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('search_vector');
      expect(dataQueryCall[0]).toContain('plainto_tsquery');
      expect(dataQueryCall[1]).toContain('john');
    });

    it('should filter employees by status', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '1' }] } as any)
        .mockResolvedValueOnce({ rows: [mockEmployees[0]] } as any);

      const result = await searchService.searchEmployees(1, {
        status: ['active'],
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('status = ANY');
      expect(dataQueryCall[1]).toContainEqual(['active']);
    });

    it('should filter employees by date range', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '2' }] } as any)
        .mockResolvedValueOnce({ rows: mockEmployees } as any);

      const result = await searchService.searchEmployees(1, {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual(mockEmployees);

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('created_at >=');
      expect(dataQueryCall[0]).toContain('created_at <=');
      expect(dataQueryCall[1]).toContain('2024-01-01');
      expect(dataQueryCall[1]).toContain('2024-01-31');
    });

    it('should paginate results correctly', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '50' }] } as any)
        .mockResolvedValueOnce({ rows: mockEmployees } as any);

      const result = await searchService.searchEmployees(1, {
        page: 2,
        limit: 10,
      });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 50,
        totalPages: 5,
      });

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[1]).toContain(10); // limit
      expect(dataQueryCall[1]).toContain(10); // offset (page 2 * limit 10 - limit)
    });

    it('should sort employees by specified column and order', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '2' }] } as any)
        .mockResolvedValueOnce({ rows: mockEmployees } as any);

      await searchService.searchEmployees(1, {
        sortBy: 'last_name',
        sortOrder: 'asc',
        page: 1,
        limit: 20,
      });

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('last_name ASC');
    });

    it('should use default sort when invalid sortBy is provided', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '2' }] } as any)
        .mockResolvedValueOnce({ rows: mockEmployees } as any);

      await searchService.searchEmployees(1, {
        sortBy: 'invalid_column',
        page: 1,
        limit: 20,
      });

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('created_at DESC');
    });

    it('should combine multiple filters', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '1' }] } as any)
        .mockResolvedValueOnce({ rows: [mockEmployees[0]] } as any);

      await searchService.searchEmployees(1, {
        query: 'john',
        status: ['active', 'pending'],
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        sortBy: 'first_name',
        sortOrder: 'asc',
        page: 1,
        limit: 20,
      });

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('search_vector');
      expect(dataQueryCall[0]).toContain('status = ANY');
      expect(dataQueryCall[0]).toContain('created_at >=');
      expect(dataQueryCall[0]).toContain('created_at <=');
      expect(dataQueryCall[0]).toContain('first_name ASC');
    });

    it('should handle empty results', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await searchService.searchEmployees(1, {
        query: 'nonexistent',
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('searchTransactions', () => {
    const mockTransactions = [
      {
        id: 1,
        organization_id: 1,
        employee_id: 1,
        tx_hash: 'abc123def456',
        amount: '1000.50',
        asset_code: 'USDC',
        status: 'completed',
        transaction_type: 'payment',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        employee_first_name: 'John',
        employee_last_name: 'Doe',
      },
      {
        id: 2,
        organization_id: 1,
        employee_id: 2,
        tx_hash: 'def456ghi789',
        amount: '2500.75',
        asset_code: 'USDC',
        status: 'completed',
        transaction_type: 'payment',
        created_at: new Date('2024-01-02'),
        updated_at: new Date('2024-01-02'),
        employee_first_name: 'Jane',
        employee_last_name: 'Smith',
      },
    ];

    it('should search transactions with full-text query', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '2' }] } as any)
        .mockResolvedValueOnce({ rows: mockTransactions } as any);

      const result = await searchService.searchTransactions(1, {
        query: 'abc123',
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual(mockTransactions);
      expect(result.pagination.total).toBe(2);

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('search_vector');
      expect(dataQueryCall[0]).toContain('plainto_tsquery');
      expect(dataQueryCall[1]).toContain('abc123');
    });

    it('should filter transactions by status', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '2' }] } as any)
        .mockResolvedValueOnce({ rows: mockTransactions } as any);

      const result = await searchService.searchTransactions(1, {
        status: ['completed'],
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual(mockTransactions);

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('status = ANY');
      expect(dataQueryCall[1]).toContainEqual(['completed']);
    });

    it('should filter transactions by amount range', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '1' }] } as any)
        .mockResolvedValueOnce({ rows: [mockTransactions[0]] } as any);

      const result = await searchService.searchTransactions(1, {
        amountMin: 500,
        amountMax: 1500,
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('amount >=');
      expect(dataQueryCall[0]).toContain('amount <=');
      expect(dataQueryCall[1]).toContain(500);
      expect(dataQueryCall[1]).toContain(1500);
    });

    it('should filter transactions by date range', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '2' }] } as any)
        .mockResolvedValueOnce({ rows: mockTransactions } as any);

      await searchService.searchTransactions(1, {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        page: 1,
        limit: 20,
      });

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('created_at >=');
      expect(dataQueryCall[0]).toContain('created_at <=');
    });

    it('should include employee information in results', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '1' }] } as any)
        .mockResolvedValueOnce({ rows: [mockTransactions[0]] } as any);

      const result = await searchService.searchTransactions(1, {
        page: 1,
        limit: 20,
      });

      expect(result.data[0]).toHaveProperty('employee_first_name');
      expect(result.data[0]).toHaveProperty('employee_last_name');
      expect(result.data[0].employee_first_name).toBe('John');

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('LEFT JOIN employees');
    });

    it('should sort transactions by amount', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '2' }] } as any)
        .mockResolvedValueOnce({ rows: mockTransactions } as any);

      await searchService.searchTransactions(1, {
        sortBy: 'amount',
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      });

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('amount DESC');
    });

    it('should combine all filters for complex search', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '1' }] } as any)
        .mockResolvedValueOnce({ rows: [mockTransactions[0]] } as any);

      await searchService.searchTransactions(1, {
        query: 'abc123',
        status: ['completed', 'pending'],
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        amountMin: 100,
        amountMax: 5000,
        sortBy: 'created_at',
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      });

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('search_vector');
      expect(dataQueryCall[0]).toContain('status = ANY');
      expect(dataQueryCall[0]).toContain('created_at >=');
      expect(dataQueryCall[0]).toContain('created_at <=');
      expect(dataQueryCall[0]).toContain('amount >=');
      expect(dataQueryCall[0]).toContain('amount <=');
    });

    it('should handle pagination for large result sets', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '1000' }] } as any)
        .mockResolvedValueOnce({ rows: mockTransactions } as any);

      const result = await searchService.searchTransactions(1, {
        page: 10,
        limit: 50,
      });

      expect(result.pagination).toEqual({
        page: 10,
        limit: 50,
        total: 1000,
        totalPages: 20,
      });

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[1]).toContain(50); // limit
      expect(dataQueryCall[1]).toContain(450); // offset (page 10 - 1) * 50
    });

    it('should handle empty transaction results', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await searchService.searchTransactions(1, {
        query: 'nonexistent',
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should filter by minimum amount only', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '1' }] } as any)
        .mockResolvedValueOnce({ rows: [mockTransactions[1]] } as any);

      await searchService.searchTransactions(1, {
        amountMin: 2000,
        page: 1,
        limit: 20,
      });

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('amount >=');
      expect(dataQueryCall[0]).not.toContain('amount <=');
    });

    it('should filter by maximum amount only', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '1' }] } as any)
        .mockResolvedValueOnce({ rows: [mockTransactions[0]] } as any);

      await searchService.searchTransactions(1, {
        amountMax: 1500,
        page: 1,
        limit: 20,
      });

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).toContain('amount <=');
      expect(dataQueryCall[0]).not.toContain('amount >=');
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in search query', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await searchService.searchEmployees(1, {
        query: "O'Brien",
        page: 1,
        limit: 20,
      });

      expect(mockPool.query as jest.Mock).toHaveBeenCalledTimes(2);
      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[1]).toContain("O'Brien");
    });

    it('should handle very large page numbers', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '100' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await searchService.searchEmployees(1, {
        page: 1000,
        limit: 20,
      });

      expect(result.data).toEqual([]);
      expect(result.pagination.page).toBe(1000);
    });

    it('should trim whitespace from search queries', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '1' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await searchService.searchEmployees(1, {
        query: '  john  ',
        page: 1,
        limit: 20,
      });

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[1]).toContain('john');
      expect(dataQueryCall[1]).not.toContain('  john  ');
    });

    it('should handle empty string query', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '10' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await searchService.searchEmployees(1, {
        query: '',
        page: 1,
        limit: 20,
      });

      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[0]).not.toContain('search_vector');
    });
  });
});
