import { Request, Response } from 'express';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { z } from 'zod';
import { MultiSigService } from '../services/multiSigService.js';
import logger from '../utils/logger.js';

const stellarPublicKeySchema = z
  .string()
  .refine((value) => StrKey.isValidEd25519PublicKey(value), {
    message: 'Each signer publicKey must be a valid Stellar public key.',
  });

const configureMultiSigSchema = z.object({
  issuerSecret: z
    .string()
    .min(1, 'issuerSecret is required.')
    .refine((value) => StrKey.isValidEd25519SecretSeed(value), {
      message: 'issuerSecret must be a valid Stellar secret seed.',
    }),
  signers: z
    .array(
      z.object({
        publicKey: stellarPublicKeySchema,
        weight: z.number().int().min(1).max(255),
      })
    )
    .min(1, 'At least one signer is required.'),
  thresholds: z.object({
    low: z.number().int().min(1).max(255),
    med: z.number().int().min(1).max(255),
    high: z.number().int().min(1).max(255),
    masterWeight: z.number().int().min(0).max(255),
  }),
});

export class MultiSigController {
  /**
   * POST /api/v1/multisig/configure
   * Full multi-sig setup for the issuer account.
   */
  static async configure(req: Request, res: Response): Promise<void> {
    try {
      const parsed = configureMultiSigSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.issues.map((issue) => issue.message).join(' '),
        });
        return;
      }

      const { issuerSecret, signers, thresholds } = parsed.data;
      const issuerKeypair = Keypair.fromSecret(issuerSecret);
      const result = await MultiSigService.configureIssuerMultiSig(
        issuerKeypair,
        signers,
        thresholds
      );

      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Multi-sig configuration failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/multisig/status/:publicKey
   * Get current signers and thresholds.
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { publicKey } = req.params;
      const status = await MultiSigService.getMultiSigStatus(publicKey as string);
      res.status(200).json({ success: true, data: status });
    } catch (error: any) {
      logger.error('Failed to get multi-sig status', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/v1/multisig/signers
   * Add a signer to the issuer account.
   */
  static async addSigner(req: Request, res: Response): Promise<void> {
    try {
      const { issuerSecret, signerPublicKey, weight } = req.body;

      if (!issuerSecret || !signerPublicKey || weight === undefined) {
        res.status(400).json({
          success: false,
          error: 'issuerSecret, signerPublicKey, and weight are required.',
        });
        return;
      }

      const issuerKeypair = Keypair.fromSecret(issuerSecret);
      const result = await MultiSigService.addIssuerSigner(issuerKeypair, signerPublicKey, weight);

      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Failed to add signer', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/v1/multisig/signers/:publicKey
   * Remove a signer from the issuer account.
   */
  static async removeSigner(req: Request, res: Response): Promise<void> {
    try {
      const { issuerSecret } = req.body;
      const { publicKey } = req.params;

      if (!issuerSecret) {
        res.status(400).json({
          success: false,
          error: 'issuerSecret is required in the request body.',
        });
        return;
      }

      const issuerKeypair = Keypair.fromSecret(issuerSecret);
      const result = await MultiSigService.removeIssuerSigner(issuerKeypair, publicKey as string);

      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Failed to remove signer', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/v1/multisig/thresholds
   * Update threshold configuration.
   */
  static async updateThresholds(req: Request, res: Response): Promise<void> {
    try {
      const { issuerSecret, thresholds } = req.body;

      if (!issuerSecret || !thresholds) {
        res.status(400).json({
          success: false,
          error: 'issuerSecret and thresholds are required.',
        });
        return;
      }

      const issuerKeypair = Keypair.fromSecret(issuerSecret);
      const result = await MultiSigService.updateThresholds(issuerKeypair, thresholds);

      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Failed to update thresholds', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
