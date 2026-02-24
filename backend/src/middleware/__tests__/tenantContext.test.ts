import { Request, Response, NextFunction } from 'express';
import { extractTenantId, validateTenant, setTenantContext } from '../tenantContext';
import { pool } from '../../config/database';

// Mock the database pool
jest.mock('../../config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

describe('Tenant Context Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      params: {},
      headers: {},
    };

    mockResponse = {
      status: statusMock,
      on: jest.fn(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('extractTenantId', () => {
    it('should extract tenant ID from URL params', () => {
      mockRequest.params = { organizationId: '123' };

      extractTenantId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.tenantId).toBe(123);
      expect(mockRequest.organizationId).toBe(123);
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should extract tenant ID from headers', () => {
      mockRequest.headers = { 'x-organization-id': '456' };

      extractTenantId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.tenantId).toBe(456);
      expect(mockRequest.organizationId).toBe(456);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should prioritize URL params over headers', () => {
      mockRequest.params = { organizationId: '123' };
      mockRequest.headers = { 'x-organization-id': '456' };

      extractTenantId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.tenantId).toBe(123);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 400 if tenant ID is missing', () => {
      extractTenantId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid or missing organization ID',
        message: 'A valid organization ID must be provided in the URL or headers',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 if tenant ID is invalid', () => {
      mockRequest.params = { organizationId: 'invalid' };

      extractTenantId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 if tenant ID is negative', () => {
      mockRequest.params = { organizationId: '-1' };

      extractTenantId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 if tenant ID is zero', () => {
      mockRequest.params = { organizationId: '0' };

      extractTenantId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateTenant', () => {
    it('should validate existing tenant', async () => {
      mockRequest.tenantId = 123;
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [{ id: 123, name: 'Test Org' }],
      });

      await validateTenant(mockRequest as Request, mockResponse as Response, mockNext);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT id, name FROM organizations WHERE id = $1',
        [123]
      );
      expect((mockRequest as any).organization).toEqual({ id: 123, name: 'Test Org' });
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 404 if tenant does not exist', async () => {
      mockRequest.tenantId = 999;
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await validateTenant(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Organization not found',
        message: 'Organization with ID 999 does not exist',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 if tenant ID is not set', async () => {
      await validateTenant(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Tenant ID not set',
        message: 'extractTenantId middleware must be called before validateTenant',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockRequest.tenantId = 123;
      (pool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      await validateTenant(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to validate tenant',
        message: 'An error occurred while validating the organization',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('setTenantContext', () => {
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      (pool.connect as jest.Mock).mockResolvedValue(mockClient);
    });

    it('should set tenant context in PostgreSQL session', async () => {
      mockRequest.tenantId = 123;

      await setTenantContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(pool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        'SET LOCAL app.current_tenant_id = $1',
        [123]
      );
      expect((mockRequest as any).dbClient).toBe(mockClient);
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 500 if tenant ID is not set', async () => {
      await setTenantContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Tenant context not set',
        message: 'extractTenantId middleware must be called before setTenantContext',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockRequest.tenantId = 123;
      (pool.connect as jest.Mock).mockRejectedValue(new Error('Connection error'));

      await setTenantContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to set tenant context',
        message: 'An error occurred while establishing tenant isolation',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should register cleanup handlers', async () => {
      mockRequest.tenantId = 123;
      const onMock = jest.fn();
      mockResponse.on = onMock;

      await setTenantContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(onMock).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(onMock).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });
});
