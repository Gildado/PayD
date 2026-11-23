import { Request, Response } from 'express';
import { AssetService } from '../services/assetService.js';
import { Keypair } from '@stellar/stellar-sdk';
import logger from '../utils/logger.js';

export class AssetController {
  /**
   * POST /api/assets/orgusd/issue
   * Issues ORGUSD asset with auth_clawback_enabled flag.
   */
  static async issueOrgUsd(req: Request, res: Response) {
    const { issuerSecret, distributorSecret, amount } = req.body;

    if (!issuerSecret || !distributorSecret || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const issuerKeypair = Keypair.fromSecret(issuerSecret);
      const distributorKeypair = Keypair.fromSecret(distributorSecret);

      const asset = await AssetService.issueOrgUsdAsset(issuerKeypair, distributorKeypair, amount);

      res.json({
        success: true,
        asset: {
          code: asset.code,
          issuer: asset.issuer,
        },
      });
    } catch (error: any) {
      logger.error('Failed to issue ORGUSD', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/assets/orgusd/clawback
   * Executes a clawback operation.
   */
  static async clawback(req: Request, res: Response) {
    const { issuerSecret, fromAccount, amount, reason } = req.body;

    if (!issuerSecret || !fromAccount || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const issuerKeypair = Keypair.fromSecret(issuerSecret);

      const txHash = await AssetService.clawbackAsset(issuerKeypair, fromAccount, amount, reason);

      res.json({
        success: true,
        txHash,
        message: `Successfully clawed back ${amount} ORGUSD from ${fromAccount}`,
      });
    } catch (error: any) {
      logger.error('Failed to clawback asset', error);
      res.status(500).json({ error: error.message });
    }
  }
}
