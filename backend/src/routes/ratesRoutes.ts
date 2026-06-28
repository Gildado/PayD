import { Router } from 'express';
import { RatesController } from '../controllers/ratesController.js';

const router = Router();

router.get('/convert', RatesController.convert);
router.get('/', RatesController.getRates);

export default router;
