import { Router } from "express";
import { PaymentController } from "../controllers/paymentController";
import { require2FA } from "../middlewares/require2fa";
import { authenticateJWT } from "../middlewares/auth";
import { isolateOrganization } from "../middlewares/rbac";

const router = Router();

router.use(authenticateJWT);

router.get("/anchor-info", PaymentController.getAnchorInfo);
router.post("/sep31/initiate", isolateOrganization, require2FA, PaymentController.initiateSEP31);
router.get("/sep31/status/:domain/:id", PaymentController.getStatus);

export default router;
