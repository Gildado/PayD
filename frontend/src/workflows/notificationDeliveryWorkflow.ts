import { Workflow, Step } from '@mastra/core';
import { notificationQueueService } from '../services/notificationQueueService';
import { notificationService } from '../services/notificationService';
import { Logger } from '@nestjs/common';

const logger = new Logger('NotificationDeliveryWorkflow');

// Step 1: Enqueue and validate notification payload
const queueNotificationStep = new Step({
  id: 'queueNotification',
  execute: async ({ inputData }) => {
    logger.log(`Queuing notification for recipient: ${inputData.recipientId}, channel: ${inputData.channel}`);
    const queuedItem = await notificationQueueService.enqueue({
      recipientId: inputData.recipientId,
      channel: inputData.channel,
      payload: inputData.payload,
    });

    if (!queuedItem || !queuedItem.queueId) {
      throw new Error(`Notification queuing failed for recipient ${inputData.recipientId}`);
    }

    return { ...inputData, queueId: queuedItem.queueId };
  },
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
});

// Step 2: Dispatch notification across channels and confirm delivery
const dispatchNotificationStep = new Step({
  id: 'dispatchNotification',
  execute: async ({ inputData }) => {
    logger.log(`Dispatching notification from queue ID: ${inputData.queueId}`);
    const dispatchResult = await notificationService.send({
      queueId: inputData.queueId,
      recipientId: inputData.recipientId,
      channel: inputData.channel,
      payload: inputData.payload,
    });

    if (!dispatchResult || !dispatchResult.delivered) {
      throw new Error(`Notification delivery failed across channel ${inputData.channel}`);
    }

    return { success: true, queueId: inputData.queueId, dispatchResult };
  },
  retryConfig: {
    attempts: 3,
    delay: 2000,
  },
});

// Assemble the Mastra Workflow
export const notificationDeliveryWorkflow = new Workflow({
  name: 'notification-delivery-orchestration',
  steps: [queueNotificationStep, dispatchNotificationStep],
});

notificationDeliveryWorkflow
  .then(queueNotificationStep)
  .then(dispatchNotificationStep);