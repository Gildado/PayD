import { Request, Response } from 'express';
import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';
import { TrustlineService } from '../services/trustlineService.js';
import { getAssetIssuer, getSupportedAssets } from '../config/assets.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const checkTrustlineSchema = z.object({
  /** Optional: if omitted, the issuer is resolved from the asset registry. */
  assetIssuer: z.string().length(56).optional(),
  /** Asset code to check. Defaults to 'ORGUSD' for backward compatibility. */
  assetCode: z.string().max(12).optional().default('ORGUSD'),
});

const refreshTrustlineSchema = z.object({
  assetIssuer: z.string().length(56).optional(),
  assetCode: z.string().max(12).optional().default('ORGUSD'),
});

const promptTrustlineSchema = z.object({
  employeeId: z.number().int().positive(),
  walletAddress: z.string().length(56),
  assetCode: z.string().max(12).optional().default('ORGUSD'),
  assetIssuer: z.string().length(56).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective issuer: use the explicit value when provided,
 * otherwise look it up from the asset registry.
 */
function resolveIssuer(assetCode: string, explicitIssuer?: string): string {
  if (explicitIssuer) return explicitIssuer;
  const issuer = getAssetIssuer(assetCode);
  if (!issuer) {
    throw new Error(
      `No issuer configured for asset "${assetCode}". Provide assetIssuer explicitly or set ${assetCode}_ISSUER_PUBLIC.`
    );
  }
  return issuer;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class TrustlineController {
  /**
   * GET /api/trustlines/check/:walletAddress
   * Check trustline status for any wallet and asset via Horizon.
   * Query params: assetCode (default 'ORGUSD'), assetIssuer (optional override)
   */
  static async checkWallet(req: Request, res: Response) {
    try {
      const { walletAddress } = req.params;

      // Validate Stellar address format before calling Horizon
      if (!StrKey.isValidEd25519PublicKey(walletAddress)) {
        return res.status(400).json({ error: 'Invalid Stellar wallet address format.' });
      }

      const { assetCode, assetIssuer: explicitIssuer } = checkTrustlineSchema.parse(req.query);

      const assetIssuer = resolveIssuer(assetCode, explicitIssuer);

      const result = await TrustlineService.checkTrustline(
        walletAddress as string,
        assetCode,
        assetIssuer
      );

      res.json({
        walletAddress,
        assetCode,
        assetIssuer,
        trustlineEstablished: result.exists,
        balance: result.balance ?? null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation Error', details: error.issues });
      }
      console.error('Check Trustline Error:', error);
      res.status(500).json({ error: 'Failed to check trustline status.' });
    }
  }

  /**
   * GET /api/trustlines/employees/:employeeId
   * Get all stored trustline records for an employee.
   * Optional query param: assetCode – filter to a specific asset.
   */
  static async getEmployeeStatus(req: Request, res: Response) {
    try {
      const employeeId = parseInt(req.params.employeeId as string, 10);
      if (isNaN(employeeId)) {
        return res.status(400).json({ error: 'Invalid employee ID.' });
      }

      const assetCode = req.query.assetCode as string | undefined;

      const records = await TrustlineService.getEmployeeTrustlines(employeeId, assetCode);

      if (records.length === 0) {
        return res.json({
          employeeId,
          records: [],
          message: 'No trustline records found. Run a refresh.',
        });
      }

      res.json({ employeeId, records });
    } catch (error) {
      console.error('Get Employee Trustline Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * GET /api/trustlines/supported-assets
   * Returns the list of all supported assets with their codes and issuers.
   */
  static async listSupportedAssets(_req: Request, res: Response) {
    res.json({ assets: getSupportedAssets() });
  }

  /**
   * POST /api/trustlines/employees/:employeeId/refresh
   * Re-check Horizon and update the DB for an employee.
   * Body: { assetCode?, assetIssuer? }
   */
  static async refreshEmployee(req: Request, res: Response) {
    try {
      const employeeId = parseInt(req.params.employeeId as string, 10);
      if (isNaN(employeeId)) {
        return res.status(400).json({ error: 'Invalid employee ID.' });
      }

      const { assetCode, assetIssuer: explicitIssuer } = refreshTrustlineSchema.parse(req.body);
      const assetIssuer = resolveIssuer(assetCode, explicitIssuer);

      const record = await TrustlineService.refreshEmployeeTrustline(
        employeeId,
        assetCode,
        assetIssuer
      );

      if (!record) {
        return res.status(404).json({ error: 'Employee not found or has no wallet address.' });
      }

      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation Error', details: error.issues });
      }
      console.error('Refresh Trustline Error:', error);
      res.status(500).json({ error: 'Failed to refresh trustline status.' });
    }
  }

  /**
   * POST /api/trustlines/prompt
   * Build an unsigned changeTrust XDR and mark the employee trustline as pending.
   * Body: { employeeId, walletAddress, assetCode?, assetIssuer? }
   */
  static async promptTrustline(req: Request, res: Response) {
    try {
      const {
        employeeId,
        walletAddress,
        assetCode,
        assetIssuer: explicitIssuer,
      } = promptTrustlineSchema.parse(req.body);

      const assetIssuer = resolveIssuer(assetCode, explicitIssuer);

      const xdr = await TrustlineService.buildTrustlineTransaction(
        walletAddress,
        assetCode,
        assetIssuer
      );

      await TrustlineService.markPending(employeeId, walletAddress, assetCode, assetIssuer);

      res.json({
        xdr,
        assetCode,
        assetIssuer,
        message: `Sign this transaction to establish your ${assetCode} trustline.`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation Error', details: error.issues });
      }
      console.error('Prompt Trustline Error:', error);
      res.status(500).json({ error: 'Failed to build trustline transaction.' });
    }
  }
}
