import { Router } from "express";
import { WebhookController } from "../controllers/webhook.controller.js";

const router = Router();

router.post("/subscribe", WebhookController.subscribe);
router.get("/subscriptions", WebhookController.listSubscriptions);
router.delete("/subscriptions/:id", WebhookController.deleteSubscription);
router.post("/test-trigger", WebhookController.triggerMockEvent);

export default router;
