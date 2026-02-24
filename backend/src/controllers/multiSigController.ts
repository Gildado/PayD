import { Request, Response } from 'express';
import { Keypair } from '@stellar/stellar-sdk';
import { MultiSigService } from '../services/multiSigService';
import logger from '../utils/logger';

export class MultiSigController {
    /**
     * POST /api/v1/multisig/configure
     * Full multi-sig setup for the issuer account.
     */
    static async configure(req: Request, res: Response): Promise<void> {
        try {
            const { issuerSecret, signers, thresholds } = req.body;

            if (!issuerSecret || !signers || !thresholds) {
                res.status(400).json({
                    success: false,
                    error: 'issuerSecret, signers, and thresholds are required.',
                });
                return;
            }

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
            const status = await MultiSigService.getMultiSigStatus(publicKey);
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
            const result = await MultiSigService.addIssuerSigner(
                issuerKeypair,
                signerPublicKey,
                weight
            );

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
            const result = await MultiSigService.removeIssuerSigner(issuerKeypair, publicKey);

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
