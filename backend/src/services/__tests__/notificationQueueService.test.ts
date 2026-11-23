import { notificationPriorityToBullMqPriority } from '../notificationQueueService.js';

describe('notificationPriorityToBullMqPriority', () => {
  it('orders high-priority alerts ahead of normal and low-priority jobs', () => {
    const high = notificationPriorityToBullMqPriority('high');
    const normal = notificationPriorityToBullMqPriority('normal');
    const low = notificationPriorityToBullMqPriority('low');

    expect(high).toBeLessThan(normal);
    expect(normal).toBeLessThan(low);
  });
});
