import { Router } from "express";
import { TransactionAuditController } from "../controllers/transactionAuditController";

const router = Router();

/**
 * @route GET /api/audit
 * @desc List audit records with pagination
 * @query page, limit, sourceAccount
 */
router.get("/", TransactionAuditController.listAuditRecords);

/**
 * @route GET /api/audit/:txHash
 * @desc Get a stored audit record by transaction hash
 */
router.get("/:txHash", TransactionAuditController.getAuditRecord);

/**
 * @route GET /api/audit/:txHash/verify
 * @desc Re-fetch from Horizon and verify integrity of stored record
 */
router.get("/:txHash/verify", TransactionAuditController.verifyAuditRecord);

/**
 * @route POST /api/audit/:txHash
 * @desc Fetch transaction from Horizon and create immutable audit record
 */
router.post("/:txHash", TransactionAuditController.createAuditRecord);

export default router;
