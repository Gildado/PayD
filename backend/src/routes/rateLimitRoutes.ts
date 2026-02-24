import { Router } from 'express';
import { RateLimitController } from '../controllers/rateLimitController';

const router = Router();

router.get('/status', RateLimitController.getStatus);
router.get('/tiers', RateLimitController.getTiers);

export default router;
