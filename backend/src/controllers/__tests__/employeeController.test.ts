import request from 'supertest';
import express from 'express';

// Mock env config before importing routes
jest.mock('../../config/env', () => ({
  config: {
    DATABASE_URL: 'postgres://mock',
    PORT: 3000,
  },
}));

import employeeRoutes from '../../routes/employeeRoutes';
import { employeeService } from '../../services/employeeService';

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

      expect(response.body).toHaveProperty('error', 'Validation Error');
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
        expect.objectContaining({
          page: 1,
          limit: 10,
        })
      );
    });
  });

  describe('GET /api/employees/:id', () => {
    it('should return employee by ID', async () => {
      const mockEmployee = { id: 1, first_name: 'John' };
      (employeeService.findById as jest.Mock).mockResolvedValue(mockEmployee);

      const response = await request(app).get('/api/employees/1').expect(200);

      expect(response.body).toEqual(mockEmployee);
      expect(employeeService.findById).toHaveBeenCalledWith(1);
    });

    it('should return 404 if employee not found', async () => {
      (employeeService.findById as jest.Mock).mockResolvedValue(null);

      await request(app).get('/api/employees/999').expect(404);
    });
  });

  describe('PATCH /api/employees/:id', () => {
    it('should update employee successfully', async () => {
      const updateData = { first_name: 'Johnny' };
      const mockUpdatedEmployee = { id: 1, first_name: 'Johnny' };
      (employeeService.update as jest.Mock).mockResolvedValue(mockUpdatedEmployee);

      const response = await request(app).patch('/api/employees/1').send(updateData).expect(200);

      expect(response.body).toEqual(mockUpdatedEmployee);
      expect(employeeService.update).toHaveBeenCalledWith(1, expect.objectContaining(updateData));
    });
  });

  describe('DELETE /api/employees/:id', () => {
    it('should delete employee successfully', async () => {
      (employeeService.delete as jest.Mock).mockResolvedValue({ id: 1 });

      await request(app).delete('/api/employees/1').expect(204);

      expect(employeeService.delete).toHaveBeenCalledWith(1);
    });

    it('should return 404 if employee not found', async () => {
      (employeeService.delete as jest.Mock).mockResolvedValue(null);

      await request(app).delete('/api/employees/999').expect(404);
    });
  });
});
