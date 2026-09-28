import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticateJWT } from './auth.js';
import { config } from '../config/env.js';
import { verifyExportDownloadToken } from '../utils/exportDownloadToken.js';
import { payrollQueryService } from '../services/payroll-query.service.js';

const pool = new Pool({ connectionString: config.DATABASE_URL });

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

export function exportDownloadAuth(kind: 'receipt' | 'payroll') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (token) {
      const payload = verifyExportDownloadToken(token);
      if (!payload) {
        res.status(401).json({ error: 'Invalid or expired download token' });
        return;
      }
      if (kind === 'receipt' && payload.kind === 'receipt' && exportReceiptTokenOk(req, payload)) {
        next();
        return;
      }
      if (kind === 'payroll' && payload.kind === 'payroll' && exportPayrollTokenOk(req, payload)) {
        next();
        return;
      }
      res.status(403).json({ error: 'Download token does not match this resource' });
      return;
    }

    authenticateJWT(req, res, async () => {
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
      } catch {
        res.status(500).json({ error: 'Failed to verify transaction ownership' });
      }
    });
  };
}
