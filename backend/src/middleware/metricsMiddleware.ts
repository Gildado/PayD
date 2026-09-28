import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime();
  
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = diff[0] * 1e3 + diff[1] * 1e-6;
    
    logger.info('Request Performance Metrics', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: durationMs.toFixed(3),
      contentLength: res.get('Content-Length') || 0,
      userAgent: req.get('User-Agent') || 'unknown',
    });
    
    // Track slow queries/requests
    if (durationMs > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.originalUrl,
        durationMs: durationMs.toFixed(3),
      });
    }
  });

  next();
};
