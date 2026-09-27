// backend/src/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZSchema } from 'zod';

export const validateBody = (schema: z.ZodSchema) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            req.body = await schema.parseAsync(req.body);
            next();
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Request body validation failed against Zod schema constraints',
                    details: error.errors || error.message,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    traceId: req.headers['x-request-id'] || null,
                },
            });
        }
    };
};