import { Request, Response } from "express";
import { AnchorService } from "../services/anchorService";
import { Keypair } from "@stellar/stellar-sdk";

export class PaymentController {
    /**
     * GET /api/payments/anchor-info
     */
    static async getAnchorInfo(req: Request, res: Response) {
        const { domain } = req.query;
        if (!domain) return res.status(400).json({ error: "Domain required" });

        try {
            const info = await AnchorService.getSEP31Info(domain as string);
            res.json(info);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * POST /api/payments/sep31/initiate
     */
    static async initiateSEP31(req: Request, res: Response) {
        const { domain, paymentData, secretKey } = req.body;

        if (!domain || !paymentData || !secretKey) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        try {
            const clientKeypair = Keypair.fromSecret(secretKey);

            // 1. Authenticate
            const token = await AnchorService.authenticate(domain, clientKeypair);

            // 2. Initiate Payment
            const result = await AnchorService.initiatePayment(domain, token, paymentData);

            res.json(result);
        } catch (error: any) {
            console.error("SEP-31 Initiation Error:", error);
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
            return res.status(400).json({ error: "Missing required params" });
        }

        try {
            const clientKeypair = Keypair.fromSecret(secretKey as string);
            // Re-auth to get a fresh token or use a session-based approach
            // For simplicity in this implementation, we re-auth
            const token = await AnchorService.authenticate(domain, clientKeypair);

            const status = await AnchorService.getTransaction(domain, token, id);
            res.json(status);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
