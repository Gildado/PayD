import request from 'supertest';
import express from 'express';

// Mock database before importing anything else
jest.mock('../../config/database.js', () => ({
  __esModule: true,
  pool: {
    query: jest.fn(),
  },
}));

// Mock env config before importing routes
jest.mock('../../config/env', () => ({
  config: {
    DATABASE_URL: 'postgres://mock',
    PORT: 3000,
  },
}));

jest.mock('../../middlewares/auth.js', () => ({
  __esModule: true,
  default: (req: any, _res: any, next: any) => {
    req.user = { id: 1, organizationId: 1, role: 'EMPLOYER' };
    next();
  },
  authenticateJWT: (req: any, _res: any, next: any) => {
    req.user = { id: 1, organizationId: 1, role: 'EMPLOYER' };
    next();
  },
}));

jest.mock('../../middlewares/rbac.js', () => ({
  __esModule: true,
  authorizeRoles: () => (_req: any, _res: any, next: any) => next(),
  isolateOrganization: (_req: any, _res: any, next: any) => next(),
}));

import employeeRoutes from '../../routes/employeeRoutes.js';
import { employeeService } from '../../services/employeeService.js';

// Mock the employee service
jest.mock('../../services/employeeService');

const app = express();
app.use(express.json());
app.use('/api/employees', employeeRoutes);

describe('EmployeeController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/employees', () => {
    const validEmployeeData = {
      organization_id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      status: 'active',
    };

    it('should create an employee successfully', async () => {
      const mockCreatedEmployee = { id: 1, ...validEmployeeData };
      (employeeService.create as jest.Mock).mockResolvedValue(mockCreatedEmployee);

      const response = await request(app)
        .post('/api/employees')
        .send(validEmployeeData)
        .expect(201);

      expect(response.body).toEqual(mockCreatedEmployee);
      expect(employeeService.create).toHaveBeenCalledWith(
        expect.objectContaining(validEmployeeData)
      );
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = { first_name: 'John' }; // Missing required fields

      const response = await request(app).post('/api/employees').send(invalidData).expect(400);

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body).toHaveProperty('message', 'Validation Error');
      expect(employeeService.create).not.toHaveBeenCalled();
    });

    it('should return 400 for departments outside the allowed list', async () => {
      const response = await request(app)
        .post('/api/employees')
        .send({ ...validEmployeeData, department: 'Enginering' })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.details[0].message).toContain('Department must be one of');
      expect(employeeService.create).not.toHaveBeenCalled();
    });

    it('should return 400 for positions outside the allowed list', async () => {
      const response = await request(app)
        .post('/api/employees')
        .send({ ...validEmployeeData, position: 'Chief Vibes Officer' })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.details[0].message).toContain('Position must be one of');
      expect(employeeService.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/employees', () => {
    it('should return paginated employees', async () => {
      const mockResult = {
        data: [{ id: 1, first_name: 'John' }],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      (employeeService.findAll as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app).get('/api/employees?page=1&limit=10').expect(200);

      expect(response.body).toEqual(mockResult);
      expect(employeeService.findAll).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          page: 1,
          limit: 10,
        })
      );
    });

    it('should pass q to findAll when provided', async () => {
      const mockResult = {
        data: [{ id: 1, first_name: 'Alice' }],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      (employeeService.findAll as jest.Mock).mockResolvedValue(mockResult);

      await request(app).get('/api/employees?q=alice').expect(200);

      expect(employeeService.findAll).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ q: 'alice' })
      );
    });

    it('should return 400 for invalid query params', async () => {
      await request(app).get('/api/employees?status=invalid_status').expect(400);
    });

    it('should return 400 when limit exceeds maximum allowed value', async () => {
      const response = await request(app).get('/api/employees?limit=999999').expect(400);

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body).toHaveProperty('message', 'Validation Error');
      expect(employeeService.findAll).not.toHaveBeenCalled();
    });

    it('should return 400 when page is zero or negative', async () => {
      await request(app).get('/api/employees?page=0').expect(400);
      expect(employeeService.findAll).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/employees/:id', () => {
    it('should return employee by ID', async () => {
      const mockEmployee = { id: 1, first_name: 'John' };
      (employeeService.findById as jest.Mock).mockResolvedValue(mockEmployee);

      const response = await request(app).get('/api/employees/1').expect(200);

      expect(response.body).toEqual(mockEmployee);
      expect(employeeService.findById).toHaveBeenCalledWith(1, 1);
    });

    it('should return 404 if employee not found', async () => {
      (employeeService.findById as jest.Mock).mockResolvedValue(null);

      await request(app).get('/api/employees/999').expect(404);
    });

    it('should return 400 for negative ID', async () => {
      const response = await request(app).get('/api/employees/-1').expect(400);

      expect(response.body).toHaveProperty('code', 'BAD_REQUEST');
      expect(response.body).toHaveProperty('message', 'Invalid ID');
      expect(employeeService.findById).not.toHaveBeenCalled();
    });

    it('should return 400 for zero ID', async () => {
      const response = await request(app).get('/api/employees/0').expect(400);

      expect(response.body).toHaveProperty('code', 'BAD_REQUEST');
      expect(response.body).toHaveProperty('message', 'Invalid ID');
      expect(employeeService.findById).not.toHaveBeenCalled();
    });

    it('should return 400 for non-numeric ID (NaN)', async () => {
      const response = await request(app).get('/api/employees/abc').expect(400);

      expect(response.body).toHaveProperty('code', 'BAD_REQUEST');
      expect(response.body).toHaveProperty('message', 'Invalid ID');
      expect(employeeService.findById).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/employees/:id', () => {
    it('should update employee successfully', async () => {
      const updateData = {
        first_name: 'Johnny',
        department: 'Engineering',
        position: 'Engineer',
      };
      const mockUpdatedEmployee = { id: 1, first_name: 'Johnny' };
      (employeeService.update as jest.Mock).mockResolvedValue(mockUpdatedEmployee);

      const response = await request(app).patch('/api/employees/1').send(updateData).expect(200);

      expect(response.body).toEqual(mockUpdatedEmployee);
      expect(employeeService.update).toHaveBeenCalledWith(
        1,
        1,
        expect.objectContaining(updateData)
      );
    });

    it('should return 400 for departments outside the allowed list', async () => {
      const response = await request(app)
        .patch('/api/employees/1')
        .send({ department: 'Enginering' })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.details[0].message).toContain('Department must be one of');
      expect(employeeService.update).not.toHaveBeenCalled();
    });

    it('should return 400 for positions outside the allowed list', async () => {
      const response = await request(app)
        .patch('/api/employees/1')
        .send({ position: 'Chief Vibes Officer' })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.details[0].message).toContain('Position must be one of');
      expect(employeeService.update).not.toHaveBeenCalled();
    });

    it('should return 400 for negative ID', async () => {
      const response = await request(app)
        .patch('/api/employees/-1')
        .send({ first_name: 'Johnny' })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'BAD_REQUEST');
      expect(response.body).toHaveProperty('message', 'Invalid ID');
      expect(employeeService.update).not.toHaveBeenCalled();
    });

    it('should return 400 for non-numeric ID', async () => {
      const response = await request(app)
        .patch('/api/employees/invalid')
        .send({ first_name: 'Johnny' })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'BAD_REQUEST');
      expect(response.body).toHaveProperty('message', 'Invalid ID');
      expect(employeeService.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/employees/:id', () => {
    it('should delete employee successfully', async () => {
      (employeeService.delete as jest.Mock).mockResolvedValue({ id: 1 });

      await request(app).delete('/api/employees/1').expect(204);

      expect(employeeService.delete).toHaveBeenCalledWith(1, 1);
    });

    it('should return 404 if employee not found', async () => {
      (employeeService.delete as jest.Mock).mockResolvedValue(null);

      await request(app).delete('/api/employees/999').expect(404);
    });

    it('should return 400 for negative ID', async () => {
      const response = await request(app).delete('/api/employees/-5').expect(400);

      expect(response.body).toHaveProperty('code', 'BAD_REQUEST');
      expect(response.body).toHaveProperty('message', 'Invalid ID');
      expect(employeeService.delete).not.toHaveBeenCalled();
    });

    it('should return 400 for non-numeric ID', async () => {
      const response = await request(app).delete('/api/employees/notanumber').expect(400);

      expect(response.body).toHaveProperty('code', 'BAD_REQUEST');
      expect(response.body).toHaveProperty('message', 'Invalid ID');
      expect(employeeService.delete).not.toHaveBeenCalled();
    });
  });
});
