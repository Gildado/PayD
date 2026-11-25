import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticateJWT } from './auth.js';
import { config } from '../config/env.js';
import { verifyExportDownloadToken } from '../utils/exportDownloadToken.js';
import { payrollQueryService } from '../services/payroll-query.service.js';
import logger from '../utils/logger.js';

const pool = new Pool({ connectionString: config.DATABASE_URL });

/**
 * Single-use registry for signed download URLs. Entries are keyed by a digest
 * of the opaque token (never the raw token) and evicted once their `exp` has
 * passed, so the registry cannot grow without bound.
 */
const consumedTokens = new Map<string, number>(); // digest -> exp (seconds)

function tokenDigest(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function pruneConsumed(now: number): void {
  for (const [digest, exp] of consumedTokens) {
    if (exp < now) consumedTokens.delete(digest);
  }
}

export function isDownloadTokenConsumed(token: string, now = Math.floor(Date.now() / 1000)): boolean {
  const exp = consumedTokens.get(tokenDigest(token));
  if (exp === undefined) return false;
  if (exp < now) {
    pruneConsumed(now);
    return false;
  }
  return true;
}

export function markDownloadTokenConsumed(token: string, exp: number): void {
  pruneConsumed(Math.floor(Date.now() / 1000));
  consumedTokens.set(tokenDigest(token), exp);
}

/** Test-only helper to reset the in-memory single-use registry. */
export function clearConsumedDownloadTokens(): void {
  consumedTokens.clear();
}

async function orgPublicKeyForUser(organizationId: number | null): Promise<string | null> {
  if (organizationId == null) return null;
  const r = await pool.query('SELECT public_key FROM organizations WHERE id = $1', [
    organizationId,
  ]);
  return r.rows[0]?.public_key ?? null;
}

function exportReceiptTokenOk(req: Request, payload: { kind: 'receipt'; txHash: string }): boolean {
  return payload.txHash === req.params.txHash;
}

function exportPayrollTokenOk(
  req: Request,
  payload: { kind: 'payroll'; organizationPublicKey: string; batchId: string }
): boolean {
  return (
    payload.organizationPublicKey === req.params.organizationPublicKey &&
    payload.batchId === req.params.batchId
  );
}

async function authorize(
  req: Request,
  res: Response,
  next: NextFunction,
  kind: 'receipt' | 'payroll'
): Promise<void> {
  const token = typeof req.query.token === 'string' ? req.query.token : undefined;

  if (token) {
    const payload = verifyExportDownloadToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired download token' });
      return;
    }

    // The token is bound to the user who requested the export. A valid token
    // presented by anybody else must not grant access.
    if (payload.userId === undefined || payload.userId !== req.user?.id) {
      res.status(403).json({ error: 'Download token is bound to a different user' });
      return;
    }

    const resourceMatches =
      (kind === 'receipt' && payload.kind === 'receipt' && exportReceiptTokenOk(req, payload)) ||
      (kind === 'payroll' &&
        payload.kind === 'payroll' &&
        exportPayrollTokenOk(req, payload));

    if (!resourceMatches) {
      res.status(403).json({ error: 'Download token does not match this resource' });
      return;
    }

    // Expiry is already enforced by verifyExportDownloadToken; single-use is
    // enforced here so a leaked URL cannot be replayed.
    if (isDownloadTokenConsumed(token)) {
      res.status(401).json({ error: 'Download token has already been used' });
      return;
    }
    markDownloadTokenConsumed(token, payload.exp);
    next();
    return;
  }

  const orgPk = await orgPublicKeyForUser(req.user?.organizationId ?? null);
  if (!orgPk) {
    res.status(403).json({ error: 'Organization not found for user' });
    return;
  }
  if (kind === 'payroll') {
    if (req.params.organizationPublicKey !== orgPk) {
      res.status(403).json({ error: 'Cannot export another organization payroll data' });
      return;
    }
    next();
    return;
  }
  try {
    const tx = await payrollQueryService.getTransactionDetails(req.params.txHash as string);
    if (!tx || tx.sourceAccount !== orgPk) {
      res.status(403).json({ error: 'Cannot export receipt for this transaction' });
      return;
    }
    next();
  } catch (error) {
    logger.error({ error }, '[exportDownloadAuth] failed to verify transaction ownership');
    res.status(500).json({ error: 'Failed to verify transaction ownership' });
  }
}

/**
 * Protects export downloads either with a signed, single-use, user-bound token
 * or with an authenticated session plus organization ownership checks.
 */
export function exportDownloadAuth(kind: 'receipt' | 'payroll') {
  return (req: Request, res: Response, next: NextFunction): void => {
    authenticateJWT(req, res, () => {
      void authorize(req, res, next, kind).catch((error) => {
        logger.error({ error }, '[exportDownloadAuth] authorization failed');
        if (!res.headersSent) res.status(500).json({ error: 'Download authorization failed' });
      });
    });
  };
}
