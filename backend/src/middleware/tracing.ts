import { Request, Response, NextFunction } from 'express';
import { tracingService } from '../services/monitoring/tracing';

/**
 * Distributed Tracing Middleware
 *
 * Automatically creates a trace span for each incoming HTTP request.
 * Supports W3C Trace Context propagation via the `traceparent` header.
 *
 * Attaches traceId and spanId to the request object for downstream use.
 */

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      spanId?: string;
      parentSpanId?: string | null;
    }
  }
}

export function tracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check for incoming W3C traceparent header
  const traceparent = req.get('traceparent');
  let traceContext;

  if (traceparent) {
    const parsed = tracingService.parseTraceparent(traceparent);
    if (parsed) {
      traceContext = tracingService.startSpan(
        parsed.traceId,
        parsed.parentSpanId || parsed.spanId,
        `${req.method} ${req.path}`,
        {
          'http.method': req.method,
          'http.url': req.originalUrl,
          'http.route': req.route?.path || req.path,
        },
      );
    }
  }

  if (!traceContext) {
    traceContext = tracingService.startTrace(`${req.method} ${req.path}`, {
      'http.method': req.method,
      'http.url': req.originalUrl,
      'http.route': req.route?.path || req.path,
      'http.user_agent': req.get('user-agent') || '',
    });
  }

  // Attach trace context to request
  req.traceId = traceContext.traceId;
  req.spanId = traceContext.spanId;
  req.parentSpanId = traceContext.parentSpanId;

  // Set response header for trace propagation
  res.setHeader('traceparent', tracingService.toTraceparent(traceContext));

  // End span when response finishes
  const originalEnd = res.end;
  res.end = function (this: Response, ...args: Parameters<Response['end']>): Response {
    tracingService.endSpan(
      traceContext!.spanId,
      res.statusCode >= 400 ? 'error' : 'ok',
      {
        'http.status_code': res.statusCode,
        'http.response_content_length': parseInt(res.get('content-length') || '0', 10),
      },
    );

    return originalEnd.apply(this, args);
  } as Response['end'];

  next();
}
