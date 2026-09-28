import { Router } from 'express';
import { ContractUpgradeController } from '../controllers/contractUpgradeController.js';
import authenticateJWT from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';
import { optionalIpWhitelist } from '../middlewares/ipWhitelist.js';

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER'));
router.use(isolateOrganization);
router.use(optionalIpWhitelist);

/**
 * @swagger
 * tags:
 *   name: Contract Upgrades
 *   description: On-chain contract upgrade lifecycle
 */

// ---------------------------------------------------------------------------
// Contract registry — list & detail
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/contracts:
 *   get:
 *     summary: List all registered contracts
 *     tags: [Contract Upgrades]
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', (req, res) => void ContractUpgradeController.listContracts(req, res));

/**
 * @swagger
 * /api/v1/contracts/{registryId}:
 *   get:
 *     summary: Single contract detail
 *     tags: [Contract Upgrades]
 *     parameters:
 *       - in: path
 *         name: registryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/:registryId', (req, res) => void ContractUpgradeController.getContract(req, res));

// ---------------------------------------------------------------------------
// Per-contract upgrade lifecycle
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/contracts/{registryId}/validate-hash:
 *   post:
 *     summary: Validates WASM hash format and on-chain existence
 *     tags: [Contract Upgrades]
 *     parameters:
 *       - in: path
 *         name: registryId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newWasmHash:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post(
  '/:registryId/validate-hash',
  (req, res) => void ContractUpgradeController.validateHash(req, res)
);

/**
 * @swagger
 * /api/v1/contracts/{registryId}/simulate-upgrade:
 *   post:
 *     summary: Pre-flights the upgrade via Soroban RPC
 *     tags: [Contract Upgrades]
 *     parameters:
 *       - in: path
 *         name: registryId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newWasmHash:
 *                 type: string
 *               initiatedBy:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post(
  '/:registryId/simulate-upgrade',
  (req, res) => void ContractUpgradeController.simulateUpgrade(req, res)
);

/**
 * @swagger
 * /api/v1/contracts/{registryId}/upgrade-logs:
 *   get:
 *     summary: Paginated upgrade history for a specific contract
 *     tags: [Contract Upgrades]
 *     parameters:
 *       - in: path
 *         name: registryId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/:registryId/upgrade-logs',
  (req, res) => void ContractUpgradeController.listUpgradeLogs(req, res)
);

// ---------------------------------------------------------------------------
// Upgrade log actions (logId-scoped, placed before /:registryId to avoid
// route ambiguity — Express matches in registration order)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/contracts/upgrade-logs/{logId}/execute:
 *   post:
 *     summary: Executes a simulated upgrade on-chain
 *     tags: [Contract Upgrades]
 *     parameters:
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminSecret:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post(
  '/upgrade-logs/:logId/execute',
  (req, res) => void ContractUpgradeController.executeUpgrade(req, res)
);

/**
 * @swagger
 * /api/v1/contracts/upgrade-logs/{logId}/status:
 *   get:
 *     summary: Polls migration step progress for an executing upgrade
 *     tags: [Contract Upgrades]
 *     parameters:
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/upgrade-logs/:logId/status',
  (req, res) => void ContractUpgradeController.getUpgradeStatus(req, res)
);

/**
 * @swagger
 * /api/v1/contracts/upgrade-logs/{logId}/cancel:
 *   post:
 *     summary: Cancels a pending or simulated upgrade before execution
 *     tags: [Contract Upgrades]
 *     parameters:
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post(
  '/upgrade-logs/:logId/cancel',
  (req, res) => void ContractUpgradeController.cancelUpgrade(req, res)
);

export default router;
