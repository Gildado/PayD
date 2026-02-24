import { Router } from 'express';
import { AuthController } from '../controllers/authController';

const router = Router();

router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/2fa/setup', AuthController.setup2fa);
router.post('/2fa/verify', AuthController.verify2fa);
router.post('/2fa/disable', AuthController.disable2fa);

export default router;
