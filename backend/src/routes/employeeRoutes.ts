import { Router } from 'express';
import { employeeController } from '../controllers/employeeController.js';
import { bulkImportController } from '../controllers/bulkImportController.js';
import authenticateJWT from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';

const router = Router();

// Apply authentication to all employee routes
router.use(authenticateJWT);

/**
 * @route POST /api/employees/bulk-import
 * @desc Bulk import employees from CSV
 */
router.post(
  '/bulk-import',
  authorizeRoles('EMPLOYER'),
  isolateOrganization,
  bulkImportController.import.bind(bulkImportController)
);

/**
 * @route POST /api/employees
 * @desc Create a new employee
 */
router.post(
  '/',
  authorizeRoles('EMPLOYER'),
  isolateOrganization,
  employeeController.create.bind(employeeController)
);

/**
 * @route GET /api/employees
 * @desc Get all employees with pagination and filtering
 */
router.get(
  '/',
  authorizeRoles('EMPLOYER'),
  isolateOrganization,
  employeeController.getAll.bind(employeeController)
);

/**
 * @route GET /api/employees/:id
 * @desc Get a single employee by ID
 */
router.get(
  '/:id',
  authorizeRoles('EMPLOYER', 'EMPLOYEE'),
  isolateOrganization,
  employeeController.getOne.bind(employeeController)
);

/**
 * @route PATCH /api/employees/:id
 * @desc Update an employee
 */
router.patch(
  '/:id',
  authorizeRoles('EMPLOYER'),
  isolateOrganization,
  employeeController.update.bind(employeeController)
);

/**
 * @route PUT /api/employees/:id
 * @desc Update an employee
 */
router.put(
  '/:id',
  authorizeRoles('EMPLOYER'),
  isolateOrganization,
  employeeController.update.bind(employeeController)
);

/**
 * @route DELETE /api/employees/:id
 * @desc Soft delete an employee
 */
router.delete(
  '/:id',
  authorizeRoles('EMPLOYER'),
  isolateOrganization,
  employeeController.delete.bind(employeeController)
);

export default router;
