
import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { monitoringConfig } from './config/monitoring';
import searchRoutes from './routes/searchRoutes';
import monitoringRoutes from './routes/monitoringRoutes';
import { requestLoggerMiddleware, errorTrackerMiddleware, tracingMiddleware } from './middleware';
import logger from './services/logging/logger';
import { alertingService } from './services/monitoring/alerting';

const app = express();


// ─── Monitoring/Tracing Middleware ───────────────────────────────────────────
app.use(tracingMiddleware);
app.use(requestLoggerMiddleware);

// ─── Standard Middleware ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/search', searchRoutes);
app.use('/api/monitoring', monitoringRoutes);


// ─── Health Check (legacy) ──────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});


// ─── Error Tracking Middleware ──────────────────────────────────────────────
app.use(errorTrackerMiddleware);

// ─── Start Alerting Service ─────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  alertingService.start();
}

const PORT = config.PORT || 3000;


app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, { environment: config.NODE_ENV });
  logger.info('Monitoring config', monitoringConfig);
});

export default app;
