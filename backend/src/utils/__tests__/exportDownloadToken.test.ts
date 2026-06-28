import { jest } from '@jest/globals';
import { createExportDownloadToken, verifyExportDownloadToken } from '../exportDownloadToken.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

const FUTURE = Math.floor(Date.now() / 1000) + 3600; // 1 hour ahead
const PAST   = Math.floor(Date.now() / 1000) - 1;    // already expired

const RECEIPT_PAYLOAD = { kind: 'receipt' as const, txHash: 'abc123', exp: FUTURE };
const PAYROLL_PAYLOAD = {
  kind: 'payroll' as const,
  organizationPublicKey: 'GPUBKEY123',
  batchId: 'BATCH-001',
  exp: FUTURE,
};

// ─── createExportDownloadToken ────────────────────────────────────────────────

describe('createExportDownloadToken', () => {
  it('returns a non-empty string token', () => {
    const token = createExportDownloadToken(RECEIPT_PAYLOAD);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('token contains exactly one dot separator', () => {
    const token = createExportDownloadToken(RECEIPT_PAYLOAD);
    const dots = token.split('.').length - 1;
    expect(dots).toBe(1);
  });

  it('produces different tokens for different payloads', () => {
    const t1 = createExportDownloadToken(RECEIPT_PAYLOAD);
    const t2 = createExportDownloadToken(PAYROLL_PAYLOAD);
    expect(t1).not.toBe(t2);
  });
});

// ─── verifyExportDownloadToken ────────────────────────────────────────────────

describe('verifyExportDownloadToken', () => {
  it('round-trips a receipt token correctly', () => {
    const token = createExportDownloadToken(RECEIPT_PAYLOAD);
    const result = verifyExportDownloadToken(token);
    expect(result).toEqual(RECEIPT_PAYLOAD);
  });

  it('round-trips a payroll token correctly', () => {
    const token = createExportDownloadToken(PAYROLL_PAYLOAD);
    const result = verifyExportDownloadToken(token);
    expect(result).toEqual(PAYROLL_PAYLOAD);
  });

  it('returns null for an expired receipt token', () => {
    const expired = createExportDownloadToken({ ...RECEIPT_PAYLOAD, exp: PAST });
    expect(verifyExportDownloadToken(expired)).toBeNull();
  });

  it('returns null for an expired payroll token', () => {
    const expired = createExportDownloadToken({ ...PAYROLL_PAYLOAD, exp: PAST });
    expect(verifyExportDownloadToken(expired)).toBeNull();
  });

  it('returns null when the signature is tampered with', () => {
    const token = createExportDownloadToken(RECEIPT_PAYLOAD);
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(verifyExportDownloadToken(tampered)).toBeNull();
  });

  it('returns null when the payload is tampered with', () => {
    const token = createExportDownloadToken(RECEIPT_PAYLOAD);
    const [payloadB64, sig] = token.split('.');
    // Mutate one character of the payload portion
    const mutated = payloadB64.slice(0, -1) + (payloadB64.endsWith('A') ? 'B' : 'A');
    expect(verifyExportDownloadToken(`${mutated}.${sig}`)).toBeNull();
  });

  it('returns null for a token with no dot separator', () => {
    expect(verifyExportDownloadToken('nodotinhere')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(verifyExportDownloadToken('')).toBeNull();
  });

  it('returns null for completely invalid garbage', () => {
    expect(verifyExportDownloadToken('not.a.valid.token')).toBeNull();
  });
});
