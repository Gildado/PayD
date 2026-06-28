import { Router } from 'express';
import authenticateJWT from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';
import { requireTenantContext } from '../middleware/tenantContext.js';
import { tenantConfigController } from '../controllers/tenantConfigController.js';

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER'));
router.use(isolateOrganization);
router.use(requireTenantContext);

router.get('/', tenantConfigController.getAll.bind(tenantConfigController));
router.get('/:configKey', tenantConfigController.getOne.bind(tenantConfigController));
router.put('/', tenantConfigController.upsert.bind(tenantConfigController));
router.delete('/:configKey', tenantConfigController.remove.bind(tenantConfigController));

export default router;
