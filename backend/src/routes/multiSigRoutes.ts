import { Router } from 'express';
import { MultiSigController } from '../controllers/multiSigController';

const router = Router();

// POST /api/v1/multisig/configure - Full multi-sig setup
router.post('/configure', MultiSigController.configure);

// GET /api/v1/multisig/status/:publicKey - Get current signers/thresholds
router.get('/status/:publicKey', MultiSigController.getStatus);

// POST /api/v1/multisig/signers - Add a signer
router.post('/signers', MultiSigController.addSigner);

// DELETE /api/v1/multisig/signers/:publicKey - Remove a signer
router.delete('/signers/:publicKey', MultiSigController.removeSigner);

// PUT /api/v1/multisig/thresholds - Update thresholds
router.put('/thresholds', MultiSigController.updateThresholds);

export default router;
