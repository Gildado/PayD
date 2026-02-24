import { Request, Response } from 'express';
import { employeeService } from '../services/employeeService';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
} from '../schemas/employeeSchema';
import { z } from 'zod';

export class EmployeeController {
  async create(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ error: 'User is not associated with an organization' });
      }
      
      const validatedData = createEmployeeSchema.parse({ ...req.body, organization_id: organizationId });
      const employee = await employeeService.create(validatedData);
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation Error', details: error.errors });
      } else {
        console.error('Create Employee Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ error: 'User is not associated with an organization' });
      }

      const validatedQuery = employeeQuerySchema.parse(req.query);
      const result = await employeeService.findAll(organizationId, validatedQuery);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation Error', details: error.errors });
      } else {
        console.error('Get All Employees Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ error: 'User is not associated with an organization' });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const employee = await employeeService.findById(id, organizationId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found in your organization' });
      }

      res.json(employee);
    } catch (error) {
      console.error('Get Employee Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ error: 'User is not associated with an organization' });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const validatedData = updateEmployeeSchema.parse(req.body);
      const employee = await employeeService.update(id, organizationId, validatedData);

      if (!employee) {
        return res.status(404).json({ error: 'Employee not found in your organization' });
      }

      res.json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation Error', details: error.errors });
      } else {
        console.error('Update Employee Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ error: 'User is not associated with an organization' });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const employee = await employeeService.delete(id, organizationId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found in your organization' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Delete Employee Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export const employeeController = new EmployeeController();
