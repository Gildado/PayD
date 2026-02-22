import { Request, Response } from "express";
import { z } from "zod";
import { TrustlineService } from "../services/trustlineService";

const checkTrustlineSchema = z.object({
  assetIssuer: z.string().length(56),
});

const promptTrustlineSchema = z.object({
  employeeId: z.number().int().positive(),
  walletAddress: z.string().length(56),
  assetIssuer: z.string().length(56),
});

export class TrustlineController {
  /**
   * GET /api/trustlines/check/:walletAddress
   * Detect ORGUSD trustline status for any wallet via Horizon.
   */
  static async checkWallet(req: Request, res: Response) {
    try {
      const { walletAddress } = req.params;
      const { assetIssuer } = checkTrustlineSchema.parse(req.query);

      const result = await TrustlineService.checkTrustline(
        walletAddress,
        "ORGUSD",
        assetIssuer
      );

      res.json({
        walletAddress,
        assetCode: "ORGUSD",
        assetIssuer,
        trustlineEstablished: result.exists,
        balance: result.balance || null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation Error", details: error.errors });
      }
      console.error("Check Trustline Error:", error);
      res.status(500).json({ error: "Failed to check trustline status." });
    }
  }

  /**
   * GET /api/trustlines/employees/:employeeId
   * Get stored trustline status for an employee.
   */
  static async getEmployeeStatus(req: Request, res: Response) {
    try {
      const employeeId = parseInt(req.params.employeeId);
      if (isNaN(employeeId)) {
        return res.status(400).json({ error: "Invalid employee ID." });
      }

      const record = await TrustlineService.getEmployeeTrustline(employeeId);
      if (!record) {
        return res.json({ employeeId, status: "unknown", message: "No trustline record found. Run a refresh." });
      }

      res.json(record);
    } catch (error) {
      console.error("Get Employee Trustline Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  /**
   * POST /api/trustlines/employees/:employeeId/refresh
   * Re-check Horizon and update the DB for an employee.
   */
  static async refreshEmployee(req: Request, res: Response) {
    try {
      const employeeId = parseInt(req.params.employeeId);
      if (isNaN(employeeId)) {
        return res.status(400).json({ error: "Invalid employee ID." });
      }

      const { assetIssuer } = checkTrustlineSchema.parse(req.body);

      const record = await TrustlineService.refreshEmployeeTrustline(
        employeeId,
        assetIssuer
      );

      if (!record) {
        return res.status(404).json({ error: "Employee not found or has no wallet address." });
      }

      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation Error", details: error.errors });
      }
      console.error("Refresh Trustline Error:", error);
      res.status(500).json({ error: "Failed to refresh trustline status." });
    }
  }

  /**
   * POST /api/trustlines/prompt
   * Build an unsigned changeTrust XDR for the employee to sign,
   * and mark their trustline as pending.
   */
  static async promptTrustline(req: Request, res: Response) {
    try {
      const { employeeId, walletAddress, assetIssuer } =
        promptTrustlineSchema.parse(req.body);

      const xdr = await TrustlineService.buildTrustlineTransaction(
        walletAddress,
        "ORGUSD",
        assetIssuer
      );

      await TrustlineService.markPending(employeeId, walletAddress, assetIssuer);

      res.json({
        xdr,
        message: "Sign this transaction to establish your ORGUSD trustline.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation Error", details: error.errors });
      }
      console.error("Prompt Trustline Error:", error);
      res.status(500).json({ error: "Failed to build trustline transaction." });
    }
  }
}
