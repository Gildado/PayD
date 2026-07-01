import { Request, Response } from 'express';
import { z } from 'zod';
import { Keypair } from '@stellar/stellar-sdk';
import { FreezeService, FreezeAction } from '../services/freezeService.js';
import { getAssetIssuer } from '../config/assets.js';

// ---------------------------------------------------------------------------
// Validation schemas (defined once at module scope — O(1) memory cost)
// ---------------------------------------------------------------------------

/** Shared fields required for every freeze / unfreeze request. */
const baseFreezeSchema = z.object({
  /** Secret key of the asset issuer (admin). */
  issuerSecret: z.string().min(56, 'issuerSecret must be a valid Stellar secret key'),
  /** Asset code to freeze/unfreeze. */
  assetCode: z
    .string()
    .min(1)
    .max(12)
    .regex(/^[A-Z0-9]+$/, 'assetCode must be uppercase alphanumeric'),
  /** Human-readable justification for the action. */
  reason: z.string().max(500).optional(),
});

/** Schema for account-scoped freeze / unfreeze. */
const accountFreezeSchema = baseFreezeSchema.extend({
  /** Stellar public key of the account to freeze / unfreeze. */
  targetAccount: z.string().length(56, 'targetAccount must be a 56-character Stellar public key'),
});

/** Schema for listing freeze logs. */
const listLogsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  targetAccount: z.string().length(56).optional(),
  action: z.enum(['freeze', 'unfreeze']).optional(),
  assetCode: z
    .string()
    .max(12)
    .regex(/^[A-Z0-9]+$/)
    .optional(),
});

/** Schema for the :targetAccount path param. */
const targetAccountParamSchema = z.object({
  targetAccount: z.string().length(56, 'targetAccount must be a 56-character Stellar public key'),
});

/** Schema for status-check query params. */
const statusQuerySchema = z.object({
  assetIssuer: z.string().length(56, 'assetIssuer must be a 56-character Stellar public key'),
  assetCode: z
    .string()
    .min(1)
    .max(12)
    .regex(/^[A-Z0-9]+$/, 'assetCode must be uppercase alphanumeric'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely derive a Keypair from a secret key and surface a typed 400 if
 * the value is malformed. Keeps controller methods free of try/catch noise.
 */
function parseKeypair(secret: string): Keypair {
  return Keypair.fromSecret(secret); // throws on invalid input
}

/**
 * Verify that the public key derived from the issuerSecret matches the
 * configured issuer for the given asset code. This prevents submission
 * of transactions that will fail due to auth mismatch.
 * 
 * @throws Error if the public keys don't match
 */
function validateIssuerMatch(issuerKeypair: Keypair, assetCode: string): void {
  const derivedPublicKey = issuerKeypair.publicKey();
  const configuredIssuer = getAssetIssuer(assetCode);

  if (!configuredIssuer) {
    throw new Error(
      `No issuer configured for asset "${assetCode}". Set ${assetCode}_ISSUER_PUBLIC in your environment.`
    );
  }

  if (derivedPublicKey !== configuredIssuer) {
    throw new Error(
      `Issuer secret mismatch: The provided secret derives to ${derivedPublicKey}, ` +
      `but the configured issuer for ${assetCode} is ${configuredIssuer}. ` +
      `Please verify you are using the correct issuer secret.`
    );
  }
}

// ---------------------------------------------------------------------------
// FreezeController
// ---------------------------------------------------------------------------

export class FreezeController {
  // -------------------------------------------------------------------------
  // POST /api/freeze/account/:action
  //   action ∈ { "freeze", "unfreeze" }
  // -------------------------------------------------------------------------

  /**
   * Freeze a single account's trustline for the given asset.
   *
   * Body: { issuerSecret, targetAccount, assetCode, reason? }
   */
  static async freezeAccount(req: Request, res: Response): Promise<void> {
    try {
      const action: FreezeAction = 'freeze';
      const body = accountFreezeSchema.parse(req.body);

      const issuerKeypair = parseKeypair(body.issuerSecret);
      
      // Validate that the derived public key matches the configured issuer
      validateIssuerMatch(issuerKeypair, body.assetCode);

      const result = await FreezeService.toggleAccountFreeze(
        issuerKeypair,
        body.targetAccount,
        body.assetCode,
        action,
        body.reason
      );

      res.status(200).json({
        success: true,
        message: `Account ${body.targetAccount} frozen for asset ${body.assetCode}.`,
        data: result,
      });
    } catch (error: any) {
      FreezeController.handleError(error, res);
    }
  }

  /**
   * Unfreeze a single account's trustline for the given asset.
   *
   * Body: { issuerSecret, targetAccount, assetCode, reason? }
   */
  static async unfreezeAccount(req: Request, res: Response): Promise<void> {
    try {
      const action: FreezeAction = 'unfreeze';
      const body = accountFreezeSchema.parse(req.body);

      const issuerKeypair = parseKeypair(body.issuerSecret);
      
      // Validate that the derived public key matches the configured issuer
      validateIssuerMatch(issuerKeypair, body.assetCode);

      const result = await FreezeService.toggleAccountFreeze(
        issuerKeypair,
        body.targetAccount,
        body.assetCode,
        action,
        body.reason
      );

      res.status(200).json({
        success: true,
        message: `Account ${body.targetAccount} unfrozen for asset ${body.assetCode}.`,
        data: result,
      });
    } catch (error: any) {
      FreezeController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // POST /api/freeze/global/:action
  //   action ∈ { "freeze", "unfreeze" }
  // -------------------------------------------------------------------------

  /**
   * Freeze ALL accounts that hold the given asset globally.
   *
   * Body: { issuerSecret, assetCode, reason? }
   */
  static async freezeGlobal(req: Request, res: Response): Promise<void> {
    try {
      const body = baseFreezeSchema.parse(req.body);
      const issuerKeypair = parseKeypair(body.issuerSecret);
      
      // Validate that the derived public key matches the configured issuer
      validateIssuerMatch(issuerKeypair, body.assetCode);

      const results = await FreezeService.toggleGlobalFreeze(
        issuerKeypair,
        body.assetCode,
        'freeze',
        body.reason
      );

      res.status(200).json({
        success: true,
        message: `Global freeze applied to ${results.length} account(s) for asset ${body.assetCode}.`,
        data: { affectedCount: results.length, results },
      });
    } catch (error: any) {
      FreezeController.handleError(error, res);
    }
  }

  /**
   * Unfreeze ALL accounts that hold the given asset globally.
   *
   * Body: { issuerSecret, assetCode, reason? }
   */
  static async unfreezeGlobal(req: Request, res: Response): Promise<void> {
    try {
      const body = baseFreezeSchema.parse(req.body);
      const issuerKeypair = parseKeypair(body.issuerSecret);
      
      // Validate that the derived public key matches the configured issuer
      validateIssuerMatch(issuerKeypair, body.assetCode);

      const results = await FreezeService.toggleGlobalFreeze(
        issuerKeypair,
        body.assetCode,
        'unfreeze',
        body.reason
      );

      res.status(200).json({
        success: true,
        message: `Global unfreeze applied to ${results.length} account(s) for asset ${body.assetCode}.`,
        data: { affectedCount: results.length, results },
      });
    } catch (error: any) {
      FreezeController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // GET /api/freeze/status/:targetAccount
  // -------------------------------------------------------------------------

  /**
   * Check whether a specific account is currently frozen for an asset.
   *
   * Query params: ?assetCode=ORGUSD&assetIssuer=G...
   */
  static async checkStatus(req: Request, res: Response): Promise<void> {
    try {
      const { targetAccount } = targetAccountParamSchema.parse(req.params);
      const query = statusQuerySchema.parse(req.query);

      const frozen = await FreezeService.isFrozen(
        targetAccount,
        query.assetCode,
        query.assetIssuer
      );

      const latestLog = await FreezeService.getLatestLog(
        targetAccount,
        query.assetCode,
        query.assetIssuer
      );

      res.status(200).json({
        targetAccount,
        assetCode: query.assetCode,
        assetIssuer: query.assetIssuer,
        isFrozen: frozen,
        latestAction: latestLog ?? null,
      });
    } catch (error: any) {
      FreezeController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // GET /api/freeze/logs
  // -------------------------------------------------------------------------

  /**
   * Paginated audit log of all freeze / unfreeze events.
   *
   * Query params: ?page=1&limit=20&targetAccount=G...&action=freeze&assetCode=ORGUSD
   */
  static async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const query = listLogsSchema.parse(req.query);

      const page = await FreezeService.listLogs({
        page: query.page,
        limit: query.limit,
        targetAccount: query.targetAccount,
        action: query.action,
        assetCode: query.assetCode,
      });

      res.status(200).json({
        success: true,
        ...page,
      });
    } catch (error: any) {
      FreezeController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // Shared error handler
  // -------------------------------------------------------------------------

  /**
   * Centralised error handler. Maps known error types to appropriate HTTP
   * status codes, keeping repetition out of every action method.
   */
  private static handleError(error: any, res: Response): void {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.issues,
      });
      return;
    }

    // Issuer secret mismatch error
    if (error?.message?.includes('Issuer secret mismatch')) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Missing issuer configuration
    if (error?.message?.includes('No issuer configured')) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Stellar SDK throws when a secret key is invalid
    if (error?.message?.includes('invalid') || error?.message?.includes('Invalid')) {
      res.status(400).json({ error: 'Invalid issuer secret key.' });
      return;
    }

    // Horizon submission failure – surface the upstream detail
    if (error?.response?.data) {
      const extras = error.response.data?.extras;
      res.status(502).json({
        error: 'Stellar network error',
        detail: error.response.data.title ?? error.message,
        resultCodes: extras?.result_codes ?? null,
      });
      return;
    }

    console.error('FreezeController unhandled error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
