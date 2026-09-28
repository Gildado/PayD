import { EmployeeService } from '../employeeService.js';
import { Pool } from 'pg';

// Mock pg Pool
jest.mock('../../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

// Mock webhook service to avoid side effects
jest.mock('../webhook.service', () => ({
  WebhookService: { dispatch: jest.fn() },
  WEBHOOK_EVENTS: {
    EMPLOYEE_ADDED: 'employee.added',
    EMPLOYEE_UPDATED: 'employee.updated',
    EMPLOYEE_DELETED: 'employee.deleted',
  },
}));

import { pool } from '../../config/database.js';

describe('EmployeeService', () => {
  let employeeService: EmployeeService;
  const mockPool = pool as unknown as jest.Mocked<Pool>;

  beforeEach(() => {
    jest.resetAllMocks();
    employeeService = new EmployeeService();
  });

  describe('create', () => {
    const mockEmployeeData = {
      organization_id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      wallet_address: 'GDRBQQEIW4URY57F2TRUQSCSUVVR3D7PJQQDXR23AXSEMDMASAW2V6VB',
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

    it('should create an employee with profile fields', async () => {
      const fullProfileData = {
        ...mockEmployeeData,
        phone: '+1234567890',
        job_title: 'Software Engineer',
        hire_date: '2024-01-15',
        date_of_birth: '1990-06-20',
        address_line1: '123 Main St',
        city: 'San Francisco',
        state_province: 'CA',
        postal_code: '94102',
        country: 'US',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '+0987654321',
        withdrawal_preference: 'bank' as const,
        bank_name: 'Chase Bank',
        bank_account_number: '123456789',
        bank_routing_number: '021000021',
        notes: 'Senior team member',
      };

      const mockCreated = { id: 2, ...fullProfileData, created_at: new Date() };
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockCreated] });

      const result = await employeeService.create(fullProfileData);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('phone'),
        expect.arrayContaining(['+1234567890', 'Software Engineer', 'Chase Bank'])
      );
      expect(result.phone).toBe('+1234567890');
      expect(result.job_title).toBe('Software Engineer');
      expect(result.bank_name).toBe('Chase Bank');
    });

    it('should set default withdrawal_preference to bank', async () => {
      const mockCreated = { id: 3, ...mockEmployeeData, withdrawal_preference: 'bank' };
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockCreated] });

      const result = await employeeService.create(mockEmployeeData);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['bank'])
      );
      expect(result.withdrawal_preference).toBe('bank');
    });

    it('should accept mobile_money withdrawal preference', async () => {
      const mobileData = {
        ...mockEmployeeData,
        withdrawal_preference: 'mobile_money' as const,
        mobile_money_provider: 'M-Pesa',
        mobile_money_account: '+254700123456',
      };
      const mockCreated = { id: 4, ...mobileData };
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockCreated] });

      const result = await employeeService.create(mobileData);

      expect(result.withdrawal_preference).toBe('mobile_money');
      expect(result.mobile_money_provider).toBe('M-Pesa');
    });

    it('should throw error for invalid Stellar wallet address', async () => {
      const invalidData = {
        ...mockEmployeeData,
        wallet_address: 'invalid-address',
      };

      await expect(employeeService.create(invalidData)).rejects.toThrow(
        'Invalid Stellar wallet address: invalid-address'
      );
      expect(mockPool.query).not.toHaveBeenCalled();
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

      const result = await employeeService.findAll(1, { page: 1, limit: 10 });

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

      await employeeService.findAll(1, { department: 'IT', page: 1, limit: 10 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('department = $'),
        expect.arrayContaining(['IT'])
      );
    });

    it('should search across profile fields including job_title and phone via search_vector', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await employeeService.findAll(1, { search: 'engineer', page: 1, limit: 10 });

      const calledQuery = (mockPool.query as jest.Mock).mock.calls[0][0];
      expect(calledQuery).toContain('search_vector @@');
    });

    it('should apply full-text search when q is provided', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await employeeService.findAll(1, { q: 'alice', page: 1, limit: 10 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('plainto_tsquery'),
        expect.arrayContaining(['alice', '%alice%'])
      );
    });

    it('should rank results by relevance when q is provided', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await employeeService.findAll(1, { q: 'alice', page: 1, limit: 10 });

      const calledQuery = (mockPool.query as jest.Mock).mock.calls[0][0];
      expect(calledQuery).toContain('ts_rank');
    });

    it('q takes precedence over search when both are provided', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await employeeService.findAll(1, { q: 'alice', search: 'bob', page: 1, limit: 10 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['alice', '%alice%'])
      );
      expect(mockPool.query).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['bob'])
      );
    });

    it('falls back to search when q is absent', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await employeeService.findAll(1, { search: 'bob', page: 1, limit: 10 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('plainto_tsquery'),
        expect.arrayContaining(['bob', '%bob%'])
      );
    });
  });

  describe('findById', () => {
    it('should return employee by id and organization', async () => {
      const mockEmployee = {
        id: 1,
        organization_id: 1,
        first_name: 'John',
        job_title: 'Engineer',
        withdrawal_preference: 'bank',
      };
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockEmployee] });

      const result = await employeeService.findById(1, 1);

      expect(result).toEqual(mockEmployee);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND organization_id = $2'),
        [1, 1]
      );
    });

    it('should return null if not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await employeeService.findById(999, 1);
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update employee successfully', async () => {
      const updateData = { first_name: 'Johnny' };
      const mockUpdatedEmployee = { id: 1, first_name: 'Johnny' };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockUpdatedEmployee],
      });

      const result = await employeeService.update(1, 1, updateData);

      expect(result).toEqual(mockUpdatedEmployee);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE employees'),
        expect.arrayContaining(['Johnny', 1])
      );
    });

    it('should update profile fields', async () => {
      const updateData = {
        phone: '+9876543210',
        job_title: 'Senior Engineer',
        withdrawal_preference: 'mobile_money' as const,
        mobile_money_provider: 'M-Pesa',
      };
      const mockUpdated = { id: 1, ...updateData };
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await employeeService.update(1, 1, updateData);

      expect(result).toEqual(mockUpdated);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE employees'),
        expect.arrayContaining(['+9876543210', 'Senior Engineer', 'mobile_money', 'M-Pesa'])
      );
    });

    it('should return null if employee not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await employeeService.update(999, 1, { first_name: 'Test' });
      expect(result).toBeNull();
    });

    it('should return null if no fields provided', async () => {
      const result = await employeeService.update(1, 1, {});
      expect(result).toBeNull();
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should throw error for invalid Stellar wallet address on update', async () => {
      const invalidData = { wallet_address: 'invalid-address' };

      await expect(employeeService.update(1, 1, invalidData)).rejects.toThrow(
        'Invalid Stellar wallet address: invalid-address'
      );
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete employee', async () => {
      const mockDeletedEmployee = { id: 1, deleted_at: new Date() };
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockDeletedEmployee],
        rowCount: 1,
      });

      const result = await employeeService.delete(1, 1);

      expect(result).toEqual(mockDeletedEmployee);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE employees\s+SET deleted_at = NOW()/),
        [1, 1]
      );
    });

    it('should return null if employee not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await employeeService.delete(999, 1);
      expect(result).toBeNull();
    });
  });
});
