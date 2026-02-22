import { Router } from 'express';
import { employeeController } from '../controllers/employeeController';

const router = Router();

/**
 * @route POST /api/employees
 * @desc Create a new employee
 */
router.post('/', employeeController.create.bind(employeeController));

/**
 * @route GET /api/employees
 * @desc Get all employees with pagination and filtering
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 10)
 * @query search - Search term
 * @query status - Filter by status
 * @query department - Filter by department
 * @query organization_id - Filter by organization
 */
router.get('/', employeeController.getAll.bind(employeeController));

/**
 * @route GET /api/employees/:id
 * @desc Get a single employee by ID
 */
router.get('/:id', employeeController.getOne.bind(employeeController));

/**
 * @route PATCH /api/employees/:id
 * @desc Update an employee
 */
router.patch('/:id', employeeController.update.bind(employeeController));

/**
 * @route DELETE /api/employees/:id
 * @desc Soft delete an employee
 */
router.delete('/:id', employeeController.delete.bind(employeeController));

export default router;
