import { Router } from 'express';
import { AuthController } from '../controllers/authController';

const router = Router();

router.post('/2fa/setup', AuthController.setup2fa);
router.post('/2fa/verify', AuthController.verify2fa);
router.post('/2fa/disable', AuthController.disable2fa);

export default router;
