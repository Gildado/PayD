import { Router } from 'express';
import { MultiSigController } from '../controllers/multiSigController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Multi-sig
 *   description: Account multi-signature configuration and management
 */

/**
 * @swagger
 * /api/v1/multisig/configure:
 *   post:
 *     summary: Full multi-sig setup for an account
 *     tags: [Multi-sig]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/configure', MultiSigController.configure);

/**
 * @swagger
 * /api/v1/multisig/status/{publicKey}:
 *   get:
 *     summary: Get current signers and thresholds
 *     tags: [Multi-sig]
 *     parameters:
 *       - in: path
 *         name: publicKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/status/:publicKey', MultiSigController.getStatus);

/**
 * @swagger
 * /api/v1/multisig/signers:
 *   post:
 *     summary: Add a signer to an account
 *     tags: [Multi-sig]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/signers', MultiSigController.addSigner);

/**
 * @swagger
 * /api/v1/multisig/signers/{publicKey}:
 *   delete:
 *     summary: Remove a signer from an account
 *     tags: [Multi-sig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publicKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.delete('/signers/:publicKey', MultiSigController.removeSigner);

/**
 * @swagger
 * /api/v1/multisig/thresholds:
 *   put:
 *     summary: Update account thresholds
 *     tags: [Multi-sig]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.put('/thresholds', MultiSigController.updateThresholds);

export default router;
