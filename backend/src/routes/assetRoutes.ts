import { Router } from "express";
import { AssetController } from "../controllers/assetController";
import { authenticateJWT } from "../middlewares/auth";
import { authorizeRoles } from "../middlewares/rbac";

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER'));

router.post("/issue", AssetController.issueOrgUsd);
router.post("/clawback", AssetController.clawback);

export default router;
