import crypto from 'crypto';
import { config } from '../config/env.js';

/**
 * Payload structure for the export download token.
 * Supports either single receipt or full payroll batch exports.
 */
export type ExportTokenPayload =
  | { 
      /** Discriminator for receipt export. */
      kind: 'receipt'; 
      /** The transaction hash associated with the receipt. */
      txHash: string; 
      /** Expiration timestamp in seconds. */
      exp: number 
    }
  | {
      /** Discriminator for payroll export. */
      kind: 'payroll';
      /** The public key of the organization owning the payroll. */
      organizationPublicKey: string;
      /** The unique identifier of the payroll batch. */
      batchId: string;
      /** Expiration timestamp in seconds. */
      exp: number;
    };

/**
 * Internal helper - Signs a payload segment with HMAC-SHA256.
 * Not intended for direct use.
 *
 * @param segment - Payload segment to sign
 * @returns Base64url-encoded signature
 */
function signSegment(segment: string): string {
  return crypto.createHmac('sha256', config.JWT_SECRET).update(segment).digest('base64url');
}

/**
 * Creates a secure, time-limited download token for export files.
 * Token format: base64url(payload).base64url(signature)
 * Uses HMAC-SHA256 with JWT_SECRET for signing.
 *
 * @param payload - Token payload containing kind, data, and expiration timestamp
 * @returns Opaque token string for download authorization
 */
export function createExportDownloadToken(payload: ExportTokenPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signSegment(payloadB64);
  return `${payloadB64}.${sig}`;
}

/**
 * Verifies and parses an export download token.
 * Validates signature, expiration, and payload structure.
 *
 * @param token - Download token string (base64url(payload).signature)
 * @returns Decoded payload if valid and not expired, null otherwise
 */
export function verifyExportDownloadToken(token: string): ExportTokenPayload | null {
  try {
    const dot = token.indexOf('.');
    if (dot <= 0) return null;
    const payloadB64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (signSegment(payloadB64) !== sig) return null;
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as ExportTokenPayload;
    if (!payload || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.kind === 'receipt' && typeof payload.txHash === 'string') return payload;
    if (
      payload.kind === 'payroll' &&
      typeof payload.organizationPublicKey === 'string' &&
      typeof payload.batchId === 'string'
    ) {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}
