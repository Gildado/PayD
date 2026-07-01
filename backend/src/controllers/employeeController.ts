import { Request, Response } from 'express';
import { employeeService } from '../services/employeeService.js';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
} from '../schemas/employeeSchema.js';
import { z } from 'zod';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';

export class EmployeeController {
  async create(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res
          .status(403)
          .json(apiErrorResponse(ErrorCodes.FORBIDDEN, 'User is not associated with an organization'));
      }

      const validatedData = createEmployeeSchema.parse({
        ...req.body,
        organization_id: organizationId,
      });
      const employee = await employeeService.create(validatedData);
      res.status(201).json(employee);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json(apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Validation Error', error.issues));
      } else if (error.message?.includes('Invalid Stellar wallet address')) {
        res
          .status(400)
          .json(apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Validation Error', [{ message: error.message }]));
      } else {
        console.error('Create Employee Error:', error);
        res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal Server Error'));
      }
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res
          .status(403)
          .json(apiErrorResponse(ErrorCodes.FORBIDDEN, 'User is not associated with an organization'));
      }

      const validatedQuery = employeeQuerySchema.parse(req.query);
      const result = await employeeService.findAll(organizationId, validatedQuery);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json(apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Validation Error', error.issues));
      } else {
        console.error('Get All Employees Error:', error);
        res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal Server Error'));
      }
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res
          .status(403)
          .json(apiErrorResponse(ErrorCodes.FORBIDDEN, 'User is not associated with an organization'));
      }

      const id = parseInt(req.params.id as string);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json(apiErrorResponse(ErrorCodes.BAD_REQUEST, 'Invalid ID'));
      }

      const employee = await employeeService.findById(id, organizationId);
      if (!employee) {
        return res
          .status(404)
          .json(apiErrorResponse(ErrorCodes.NOT_FOUND, 'Employee not found in your organization'));
      }

      res.json(employee);
    } catch (error) {
      console.error('Get Employee Error:', error);
      res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal Server Error'));
    }
  }

  async update(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res
          .status(403)
          .json(apiErrorResponse(ErrorCodes.FORBIDDEN, 'User is not associated with an organization'));
      }

      const id = parseInt(req.params.id as string);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json(apiErrorResponse(ErrorCodes.BAD_REQUEST, 'Invalid ID'));
      }

      const validatedData = updateEmployeeSchema.parse(req.body);
      const employee = await employeeService.update(id, organizationId, validatedData);

      if (!employee) {
        return res
          .status(404)
          .json(apiErrorResponse(ErrorCodes.NOT_FOUND, 'Employee not found in your organization'));
      }

      res.json(employee);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json(apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Validation Error', error.issues));
      } else if (error.message?.includes('Invalid Stellar wallet address')) {
        res
          .status(400)
          .json(apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Validation Error', [{ message: error.message }]));
      } else {
        console.error('Update Employee Error:', error);
        res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal Server Error'));
      }
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res
          .status(403)
          .json(apiErrorResponse(ErrorCodes.FORBIDDEN, 'User is not associated with an organization'));
      }

      const id = parseInt(req.params.id as string);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json(apiErrorResponse(ErrorCodes.BAD_REQUEST, 'Invalid ID'));
      }

      const employee = await employeeService.delete(id, organizationId);
      if (!employee) {
        return res
          .status(404)
          .json(apiErrorResponse(ErrorCodes.NOT_FOUND, 'Employee not found in your organization'));
      }

      res.status(204).send();
    } catch (error) {
      console.error('Delete Employee Error:', error);
      res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal Server Error'));
    }
  }
}

export const employeeController = new EmployeeController();
