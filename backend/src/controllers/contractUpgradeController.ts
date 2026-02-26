import { Request, Response } from 'express';
import { z } from 'zod';
import { ContractUpgradeService } from '../services/contractUpgradeService';

// ---------------------------------------------------------------------------
// Validation schemas — defined once at module scope (O(1) memory)
// ---------------------------------------------------------------------------

/** Lowercase 64-char hex — SHA-256 of the WASM bytecode. */
const wasmHashSchema = z
  .string()
  .length(64, 'WASM hash must be exactly 64 hex characters.')
  .regex(/^[0-9a-f]{64}$/i, 'WASM hash must be a valid lowercase hex string.');

const simulateBodySchema = z.object({
  newWasmHash: wasmHashSchema,
  initiatedBy: z.string().min(56).max(64, 'initiatedBy must be a Stellar public key (G...)'),
  notes: z.string().max(1000).optional(),
});

const executeBodySchema = z.object({
  adminSecret: z
    .string()
    .min(56, 'adminSecret must be a valid Stellar secret key (S...)'),
});

const validateHashBodySchema = z.object({
  newWasmHash: wasmHashSchema,
});

const registryIdSchema = z.object({
  registryId: z.coerce.number().int().positive(),
});

const upgradeLogIdSchema = z.object({
  logId: z.coerce.number().int().positive(),
});

const listLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// ---------------------------------------------------------------------------
// ContractUpgradeController
// ---------------------------------------------------------------------------

export class ContractUpgradeController {
  // -------------------------------------------------------------------------
  // GET /api/v1/contracts
  // -------------------------------------------------------------------------

  /**
   * List all registered Soroban contracts with their current WASM hash.
   */
  static async listContracts(_req: Request, res: Response): Promise<void> {
    try {
      const contracts = await ContractUpgradeService.listContracts();
      res.status(200).json({ success: true, data: contracts, total: contracts.length });
    } catch (error: unknown) {
      ContractUpgradeController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // GET /api/v1/contracts/:registryId
  // -------------------------------------------------------------------------

  /**
   * Retrieve a single contract by its registry DB id.
   */
  static async getContract(req: Request, res: Response): Promise<void> {
    try {
      const { registryId } = registryIdSchema.parse(req.params);
      const contract = await ContractUpgradeService.getContract(registryId);

      if (!contract) {
        res.status(404).json({ error: 'Contract not found in registry.' });
        return;
      }

      res.status(200).json({ success: true, data: contract });
    } catch (error: unknown) {
      ContractUpgradeController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // POST /api/v1/contracts/:registryId/validate-hash
  // -------------------------------------------------------------------------

  /**
   * Validate a candidate WASM hash against:
   *   1. Format (64 lowercase hex chars)
   *   2. Difference from current deployed hash
   *   3. On-chain existence (Soroban RPC)
   *
   * Body: { newWasmHash }
   */
  static async validateHash(req: Request, res: Response): Promise<void> {
    try {
      const { registryId } = registryIdSchema.parse(req.params);
      const { newWasmHash } = validateHashBodySchema.parse(req.body);

      const result = await ContractUpgradeService.validateWasmHash(registryId, newWasmHash);

      res.status(200).json({ success: true, ...result });
    } catch (error: unknown) {
      ContractUpgradeController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // POST /api/v1/contracts/:registryId/simulate-upgrade
  // -------------------------------------------------------------------------

  /**
   * Simulate the upgrade transaction via Soroban RPC.
   * Creates an upgrade log row and returns simulation cost/result.
   *
   * Body: { newWasmHash, initiatedBy, notes? }
   */
  static async simulateUpgrade(req: Request, res: Response): Promise<void> {
    try {
      const { registryId } = registryIdSchema.parse(req.params);
      const body = simulateBodySchema.parse(req.body);

      const { upgradeLogId, simulation } = await ContractUpgradeService.simulateUpgrade(
        registryId,
        body.newWasmHash,
        body.initiatedBy,
        body.notes
      );

      res.status(200).json({
        success: true,
        upgradeLogId,
        simulation,
        message: simulation.success
          ? 'Simulation passed. Review the diff and confirm to proceed.'
          : 'Simulation failed. Resolve the reported error before proceeding.',
      });
    } catch (error: unknown) {
      ContractUpgradeController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // POST /api/v1/contracts/upgrade-logs/:logId/execute
  // -------------------------------------------------------------------------

  /**
   * Execute a previously simulated upgrade on-chain.
   * Signs and submits the upgrade transaction, then triggers migration steps.
   *
   * Body: { adminSecret }
   */
  static async executeUpgrade(req: Request, res: Response): Promise<void> {
    try {
      const { logId } = upgradeLogIdSchema.parse(req.params);
      const { adminSecret } = executeBodySchema.parse(req.body);

      const result = await ContractUpgradeService.executeUpgrade(logId, adminSecret);

      res.status(200).json({
        success: true,
        ...result,
        message: 'Upgrade transaction submitted. Poll /status for migration progress.',
      });
    } catch (error: unknown) {
      ContractUpgradeController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // GET /api/v1/contracts/upgrade-logs/:logId/status
  // -------------------------------------------------------------------------

  /**
   * Poll the current status of an upgrade log including migration step progress.
   * Designed for repeated short-interval polling from the frontend.
   */
  static async getUpgradeStatus(req: Request, res: Response): Promise<void> {
    try {
      const { logId } = upgradeLogIdSchema.parse(req.params);
      const log = await ContractUpgradeService.getUpgradeLogStatus(logId);

      if (!log) {
        res.status(404).json({ error: 'Upgrade log not found.' });
        return;
      }

      res.status(200).json({ success: true, data: log });
    } catch (error: unknown) {
      ContractUpgradeController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // GET /api/v1/contracts/:registryId/upgrade-logs
  // -------------------------------------------------------------------------

  /**
   * Paginated upgrade history for a specific contract.
   *
   * Query params: ?page=1&limit=20
   */
  static async listUpgradeLogs(req: Request, res: Response): Promise<void> {
    try {
      const { registryId } = registryIdSchema.parse(req.params);
      const { page, limit } = listLogsQuerySchema.parse(req.query);

      const result = await ContractUpgradeService.listUpgradeLogs(registryId, page, limit);

      res.status(200).json({ success: true, ...result });
    } catch (error: unknown) {
      ContractUpgradeController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // POST /api/v1/contracts/upgrade-logs/:logId/cancel
  // -------------------------------------------------------------------------

  /**
   * Cancel a pending or simulated upgrade before it has been executed.
   */
  static async cancelUpgrade(req: Request, res: Response): Promise<void> {
    try {
      const { logId } = upgradeLogIdSchema.parse(req.params);
      await ContractUpgradeService.cancelUpgrade(logId);

      res.status(200).json({ success: true, message: 'Upgrade cancelled successfully.' });
    } catch (error: unknown) {
      ContractUpgradeController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // Shared error handler
  // -------------------------------------------------------------------------

  /**
   * Centralised error mapper — keeps action methods free of repetitive
   * try/catch blocks with status-code branching.
   */
  private static handleError(error: unknown, res: Response): void {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }

    // Stellar SDK throws when a secret key is invalid
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('invalid') || msg.includes('Invalid') || msg.includes('Invalid secret')) {
      res.status(400).json({ error: 'Invalid admin secret key.' });
      return;
    }

    if (msg.includes('not found')) {
      res.status(404).json({ error: msg });
      return;
    }

    if (msg.includes('Cannot execute') || msg.includes('cannot be cancelled')) {
      res.status(409).json({ error: msg });
      return;
    }

    console.error('ContractUpgradeController unhandled error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
