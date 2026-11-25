/**
 * Body Size Limit Middleware
 * 
 * Provides configurable per-route body size limits with proper 413 responses.
 * Includes depth-limit guard to prevent deeply nested JSON attacks.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import express from 'express';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';
import logger from '../utils/logger.js';

/**
 * Maximum nesting depth for JSON objects to prevent stack overflow attacks
 */
const MAX_JSON_DEPTH = 10;

/**
 * Check JSON depth to prevent deeply nested object attacks
 */
function checkJsonDepth(obj: any, currentDepth = 0): boolean {
  if (currentDepth > MAX_JSON_DEPTH) {
    return false;
  }

  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (!checkJsonDepth(obj[key], currentDepth + 1)) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Middleware factory for per-route body size limits
 * 
 * @param limitBytes - Maximum body size in bytes
 * @param options - Additional options
 * @returns Express middleware chain
 */
export function bodySizeLimit(
  limitBytes: number,
  options: {
    checkDepth?: boolean;
    type?: string | string[];
  } = {}
): RequestHandler[] {
  const { checkDepth = true, type = 'application/json' } = options;

  const jsonParser = express.json({
    limit: limitBytes,
    type,
    verify: (req: any, _res, buf, encoding) => {
      // Store raw body for signature verification if needed
      req.rawBody = buf.toString(encoding as BufferEncoding || 'utf8');
    },
  });

  const depthChecker: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    if (!checkDepth) {
      return next();
    }

    try {
      if (req.body && !checkJsonDepth(req.body)) {
        logger.warn('Request rejected: JSON depth exceeds maximum', {
          path: req.path,
          method: req.method,
          maxDepth: MAX_JSON_DEPTH,
        });

        return res.status(413).json(
          apiErrorResponse(
            ErrorCodes.VALIDATION_ERROR,
            `Request rejected: JSON nesting depth exceeds maximum of ${MAX_JSON_DEPTH} levels`
          )
        );
      }
      next();
    } catch (error) {
      logger.error('Error checking JSON depth', { error, path: req.path });
      next(error);
    }
  };

  // Return array of middleware: parser, then depth checker
  return [
    jsonParser,
    depthChecker,
  ];
}

/**
 * Error handler for body size limit exceeded
 * Should be placed after routes that use bodySizeLimit
 */
export const bodySizeLimitErrorHandler: RequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err.type === 'entity.too.large') {
    logger.warn('Request rejected: body size limit exceeded', {
      path: req.path,
      method: req.method,
      contentLength: req.headers['content-length'],
    });

    return res.status(413).json(
      apiErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Request body size exceeds maximum allowed limit'
      )
    );
  }

  // Pass other errors to next handler
  next(err);
};

/**
 * Default body size limits for common use cases
 */
export const BodySizeLimits = {
  /** Standard API requests - 100KB */
  STANDARD: 100 * 1024,
  
  /** Bulk operations - 1MB */
  BULK: 1024 * 1024,
  
  /** Large imports/exports - 5MB */
  LARGE: 5 * 1024 * 1024,
  
  /** CSV uploads - 10MB */
  CSV: 10 * 1024 * 1024,
} as const;
