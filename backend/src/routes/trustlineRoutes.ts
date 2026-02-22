import { Router } from "express";
import { TrustlineController } from "../controllers/trustlineController";

const router = Router();

/**
 * @route GET /api/trustlines/check/:walletAddress?assetIssuer=G...
 * @desc Detect ORGUSD trustline status for any wallet via Horizon
 */
router.get("/check/:walletAddress", TrustlineController.checkWallet);

/**
 * @route GET /api/trustlines/employees/:employeeId
 * @desc Get stored trustline status for an employee
 */
router.get("/employees/:employeeId", TrustlineController.getEmployeeStatus);

/**
 * @route POST /api/trustlines/employees/:employeeId/refresh
 * @desc Re-check Horizon and update trustline status in DB
 * @body { assetIssuer: string }
 */
router.post("/employees/:employeeId/refresh", TrustlineController.refreshEmployee);

/**
 * @route POST /api/trustlines/prompt
 * @desc Build unsigned changeTrust XDR for employee to sign
 * @body { employeeId: number, walletAddress: string, assetIssuer: string }
 */
router.post("/prompt", TrustlineController.promptTrustline);

export default router;
