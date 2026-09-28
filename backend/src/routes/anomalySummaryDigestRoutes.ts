import { Router } from 'express';
import { AnomalySummaryDigestController } from '../controllers/anomalySummaryDigestController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/rbac.js';

const router = Router();

router.get('/anomaly-digest', authenticate, requireAdmin, AnomalySummaryDigestController.getDigest);

export default router;
