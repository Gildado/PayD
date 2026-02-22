import { Router } from "express";
import { AssetController } from "../controllers/assetController";

const router = Router();

// In a real app, these should be protected by admin auth middleware
router.post("/issue", AssetController.issueOrgUsd);
router.post("/clawback", AssetController.clawback);

export default router;
