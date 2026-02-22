import { Request, Response } from "express";
import { z } from "zod";
import { TransactionAuditService } from "../services/transactionAuditService";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sourceAccount: z.string().length(56).optional(),
});

export class TransactionAuditController {
  /**
   * POST /api/audit/:txHash
   * Fetch a transaction from Horizon and store an immutable audit record.
   */
  static async createAuditRecord(req: Request, res: Response) {
    try {
      const { txHash } = req.params;
      if (!txHash || txHash.length !== 64) {
        return res.status(400).json({ error: "Invalid transaction hash." });
      }

      const record = await TransactionAuditService.fetchAndStore(txHash);
      res.status(201).json(record);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return res.status(404).json({ error: "Transaction not found on Horizon." });
      }
      console.error("Create Audit Record Error:", error);
      res.status(500).json({ error: "Failed to fetch and store transaction." });
    }
  }

  /**
   * GET /api/audit/:txHash
   * Get a stored audit record by hash.
   */
  static async getAuditRecord(req: Request, res: Response) {
    try {
      const { txHash } = req.params;
      const record = await TransactionAuditService.getByHash(txHash);

      if (!record) {
        return res.status(404).json({ error: "Audit record not found." });
      }

      res.json(record);
    } catch (error) {
      console.error("Get Audit Record Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  /**
   * GET /api/audit
   * List audit records with pagination and optional source filter.
   */
  static async listAuditRecords(req: Request, res: Response) {
    try {
      const { page, limit, sourceAccount } = listQuerySchema.parse(req.query);
      const result = await TransactionAuditService.list(page, limit, sourceAccount);

      res.json({
        data: result.data,
        total: result.total,
        page,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation Error", details: error.errors });
      }
      console.error("List Audit Records Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  /**
   * GET /api/audit/:txHash/verify
   * Re-fetch from Horizon and compare with stored record for integrity check.
   */
  static async verifyAuditRecord(req: Request, res: Response) {
    try {
      const { txHash } = req.params;
      const { verified, record } = await TransactionAuditService.verify(txHash);

      if (!record) {
        return res.status(404).json({ error: "Audit record not found. Store it first." });
      }

      res.json({ txHash, verified, record });
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return res.status(404).json({ error: "Transaction not found on Horizon." });
      }
      console.error("Verify Audit Record Error:", error);
      res.status(500).json({ error: "Failed to verify transaction." });
    }
  }
}
