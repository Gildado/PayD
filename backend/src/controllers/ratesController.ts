import { Request, Response } from 'express';
import { convertOrgUsdAmount, getOrgUsdRates } from '../services/fxRateService.js';

const MAX_CONVERT_AMOUNT = 1e15;

export class RatesController {
  /**
   * GET /rates — ORGUSD→fiat conversion (ORGUSD ≡ USD), backed by live FX with Redis cache.
   */
  static async getRates(_req: Request, res: Response): Promise<void> {
    try {
      const data = await getOrgUsdRates();
      res.set('Cache-Control', 'public, max-age=60');
      res.json(data);
    } catch {
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'Unable to load exchange rates from upstream providers.',
      });
    }
  }

  /**
   * GET /rates/convert?amount=100&from=ORGUSD&to=KES
   */
  static async convert(req: Request, res: Response): Promise<void> {
    try {
      const amount = Number(req.query.amount);
      const from = String(req.query.from || 'ORGUSD');
      const to = String(req.query.to || '');

      if (!to) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Query parameter "to" is required.',
        });
        return;
      }

      if (!Number.isFinite(amount) || amount < 0 || amount > MAX_CONVERT_AMOUNT) {
        res.status(400).json({
          error: 'Bad Request',
          message: `Query parameter "amount" must be a non-negative number no greater than ${MAX_CONVERT_AMOUNT}.`,
        });
        return;
      }

      const data = await convertOrgUsdAmount(amount, from, to);
      res.set('Cache-Control', 'public, max-age=60');
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to convert amount.';
      const statusCode = message.startsWith('Unsupported') ? 400 : 502;
      res.status(statusCode).json({
        error: statusCode === 400 ? 'Bad Request' : 'Bad Gateway',
        message,
      });
    }
  }
}
