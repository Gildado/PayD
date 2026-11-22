import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed against Zod schema constraints',
            details: error.errors,
          },
          meta: {
            timestamp: new Date().toISOString(),
            traceId: req.headers['x-request-id'] || null,
          },
        });
      }
      next(error);
    }
  };
}

/**
 * Convenience middleware for validating request body only.
 * @deprecated Use validate(schema, 'body') instead
 */
export const validateBody = (schema: ZodSchema) => validate(schema, 'body');
