// src/workflows/notificationFallbackWorkflow.ts
import { Workflow, Step } from '@mastra/core';
import { NotificationQueueService } from '../services/notificationQueueService';
import { Logger } from '@nestjs/common';

const logger = new Logger('NotificationFallbackWorkflow');

// 1. Primary Channel Delivery Step
const sendPrimaryChannelStep = new Step({
  id: 'send-primary-channel',
  execute: async ({ context }) => {
    const { recipientId, payload, primaryChannel, secondaryChannel } = context.triggerData;
    logger.log(`Attempting delivery to user ${recipientId} via primary channel: ${primaryChannel}`);

    const notificationService = new NotificationQueueService();
    try {
      const result = await notificationService.dispatch({
        channel: primaryChannel,
        recipientId,
        payload,
      });

      if (!result.success) {
        throw new Error(`Primary channel (${primaryChannel}) delivery failed.`);
      }

      return { dispatchedVia: primaryChannel, success: true };
    } catch (error) {
      logger.warn(`Primary channel (${primaryChannel}) failed: ${error.message}. Initiating fallback to ${secondaryChannel}...`);
      return { primaryFailed: true, error: error.message, secondaryChannel, recipientId, payload };
    }
  },
  retryConfig: {
    attempts: 3,
    delay: 1000, // 1s backoff before fallback decision
  },
});

// 2. Secondary / Fallback Channel Step
const sendFallbackChannelStep = new Step({
  id: 'send-fallback-channel',
  execute: async ({ context }) => {
    const primaryStepOutput = context.steps['send-primary-channel'].output;

    // If primary succeeded, skip fallback
    if (primaryStepOutput.success) {
      return { dispatchedVia: primaryStepOutput.dispatchedVia, status: 'DELIVERED_PRIMARY' };
    }

    const { secondaryChannel, recipientId, payload } = primaryStepOutput;
    logger.log(`Executing fallback delivery to user ${recipientId} via secondary channel: ${secondaryChannel}`);

    const notificationService = new NotificationQueueService();
    const fallbackResult = await notificationService.dispatch({
      channel: secondaryChannel,
      recipientId,
      payload,
    });

    if (!fallbackResult.success) {
      throw new Error(`Both primary and fallback (${secondaryChannel}) notification channels failed.`);
    }

    logger.log(`Fallback notification successfully dispatched via ${secondaryChannel}`);
    return { dispatchedVia: secondaryChannel, status: 'DELIVERED_FALLBACK' };
  },
  retryConfig: {
    attempts: 2,
    delay: 2000,
  },
});

// Assemble the Workflow
export const notificationFallbackWorkflow = new Workflow({
  name: 'notification-channel-fallback-workflow',
  triggerSchema: {
    recipientId: 'string',
    payload: 'object',
    primaryChannel: 'string',
    secondaryChannel: 'string',
  },
});

notificationFallbackWorkflow
  .step(sendPrimaryChannelStep)
  .then(sendFallbackChannelStep);