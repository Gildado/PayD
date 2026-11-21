import { Request, Response } from 'express';
import { employeeService } from '../services/employeeService.js';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
} from '../schemas/employeeSchema.js';
import { z } from 'zod';
import { ErrorCodes } from '../utils/apiError.js';
import { sendProblem } from '../utils/problemDetails.js';
import logger from '../utils/logger.js';

export class EmployeeController {
  async create(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return sendProblem(req, res, {
          status: 403,
          code: ErrorCodes.FORBIDDEN,
          detail: 'User is not associated with an organization',
        });
      }

      const validatedData = createEmployeeSchema.parse({
        ...req.body,
        organization_id: organizationId,
      });
      const employee = await employeeService.create(validatedData);
      res.status(201).json(employee);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendProblem(req, res, {
          status: 400,
          code: ErrorCodes.VALIDATION_ERROR,
          detail: 'Validation Error',
          errors: error.issues,
        });
      } else if (error.message?.includes('Invalid Stellar wallet address')) {
        sendProblem(req, res, {
          status: 400,
          code: ErrorCodes.VALIDATION_ERROR,
          detail: 'Validation Error',
          errors: [{ message: error.message }],
        });
      } else {
        logger.error('Failed to create employee', error);
        sendProblem(req, res, {
          status: 500,
          code: ErrorCodes.INTERNAL_ERROR,
          detail: 'Internal Server Error',
        });
      }
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return sendProblem(req, res, {
          status: 403,
          code: ErrorCodes.FORBIDDEN,
          detail: 'User is not associated with an organization',
        });
      }

      const validatedQuery = employeeQuerySchema.parse(req.query);
      const result = await employeeService.findAll(organizationId, validatedQuery);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendProblem(req, res, {
          status: 400,
          code: ErrorCodes.VALIDATION_ERROR,
          detail: 'Validation Error',
          errors: error.issues,
        });
      } else {
        logger.error('Failed to get employees', error);
        sendProblem(req, res, {
          status: 500,
          code: ErrorCodes.INTERNAL_ERROR,
          detail: 'Internal Server Error',
        });
      }
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return sendProblem(req, res, {
          status: 403,
          code: ErrorCodes.FORBIDDEN,
          detail: 'User is not associated with an organization',
        });
      }

      const id = parseInt(req.params.id as string);
      if (isNaN(id) || id <= 0) {
        return sendProblem(req, res, {
          status: 400,
          code: ErrorCodes.BAD_REQUEST,
          detail: 'Invalid ID',
        });
      }

      const employee = await employeeService.findById(id, organizationId);
      if (!employee) {
        return sendProblem(req, res, {
          status: 404,
          code: ErrorCodes.NOT_FOUND,
          detail: 'Employee not found in your organization',
        });
      }

      res.json(employee);
    } catch (error) {
      logger.error('Failed to get employee', error);
      sendProblem(req, res, {
        status: 500,
        code: ErrorCodes.INTERNAL_ERROR,
        detail: 'Internal Server Error',
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return sendProblem(req, res, {
          status: 403,
          code: ErrorCodes.FORBIDDEN,
          detail: 'User is not associated with an organization',
        });
      }

      const id = parseInt(req.params.id as string);
      if (isNaN(id) || id <= 0) {
        return sendProblem(req, res, {
          status: 400,
          code: ErrorCodes.BAD_REQUEST,
          detail: 'Invalid ID',
        });
      }

      const validatedData = updateEmployeeSchema.parse(req.body);
      const employee = await employeeService.update(id, organizationId, validatedData);

      if (!employee) {
        return sendProblem(req, res, {
          status: 404,
          code: ErrorCodes.NOT_FOUND,
          detail: 'Employee not found in your organization',
        });
      }

      res.json(employee);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendProblem(req, res, {
          status: 400,
          code: ErrorCodes.VALIDATION_ERROR,
          detail: 'Validation Error',
          errors: error.issues,
        });
      } else if (error.message?.includes('Invalid Stellar wallet address')) {
        sendProblem(req, res, {
          status: 400,
          code: ErrorCodes.VALIDATION_ERROR,
          detail: 'Validation Error',
          errors: [{ message: error.message }],
        });
      } else {
        logger.error('Failed to update employee', error);
        sendProblem(req, res, {
          status: 500,
          code: ErrorCodes.INTERNAL_ERROR,
          detail: 'Internal Server Error',
        });
      }
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return sendProblem(req, res, {
          status: 403,
          code: ErrorCodes.FORBIDDEN,
          detail: 'User is not associated with an organization',
        });
      }

      const id = parseInt(req.params.id as string);
      if (isNaN(id) || id <= 0) {
        return sendProblem(req, res, {
          status: 400,
          code: ErrorCodes.BAD_REQUEST,
          detail: 'Invalid ID',
        });
      }

      const employee = await employeeService.delete(id, organizationId);
      if (!employee) {
        return sendProblem(req, res, {
          status: 404,
          code: ErrorCodes.NOT_FOUND,
          detail: 'Employee not found in your organization',
        });
      }

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete employee', error);
      sendProblem(req, res, {
        status: 500,
        code: ErrorCodes.INTERNAL_ERROR,
        detail: 'Internal Server Error',
      });
    }
  }
}

export const employeeController = new EmployeeController();
