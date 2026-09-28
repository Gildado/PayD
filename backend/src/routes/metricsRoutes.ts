import { Router } from 'express';
import type { Request, Response } from 'express';
import { register } from '../utils/metrics.js';

const router = Router();

/**
 * GET /metrics
 * Exposes Prometheus-format metrics for scraping by Prometheus / Grafana.
 * Restrict to internal network in production (e.g. via nginx allow/deny or
 * a METRICS_TOKEN env var check).
 */
router.get('/', async (req: Request, res: Response) => {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const provided = req.headers['authorization']?.replace('Bearer ', '');
    if (provided !== token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(String(err));
  }
});

export default router;
