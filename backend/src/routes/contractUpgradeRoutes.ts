import { Router } from 'express';
import { ContractUpgradeController } from '../controllers/contractUpgradeController';

const router = Router();

// ---------------------------------------------------------------------------
// Contract registry — list & detail
// ---------------------------------------------------------------------------

/** GET /api/v1/contracts — list all registered contracts */
router.get('/', (req, res) => void ContractUpgradeController.listContracts(req, res));

/** GET /api/v1/contracts/:registryId — single contract detail */
router.get('/:registryId', (req, res) => void ContractUpgradeController.getContract(req, res));

// ---------------------------------------------------------------------------
// Per-contract upgrade lifecycle
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/contracts/:registryId/validate-hash
 * Body: { newWasmHash }
 * Validates format + on-chain existence before simulation.
 */
router.post(
  '/:registryId/validate-hash',
  (req, res) => void ContractUpgradeController.validateHash(req, res)
);

/**
 * POST /api/v1/contracts/:registryId/simulate-upgrade
 * Body: { newWasmHash, initiatedBy, notes? }
 * Pre-flights the upgrade via Soroban RPC, returns cost estimate.
 */
router.post(
  '/:registryId/simulate-upgrade',
  (req, res) => void ContractUpgradeController.simulateUpgrade(req, res)
);

/**
 * GET /api/v1/contracts/:registryId/upgrade-logs
 * Query: ?page=1&limit=20
 * Paginated upgrade history for a specific contract.
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
 * POST /api/v1/contracts/upgrade-logs/:logId/execute
 * Body: { adminSecret }
 * Executes a simulated upgrade on-chain and starts migration.
 */
router.post(
  '/upgrade-logs/:logId/execute',
  (req, res) => void ContractUpgradeController.executeUpgrade(req, res)
);

/**
 * GET /api/v1/contracts/upgrade-logs/:logId/status
 * Polls migration step progress for an executing upgrade.
 */
router.get(
  '/upgrade-logs/:logId/status',
  (req, res) => void ContractUpgradeController.getUpgradeStatus(req, res)
);

/**
 * POST /api/v1/contracts/upgrade-logs/:logId/cancel
 * Cancels a pending or simulated upgrade before execution.
 */
router.post(
  '/upgrade-logs/:logId/cancel',
  (req, res) => void ContractUpgradeController.cancelUpgrade(req, res)
);

export default router;
