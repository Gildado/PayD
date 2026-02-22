import { Router } from "express";
import { PaymentController } from "../controllers/paymentController";
import { require2FA } from "../middlewares/require2fa";

const router = Router();

router.get("/anchor-info", PaymentController.getAnchorInfo);
router.post("/sep31/initiate", require2FA, PaymentController.initiateSEP31);
router.get("/sep31/status/:domain/:id", PaymentController.getStatus);

export default router;
