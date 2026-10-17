import { jest } from '@jest/globals';
import { PaymentQuarantineService } from '../paymentQuarantineService.js';

describe('PaymentQuarantineService (#1219)', () => {
  let service: PaymentQuarantineService;

  beforeEach(() => {
    service = new PaymentQuarantineService();
  });

  it('holds a payment', async () => {
    const entry = await service.hold('pay-1', 'org-1', 'large_amount', 'large_amount', 5000);
    expect(entry.status).toBe('held');
    expect(entry.paymentId).toBe('pay-1');
  });

  it('is idempotent for already-held payments', async () => {
    await service.hold('pay-1', 'org-1', 'reason', 'rule', 100);
    const entry = await service.hold('pay-1', 'org-1', 'different', 'rule', 200);
    expect(entry.reason).toBe('reason'); // original entry
  });

  it('releases a held payment', async () => {
    await service.hold('pay-1', 'org-1', 'reason', 'rule', 100);
    const entry = await service.release('pay-1', 'operator-1', 'verified');
    expect(entry.status).toBe('released');
    expect(entry.resolvedBy).toBe('operator-1');
  });

  it('rejects a held payment', async () => {
    await service.hold('pay-1', 'org-1', 'reason', 'rule', 100);
    const entry = await service.reject('pay-1', 'operator-1', 'fraud');
    expect(entry.status).toBe('rejected');
  });

  it('throws when releasing a non-existent payment', async () => {
    await expect(service.release('missing', 'op')).rejects.toThrow('not in quarantine');
  });

  it('throws when rejecting an already-released payment', async () => {
    await service.hold('pay-1', 'org-1', 'r', 'rule', 100);
    await service.release('pay-1', 'op');
    await expect(service.reject('pay-1', 'op')).rejects.toThrow('already');
  });

  it('lists held payments for an org', async () => {
    await service.hold('pay-1', 'org-1', 'r', 'rule', 100);
    await service.hold('pay-2', 'org-1', 'r', 'rule', 200);
    await service.hold('pay-3', 'org-2', 'r', 'rule', 300);
    const held = service.listHeld('org-1');
    expect(held).toHaveLength(2);
  });

  it('checks isHeld status', async () => {
    await service.hold('pay-1', 'org-1', 'r', 'rule', 100);
    expect(service.isHeld('pay-1')).toBe(true);
    await service.release('pay-1', 'op');
    expect(service.isHeld('pay-1')).toBe(false);
  });
});
