import { EmployeeService } from '../employeeService';
import { Pool } from 'pg';

// Mock pg Pool
jest.mock('../../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from '../../config/database';

describe('EmployeeService', () => {
  let employeeService: EmployeeService;
  const mockPool = pool as unknown as jest.Mocked<Pool>;

  beforeEach(() => {
    jest.clearAllMocks();
    employeeService = new EmployeeService();
  });

  describe('create', () => {
    const mockEmployeeData = {
      organization_id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      wallet_address: 'GABC123',
      position: 'Dev',
      department: 'IT',
      status: 'active' as const,
    };

    it('should create an employee successfully', async () => {
      const mockCreatedEmployee = { id: 1, ...mockEmployeeData, created_at: new Date() };
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockCreatedEmployee],
      });

      const result = await employeeService.create(mockEmployeeData);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO employees'),
        expect.arrayContaining(['John', 'Doe', 'john@example.com'])
      );
      expect(result).toEqual(mockCreatedEmployee);
    });
  });

  describe('findAll', () => {
    it('should return paginated employees', async () => {
      const mockEmployees = [
        { id: 1, first_name: 'John', total_count: '2' },
        { id: 2, first_name: 'Jane', total_count: '2' },
      ];

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: mockEmployees,
      });

      const result = await employeeService.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT *, count(*) OVER() as total_count'),
        expect.any(Array)
      );
    });

    it('should filter by department', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      await employeeService.findAll({ department: 'IT', page: 1, limit: 10 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('department = $'),
        expect.arrayContaining(['IT'])
      );
    });
  });

  describe('update', () => {
    it('should update employee successfully', async () => {
      const updateData = { first_name: 'Johnny' };
      const mockUpdatedEmployee = { id: 1, first_name: 'Johnny' };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockUpdatedEmployee],
      });

      const result = await employeeService.update(1, updateData);

      expect(result).toEqual(mockUpdatedEmployee);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE employees'),
        expect.arrayContaining(['Johnny', 1])
      );
    });

    it('should return null if employee not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await employeeService.update(999, { first_name: 'Test' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should soft delete employee', async () => {
      const mockDeletedEmployee = { id: 1, deleted_at: new Date() };
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockDeletedEmployee],
        rowCount: 1,
      });

      const result = await employeeService.delete(1);

      expect(result).toEqual(mockDeletedEmployee);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE employees\s+SET deleted_at = NOW()/),
        [1]
      );
    });
  });
});
