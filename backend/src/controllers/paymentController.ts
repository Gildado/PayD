import { Request, Response } from 'express';
import { AnchorService } from '../services/anchorService.js';
import { Keypair } from '@stellar/stellar-sdk';
import { findConversionPaths, type PathfindRequest } from '../services/crossAssetPaymentService.js';
import { Sep31TrackingService } from '../services/sep31TrackingService.js';
import { anchorInfoQuerySchema, initiateSep31Schema } from '../schemas/paymentSchema.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';

const STELLAR_ASSET_REGEX = /^(native|[A-Z0-9]{1,12}:G[A-Z2-7]{55})$/;

function isValidStellarAssetIdentifier(asset: unknown): asset is string {
  return typeof asset === 'string' && STELLAR_ASSET_REGEX.test(asset);
}

export class PaymentController {
  /**
   * GET /api/payments/anchor-info
   */
  static async getAnchorInfo(req: Request, res: Response) {
    const parsed = anchorInfoQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json(apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Validation Error', parsed.error.issues));
    }

    const { domain, protocol } = parsed.data;

    try {
      const info =
        protocol === 'sep24'
          ? await AnchorService.getSEP24Info(domain)
          : await AnchorService.getSEP31Info(domain);
      res.json(info);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/payments/sep31/initiate
   */
  static async initiateSEP31(req: Request, res: Response) {
    const parsed = initiateSep31Schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json(apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Validation Error', parsed.error.issues));
    }

    const { domain, paymentData, secretKey, senderPublicKey } = parsed.data;

    try {
      const clientKeypair = Keypair.fromSecret(secretKey);
      if (clientKeypair.publicKey() !== senderPublicKey) {
        return res.status(400).json({ error: 'senderPublicKey does not match secretKey' });
      }

      // 1. Authenticate
      const token = await AnchorService.authenticate(domain, clientKeypair);

      // 2. Initiate Payment
      const result = await AnchorService.initiatePayment(domain, token, paymentData);

      await Sep31TrackingService.recordInitiation({
        organizationId: req.user?.organizationId ?? null,
        senderPublicKey,
        anchorDomain: domain,
        requestPayload: paymentData,
        anchorResponse: result as Record<string, unknown>,
      });

      res.json(result);
    } catch (error: any) {
      console.error('SEP-31 Initiation Error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/payments/pathfind
   */
  static async findPaths(req: Request, res: Response) {
    const { fromAsset, toAsset, amount } = req.body as PathfindRequest;

    if (!fromAsset || !toAsset || !amount || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid pathfind request: fromAsset, toAsset, and positive amount required',
      });
    }

    if (
      !isValidStellarAssetIdentifier(fromAsset) ||
      !isValidStellarAssetIdentifier(toAsset)
    ) {
      return res.status(400).json({
        error:
          'Invalid asset identifier: assets must be "native" or "CODE:ISSUER" with a valid Stellar issuer account',
      });
    }

    try {
      const paths = await findConversionPaths({ fromAsset, toAsset, amount });
      res.json({ paths });
    } catch (error: any) {
      console.error('Pathfinding error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/payments/sep31/status/:domain/:id
   */
  static async getStatus(req: Request, res: Response) {
    const { domain, id } = req.params;
    const { secretKey } = req.query;

    if (!domain || !id || !secretKey) {
      return res.status(400).json({ error: 'Missing required params' });
    }

    try {
      const clientKeypair = Keypair.fromSecret(secretKey as string);
      // Re-auth to get a fresh token or use a session-based approach
      // For simplicity in this implementation, we re-auth
      const token = await AnchorService.authenticate(domain as string, clientKeypair);

      const status = await AnchorService.getTransaction(domain as string, token, id as string);
      await Sep31TrackingService.updateFromPoll(
        domain as string,
        id as string,
        status as Record<string, unknown>
      );
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/payments/sep24/withdraw/interactive
   */
  static async initiateSEP24Withdrawal(req: Request, res: Response) {
    const { domain, transactionData, secretKey, senderPublicKey, redirect } = req.body;

    if (!domain || !transactionData || !secretKey || !senderPublicKey) {
      return res.status(400).json({
        error: 'Missing required fields: domain, transactionData, secretKey, senderPublicKey',
      });
    }

    if (!transactionData.asset_code) {
      return res.status(400).json({ error: 'transactionData.asset_code is required' });
    }

    try {
      const clientKeypair = Keypair.fromSecret(secretKey);
      if (clientKeypair.publicKey() !== senderPublicKey) {
        return res.status(400).json({ error: 'senderPublicKey does not match secretKey' });
      }

      const token = await AnchorService.authenticate(domain, clientKeypair);
      const result = await AnchorService.initiateSEP24Withdrawal(domain, token, {
        account: senderPublicKey,
        ...transactionData,
      });

      const interactiveUrl = result.url || result.interactive_url;
      if (!interactiveUrl) {
        return res.status(502).json({ error: 'Anchor did not return an interactive URL' });
      }

      if (redirect) {
        return res.redirect(303, interactiveUrl);
      }

      return res.status(200).json({
        ...result,
        interactiveUrl,
      });
    } catch (error: any) {
      console.error('SEP-24 Withdrawal Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/payments/sep24/status/:domain/:id
   */
  static async getSEP24Status(req: Request, res: Response) {
    const { domain, id } = req.params;
    const { secretKey } = req.query;

    if (!domain || !id || !secretKey) {
      return res.status(400).json({ error: 'Missing required params' });
    }

    try {
      const clientKeypair = Keypair.fromSecret(secretKey as string);
      const token = await AnchorService.authenticate(domain as string, clientKeypair);
      const status = await AnchorService.getSEP24Transaction(domain as string, token, id as string);
      return res.json(status);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
