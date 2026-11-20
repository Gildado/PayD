/**
 * API Response Compression Middleware (#1047)
 * 
 * Compresses JSON responses over 1KB using gzip to reduce bandwidth and improve
 * load times for clients on slow networks.
 * 
 * Features:
 * - gzip compression for JSON responses over 1KB threshold
 * - Configurable compression level (default: 6 - balanced)
 * - Excludes already-compressed content types
 * - Handles Vary: Accept-Encoding header
 * - Tracks compression metrics
 * - Configurable exclusion list for specific endpoints
 */

import { Request, Response, NextFunction } from 'express';
import zlib from 'zlib';
import logger from '../utils/logger.js';
import { Histogram, Counter } from 'prom-client';

// Configuration
const COMPRESSION_THRESHOLD_BYTES = parseInt(process.env.COMPRESSION_THRESHOLD_BYTES || '1024', 10); // 1KB
const COMPRESSION_LEVEL = parseInt(process.env.COMPRESSION_LEVEL || '6', 10); // 1-9, 6 is balanced

// Already-compressed content types to exclude
const EXCLUDED_CONTENT_TYPES = new Set([
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'application/zip',
  'application/gzip',
  'application/x-gzip',
  'application/octet-stream',
]);

// Endpoints to exclude from compression (SSE, WebSocket, etc.)
const EXCLUDED_PATHS = new Set([
  '/metrics', // Prometheus metrics should not be compressed
  '/socket.io', // WebSocket
  '/events', // Server-Sent Events
]);

// Prometheus Metrics
export const compressionSavingsHistogram = new Histogram({
  name: 'payd_response_compression_savings_bytes',
  help: 'Bytes saved by response compression',
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
});

export const compressionRatioHistogram = new Histogram({
  name: 'payd_response_compression_ratio',
  help: 'Response compression ratio (original_size / compressed_size)',
  buckets: [1, 1.5, 2, 3, 4, 5, 10],
});

export const compressionLatencyHistogram = new Histogram({
  name: 'payd_response_compression_latency_seconds',
  help: 'Time spent compressing responses',
  buckets: [0.001, 0.005, 0.01, 0.02, 0.05, 0.1],
});

export const compressedResponseCounter = new Counter({
  name: 'payd_compressed_responses_total',
  help: 'Total number of compressed responses',
  labelNames: ['content_type'],
});

export const uncompressedResponseCounter = new Counter({
  name: 'payd_uncompressed_responses_total',
  help: 'Total number of uncompressed responses',
  labelNames: ['reason'],
});

/**
 * Check if content type should be compressed
 */
function shouldCompressContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;

  // Only compress text-based content types
  const lowerContentType = contentType.toLowerCase();

  // Check if already compressed
  for (const excluded of EXCLUDED_CONTENT_TYPES) {
    if (lowerContentType.startsWith(excluded)) {
      return false;
    }
  }

  // Compress JSON, text, JavaScript, CSS, XML, HTML
  return (
    lowerContentType.includes('json') ||
    lowerContentType.startsWith('text/') ||
    lowerContentType.includes('javascript') ||
    lowerContentType.includes('xml')
  );
}

/**
 * Check if path should be excluded from compression
 */
function shouldExcludePath(path: string): boolean {
  for (const excluded of EXCLUDED_PATHS) {
    if (path.startsWith(excluded)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if client accepts gzip encoding
 */
function acceptsGzip(req: Request): boolean {
  const acceptEncoding = req.headers['accept-encoding'];
  if (!acceptEncoding) return false;
  return acceptEncoding.toLowerCase().includes('gzip');
}

/**
 * Compression middleware
 */
export function compressionMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip if path is excluded
  if (shouldExcludePath(req.path)) {
    uncompressedResponseCounter.labels('excluded_path').inc();
    return next();
  }

  // Skip if client doesn't accept gzip
  if (!acceptsGzip(req)) {
    uncompressedResponseCounter.labels('client_no_gzip').inc();
    return next();
  }

  // Intercept res.json to compress before sending
  const originalJson = res.json.bind(res);

  res.json = function (body: any): Response {
    const contentType = res.getHeader('Content-Type') as string | undefined;

    // Check if content type should be compressed
    if (!shouldCompressContentType(contentType)) {
      uncompressedResponseCounter.labels('excluded_content_type').inc();
      return originalJson(body);
    }

    // Serialize body to string
    const bodyString = JSON.stringify(body);
    const originalSize = Buffer.byteLength(bodyString, 'utf8');

    // Skip compression if below threshold
    if (originalSize < COMPRESSION_THRESHOLD_BYTES) {
      uncompressedResponseCounter.labels('below_threshold').inc();
      return originalJson(body);
    }

    // Compress response
    const compressionStart = Date.now();

    try {
      const compressed = zlib.gzipSync(bodyString, {
        level: COMPRESSION_LEVEL,
      });

      const compressionLatency = (Date.now() - compressionStart) / 1000;
      const compressedSize = compressed.length;
      const savings = originalSize - compressedSize;
      const ratio = originalSize / compressedSize;

      // Track metrics
      compressionLatencyHistogram.observe(compressionLatency);
      compressionSavingsHistogram.observe(savings);
      compressionRatioHistogram.observe(ratio);
      compressedResponseCounter.labels(contentType || 'unknown').inc();

      // Log if compression added significant latency
      if (compressionLatency > 0.005) {
        // 5ms
        logger.debug('Compression added latency', {
          path: req.path,
          originalSize,
          compressedSize,
          ratio: ratio.toFixed(2),
          latencyMs: (compressionLatency * 1000).toFixed(2),
        });
      }

      // Set response headers
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', compressedSize.toString());
      res.setHeader('Vary', 'Accept-Encoding');

      // Send compressed response
      res.type(contentType || 'application/json');
      res.send(compressed);

      return res;
    } catch (error) {
      logger.error('Compression failed, sending uncompressed', {
        error,
        path: req.path,
        originalSize,
      });
      uncompressedResponseCounter.labels('compression_error').inc();
      return originalJson(body);
    }
  } as typeof res.json;

  next();
}

/**
 * Get compression statistics
 */
export function getCompressionStats() {
  return {
    threshold: COMPRESSION_THRESHOLD_BYTES,
    level: COMPRESSION_LEVEL,
    excludedContentTypes: Array.from(EXCLUDED_CONTENT_TYPES),
    excludedPaths: Array.from(EXCLUDED_PATHS),
  };
}
