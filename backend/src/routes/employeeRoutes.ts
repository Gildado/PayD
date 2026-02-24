import { Router } from 'express';
import { employeeController } from '../controllers/employeeController';
import authenticateJWT  from '../middlewares/auth';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac';

const router = Router();

// Apply authentication to all employee routes
router.use(authenticateJWT);

/**
 * @route POST /api/employees
 * @desc Create a new employee
 */
router.post('/', authorizeRoles('EMPLOYER'), isolateOrganization, employeeController.create.bind(employeeController));

/**
 * @route GET /api/employees
 * @desc Get all employees with pagination and filtering
 */
router.get('/', authorizeRoles('EMPLOYER'), isolateOrganization, employeeController.getAll.bind(employeeController));

/**
 * @route GET /api/employees/:id
 * @desc Get a single employee by ID
 */
router.get('/:id', authorizeRoles('EMPLOYER', 'EMPLOYEE'), isolateOrganization, employeeController.getOne.bind(employeeController));

/**
 * @route PATCH /api/employees/:id
 * @desc Update an employee
 */
router.patch('/:id', authorizeRoles('EMPLOYER'), isolateOrganization, employeeController.update.bind(employeeController));

/**
 * @route DELETE /api/employees/:id
 * @desc Soft delete an employee
 */
router.delete('/:id', authorizeRoles('EMPLOYER'), isolateOrganization, employeeController.delete.bind(employeeController));

/**
 * @route POST /api/employees/bulk-import
 * @desc Bulk import employees from CSV
 */
import { bulkImportController } from '../controllers/bulkImportController';
router.post('/bulk-import', bulkImportController.import.bind(bulkImportController));

export default router;