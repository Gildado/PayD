import { Router } from 'express';
import { TaxController } from '../controllers/taxController';

const router = Router();

// Tax rule CRUD
router.post('/rules', TaxController.createRule);
router.get('/rules', TaxController.getRules);
router.put('/rules/:id', TaxController.updateRule);
router.delete('/rules/:id', TaxController.deleteRule);

// Tax calculation
router.post('/calculate', TaxController.calculateDeductions);

// Tax compliance reports
router.get('/reports', TaxController.getReport);

export default router;
