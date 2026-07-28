import express, { Router } from 'express';
import { employeeController } from '../controllers/employeeController.js';
import { bulkImportController } from '../controllers/bulkImportController.js';
import authenticateJWT from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';
import { cacheResponse, invalidateCache } from '../middlewares/cacheMiddleware.js';
import { MAX_BULK_IMPORT_REQUEST_BYTES } from '../schemas/bulkImportSchema.js';

const router = Router();

// Apply authentication to all employee routes
router.use(authenticateJWT);

/**
 * @route POST /api/employees/bulk-import
 * @desc Bulk import employees from CSV
 *
 * The JSON body parser is scoped to this route with an explicit size cap so
 * that oversized payloads are rejected by Express before they reach the
 * controller, preventing memory pressure (OOM) from very large uploads.
 */
router.post(
  '/bulk-import',
  express.json({ limit: MAX_BULK_IMPORT_REQUEST_BYTES }),
  authorizeRoles('EMPLOYER'),
  isolateOrganization,
  invalidateCache(),
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
  invalidateCache(),
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
  cacheResponse({ ttlSeconds: 300, cacheControl: 'private, max-age=300' }),
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
  cacheResponse({ ttlSeconds: 300, cacheControl: 'private, max-age=300' }),
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
  invalidateCache(),
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
  invalidateCache(),
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
  invalidateCache(),
  employeeController.delete.bind(employeeController)
);

export default router;
