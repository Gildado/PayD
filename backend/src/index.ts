
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config/env';
import { monitoringConfig } from './config/monitoring';
import searchRoutes from './routes/searchRoutes';
import monitoringRoutes from './routes/monitoringRoutes';
import { requestLoggerMiddleware, errorTrackerMiddleware, tracingMiddleware } from './middleware';
import logger from './services/logging/logger';
import { alertingService } from './services/monitoring/alerting';
import employeeRoutes from './routes/employeeRoutes';
import paymentRoutes from './routes/paymentRoutes';
import authRoutes from './routes/authRoutes';
import { initializeSocket, emitTransactionUpdate } from './services/socketService';
import { HealthController } from './controllers/healthController';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
initializeSocket(httpServer);


// ─── Monitoring/Tracing Middleware ───────────────────────────────────────────
app.use(tracingMiddleware);
app.use(requestLoggerMiddleware);

// ─── Standard Middleware ────────────────────────────────────────────────────
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/monitoring', monitoringRoutes);


// Transaction simulation endpoint (for testing WebSocket updates)
app.post('/api/simulate-transaction-update', (req, res) => {
  const { transactionId, status, data } = req.body;
  
  if (!transactionId || !status) {
    return res.status(400).json({ error: 'Missing transactionId or status' });
  }

  emitTransactionUpdate(transactionId, status, data);
  
  return res.json({ 
    success: true, 
    message: `Update emitted for transaction ${transactionId}` 
  });
});

// ─── Health Check (legacy) ──────────────────────────────────────────────────
app.get('/health', HealthController.getHealthStatus);


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
// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = config.PORT || 3000;


httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, { environment: config.NODE_ENV });
  logger.info('Monitoring config', monitoringConfig);
});

export default app;
