import { Router, Request, Response, NextFunction } from 'express';
import { webhookNotificationService } from '../services/webhookNotificationService.js';
import logger from '../utils/logger.js';
import { z } from 'zod';

import authenticateJWT from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';

const router = Router();

// Secure all routes
router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER'));
router.use(isolateOrganization);

// Alias for frontend compatibility
router.get('/logs', (req, res, next) => {
  // Transfer to delivery-logs
  req.url = '/delivery-logs';
  next('route');
});

const createSubscriptionSchema = z.object({
  url: z.string().url('Invalid URL format'),
  secret: z.string().min(16, 'Secret must be at least 16 characters'),
  events: z.array(z.string()).min(1, 'At least one event type is required'),
  description: z.string().optional(),
});

const updateSubscriptionSchema = z.object({
  url: z.string().url('Invalid URL format').optional(),
  events: z.array(z.string()).min(1, 'At least one event type is required').optional(),
  isActive: z.boolean().optional(),
  description: z.string().nullable().optional(),
});

const testEndpointSchema = z.object({
  url: z.string().url('Invalid URL format'),
  secret: z.string().min(16, 'Secret must be at least 16 characters'),
  eventType: z.string().optional(),
});

const triggerEventSchema = z.object({
  eventType: z.string(),
  payload: z.record(z.any()),
});

async function requireOrganizationId(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = req.query.organizationId || req.body.organizationId;

    if (!orgId) {
      res.status(400).json({
        success: false,
        error: 'organizationId is required',
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}

router.get(
  '/event-types',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventTypes = await webhookNotificationService.getEventTypes();
      res.json({ success: true, data: eventTypes });
    } catch (error) {
      logger.error('Failed to get event types', { error });
      next(error);
    }
  }
);

router.post(
  '/subscriptions',
  requireOrganizationId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = req.body;
      const validatedData = createSubscriptionSchema.parse(req.body);

      const subscription = await webhookNotificationService.createSubscription({
        organizationId,
        ...validatedData,
      });

      logger.info('Webhook subscription created via API', {
        subscriptionId: subscription.id,
        organizationId,
      });

      res.status(201).json({
        success: true,
        data: {
          id: subscription.id,
          url: subscription.url,
          events: subscription.events,
          isActive: subscription.isActive,
          description: subscription.description,
          createdAt: subscription.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.issues,
        });
        return;
      }
      logger.error('Failed to create webhook subscription', { error });
      next(error);
    }
  }
);

router.get(
  '/subscriptions',
  requireOrganizationId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = parseInt(req.query.organizationId as string, 10);
      const subscriptions = await webhookNotificationService.getSubscriptions(organizationId);

      const sanitizedSubscriptions = subscriptions.map((sub) => ({
        id: sub.id,
        url: sub.url,
        events: sub.events,
        isActive: sub.isActive,
        description: sub.description,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      }));

      res.json({ success: true, data: sanitizedSubscriptions });
    } catch (error) {
      logger.error('Failed to get webhook subscriptions', { error });
      next(error);
    }
  }
);

router.get(
  '/subscriptions/:id',
  requireOrganizationId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = parseInt(req.query.organizationId as string, 10);
      const subscriptionId = parseInt(req.params.id, 10);

      const subscription = await webhookNotificationService.getSubscriptionById(
        subscriptionId,
        organizationId
      );

      if (!subscription) {
        res.status(404).json({
          success: false,
          error: 'Subscription not found',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: subscription.id,
          url: subscription.url,
          events: subscription.events,
          isActive: subscription.isActive,
          description: subscription.description,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Failed to get webhook subscription', { error });
      next(error);
    }
  }
);

router.patch(
  '/subscriptions/:id',
  requireOrganizationId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = parseInt(req.query.organizationId as string, 10);
      const subscriptionId = parseInt(req.params.id, 10);
      const validatedData = updateSubscriptionSchema.parse(req.body);

      const subscription = await webhookNotificationService.updateSubscription(
        subscriptionId,
        organizationId,
        validatedData
      );

      if (!subscription) {
        res.status(404).json({
          success: false,
          error: 'Subscription not found',
        });
        return;
      }

      logger.info('Webhook subscription updated via API', {
        subscriptionId,
        organizationId,
      });

      res.json({
        success: true,
        data: {
          id: subscription.id,
          url: subscription.url,
          events: subscription.events,
          isActive: subscription.isActive,
          description: subscription.description,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.issues,
        });
        return;
      }
      logger.error('Failed to update webhook subscription', { error });
      next(error);
    }
  }
);

router.delete(
  '/subscriptions/:id',
  requireOrganizationId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = parseInt(req.query.organizationId as string, 10);
      const subscriptionId = parseInt(req.params.id, 10);

      const deleted = await webhookNotificationService.deleteSubscription(
        subscriptionId,
        organizationId
      );

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Subscription not found',
        });
        return;
      }

      logger.info('Webhook subscription deleted via API', {
        subscriptionId,
        organizationId,
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete webhook subscription', { error });
      next(error);
    }
  }
);

router.get(
  '/delivery-logs',
  requireOrganizationId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = parseInt(req.query.organizationId as string, 10);
      const subscriptionId = req.query.subscriptionId
        ? parseInt(req.query.subscriptionId as string, 10)
        : undefined;
      const status = req.query.status as 'pending' | 'success' | 'failed' | 'retrying' | undefined;
      const eventType = req.query.eventType as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const { data, total } = await webhookNotificationService.getDeliveryLogs(organizationId, {
        subscriptionId,
        status,
        eventType,
        limit,
        offset,
      });

      res.json({
        success: true,
        data,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      logger.error('Failed to get delivery logs', { error });
      next(error);
    }
  }
);

router.get(
  '/delivery-stats',
  requireOrganizationId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = parseInt(req.query.organizationId as string, 10);
      const stats = await webhookNotificationService.getDeliveryStats(organizationId);

      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Failed to get delivery stats', { error });
      next(error);
    }
  }
);

router.post(
  '/test-endpoint',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = testEndpointSchema.parse(req.body);

      const result = await webhookNotificationService.testEndpoint(
        validatedData.url,
        validatedData.secret,
        validatedData.eventType
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            statusCode: result.statusCode,
            latencyMs: result.latencyMs,
            message: 'Webhook endpoint responded successfully',
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          data: {
            statusCode: result.statusCode,
            latencyMs: result.latencyMs,
          },
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.issues,
        });
        return;
      }
      logger.error('Failed to test webhook endpoint', { error });
      next(error);
    }
  }
);

router.post('/trigger', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { organizationId } = req.body;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'organizationId is required',
      });
      return;
    }

    const validatedData = triggerEventSchema.parse(req.body);

    await webhookNotificationService.dispatch(
      validatedData.eventType,
      validatedData.payload,
      organizationId
    );

    logger.info('Manual webhook event triggered', {
      eventType: validatedData.eventType,
      organizationId,
    });

    res.json({
      success: true,
      message: `Event '${validatedData.eventType}' dispatched successfully`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.issues,
      });
      return;
    }
    logger.error('Failed to trigger webhook event', { error });
    next(error);
  }
});

router.post(
  '/process-retries',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const processedCount = await webhookNotificationService.processPendingRetries();

      res.json({
        success: true,
        data: {
          processedCount,
          message: `Processed ${processedCount} pending webhook retries`,
        },
      });
    } catch (error) {
      logger.error('Failed to process webhook retries', { error });
      next(error);
    }
  }
);

export default router;
