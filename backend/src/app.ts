import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import config from './config/index.js';
import { config as envConfig } from './config/env.js';
import logger from './utils/logger.js';
import passport from './config/passport.js';
import { apiVersionMiddleware } from './middlewares/apiVersionMiddleware.js';
import { requestIdMiddleware } from './middlewares/requestIdMiddleware.js';
import { apiRateLimit, dataRateLimit } from './middlewares/rateLimitMiddleware.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swaggerConfig.js';
import { requestLogger, errorLogger } from './middleware/requestLogger.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import metricsRoutes from './routes/metricsRoutes.js';
import { responseSizeBytes } from './utils/metrics.js';

// Feature Routes
import v1Routes from './routes/v1/index.js';
import authRoutes from './routes/authRoutes.js';
import webhookRoutes from './routes/webhookNotificationRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { HealthController } from './controllers/healthController.js';
import { apiErrorResponse, ErrorCodes } from './utils/apiError.js';
import { errorHandlerMiddleware } from './middlewares/errorHandlerMiddleware.js';

// Legacy Routes
import payrollAuditRoutes from './routes/payrollAuditRoutes.js';
import payrollRoutes from './routes/payroll.routes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import contractRoutes from './routes/contractRoutes.js';
import ratesRoutes from './routes/ratesRoutes.js';
import stellarThrottlingRoutes from './routes/stellarThrottlingRoutes.js';
import scalingRoutes from './routes/scalingRoutes.js';
import { MAX_BULK_IMPORT_REQUEST_BYTES as _MAX_BULK_IMPORT_REQUEST_BYTES } from './schemas/bulkImportSchema.js';

const __appFilename = fileURLToPath(import.meta.url);
const __appDirname = path.dirname(__appFilename);

// ── CORS allowlist ────────────────────────────────────────────────────────────
const buildAllowedOrigins = (): Set<string> => {
  const origins = new Set<string>();
  if (envConfig.CORS_ORIGIN) {
    envConfig.CORS_ORIGIN.split(',').forEach((o) => origins.add(o.trim()));
  }
  if (envConfig.CORS_ALLOWED_ORIGINS) {
    envConfig.CORS_ALLOWED_ORIGINS.split(',').forEach((o) => origins.add(o.trim()));
  }
  return origins;
};

const allowedOrigins = buildAllowedOrigins();

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      if (envConfig.NODE_ENV !== 'production') return callback(null, true);
      return callback(new Error('CORS: server-to-server requests not allowed in production'));
    }
    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    logger.warn(`CORS: blocked request from disallowed origin "${origin}"`);
    return callback(new Error(`CORS: origin "${origin}" is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Version'],
};

const app = express();

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));
// requestIdMiddleware must come before requestLogger so the ID is available in logs
app.use(requestIdMiddleware);
// Structured JSON request logging + Prometheus metrics (replaces morgan)
app.use(requestLogger);
app.use(metricsMiddleware);

// The bulk-import route applies its own express.json({ limit }) middleware
// directly in employeeRoutes.ts, so we only need a default parser here.
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Response timeout (30 seconds)
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(503).json(
        apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Request timed out')
      );
    }
  });
  next();
});

// Track response sizes for metrics
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const bodyStr = JSON.stringify(body);
    responseSizeBytes
      .labels(req.method, req.route?.path || req.path, String(res.statusCode))
      .observe(bodyStr.length);
    return originalJson(body);
  } as typeof res.json;
  next();
});

// ─── Observability Endpoints ──────────────────────────────────────────────────

// Prometheus metrics — scraped by Prometheus every 15 s
app.use('/metrics', metricsRoutes);

// ─── Static / Spec ────────────────────────────────────────────────────────────

// Serve stellar.toml for SEP-0001
app.get('/.well-known/stellar.toml', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__appDirname, '../.well-known/stellar.toml'));
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/openapi.json', (_req, res) => {
  res.json(swaggerSpec);
});
app.get('/api/v1/openapi.json', (_req, res) => {
  res.json(swaggerSpec);
});

// Export openapi.json for frontend
fs.writeFileSync(path.join(__appDirname, '../openapi.json'), JSON.stringify(swaggerSpec, null, 2));

// ─── API Versioning ───────────────────────────────────────────────────────────
app.use(apiVersionMiddleware);

// Versioned API — canonical entry point. Individual v1 route groups apply the
// appropriate rate-limit tier so requests are not double-counted.
app.use('/api/v1', v1Routes);

// API root — discovery endpoint
app.get('/api', (_req, res) => {
  res.json({
    name: 'PayD API',
    currentVersion: 'v1',
    supportedVersions: ['v1'],
    endpoints: {
      v1: '/api/v1',
      health: '/api/v1/health',
      openapi: '/api/v1/openapi.json',
    },
  });
});

// ─── Legacy Routes (deprecated — sunset 2027-01-01) ──────────────────────────
app.use('/rates', dataRateLimit(), ratesRoutes);
app.use('/auth', authRoutes);
app.use('/webhooks', apiRateLimit(), webhookRoutes);
app.use('/api/notifications', apiRateLimit(), notificationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/payroll/audit', apiRateLimit(), payrollAuditRoutes);
app.use('/api/payroll', apiRateLimit(), payrollRoutes);
app.use('/api/employees', dataRateLimit(), employeeRoutes);
app.use('/api/assets', dataRateLimit(), assetRoutes);
app.use('/api/payments', apiRateLimit(), paymentRoutes);
app.use('/api/search', dataRateLimit(), searchRoutes);
app.use('/api', apiRateLimit(), contractRoutes);
app.use('/api/stellar-throttling', apiRateLimit(), stellarThrottlingRoutes);
app.use('/api/v1/scaling', apiRateLimit(), scalingRoutes);

// Health check endpoints
app.get('/api/v1/health', HealthController.getHealthStatus);
app.get('/api/health', HealthController.getHealthStatus);
app.get('/health', HealthController.getHealthStatus);

// Kubernetes-style probes
app.get('/api/v1/health/live', HealthController.getLiveness);
app.get('/api/v1/health/ready', HealthController.getReadiness);
app.get('/health/live', HealthController.getLiveness);
app.get('/health/ready', HealthController.getReadiness);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    ...apiErrorResponse(ErrorCodes.NOT_FOUND, `Route ${req.method} ${req.path} not found`),
    path: req.path,
  });
});

// ─── Error Handling ───────────────────────────────────────────────────────────
// errorLogger increments Prometheus counters and logs with full context
app.use(errorLogger);

// Centralized error handler — standardizes ALL error responses (#341)
app.use(errorHandlerMiddleware);

export default app;
